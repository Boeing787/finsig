import type { Pool } from 'pg';
import { normalizeRecord } from '../domain/reporting';
import { PayPalReportingClient } from '../paypal/reporting-client';

export class ImportService {
  constructor(
    private readonly pool: Pool,
    private readonly paypal: PayPalReportingClient,
  ) {}

  async run(start: Date, end: Date) {
    const records = [];
    let refreshedAt: Date | null = null;
    for await (const page of this.paypal.pages(start, end)) {
      records.push(...page.records.map(normalizeRecord));
      refreshedAt = page.refreshedAt;
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const run = await client.query<{ id: string }>(
        `INSERT INTO import_runs (window_start, window_end, reporting_refreshed_at)
         VALUES ($1, $2, $3) RETURNING id`,
        [start, end, refreshedAt],
      );
      const runId = run.rows[0]?.id;
      if (!runId) throw new Error('Import run insert returned no ID.');
      let inserted = 0;
      for (const record of records) {
        const result = await client.query<{ inserted: boolean }>(
          `INSERT INTO paypal_records
           (source_key, paypal_transaction_id, event_code, initiated_at, status,
            amount_minor, fee_minor, currency, kind, reference_id, raw, first_import_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (source_key) DO UPDATE SET
             status = EXCLUDED.status,
             fee_minor = EXCLUDED.fee_minor,
             reference_id = EXCLUDED.reference_id,
             raw = EXCLUDED.raw,
             last_seen_at = now()
           RETURNING (xmax = 0) AS inserted`,
          [
            record.sourceKey,
            record.transactionId,
            record.eventCode,
            record.initiatedAt,
            record.status,
            record.amountMinor.toString(),
            record.feeMinor?.toString() ?? null,
            record.currency,
            record.kind,
            record.referenceId,
            JSON.stringify(record.raw),
            runId,
          ],
        );
        if (result.rows[0]?.inserted) inserted += 1;
      }
      await client.query(
        `UPDATE import_runs SET completed_at = now(), rows_fetched = $2, rows_inserted = $3
         WHERE id = $1`,
        [runId, records.length, inserted],
      );
      await client.query('COMMIT');
      return {
        runId,
        fetched: records.length,
        inserted,
        refreshedAt: refreshedAt?.toISOString() ?? null,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
