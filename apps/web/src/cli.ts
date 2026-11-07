import { readFile } from 'node:fs/promises';
import Decimal from 'decimal.js';
import { z } from 'zod';
import { createPool } from './db/pool';
import { fromMinor, toMinor } from './domain/money';
import { PayPalReportingClient } from './paypal/reporting-client';
import { ImportService } from './services/import-service';

const [command, ...args] = process.argv.slice(2);
const pool = createPool();

const uuid = z.string().uuid();
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

async function migrate() {
  const sql = await readFile(new URL('./db/schema.sql', import.meta.url), 'utf8');
  await pool.query(sql);
  return { result: 'ok', schema: 'ready' };
}

async function importReporting() {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 86_400_000);
  const result = await new ImportService(pool, new PayPalReportingClient()).run(start, end);
  await pool.query(
    `INSERT INTO classifications (record_id, proposed_activity_id, evidence)
     SELECT p.id, a.id, 'Exact activity tag in PayPal reference'
     FROM paypal_records p
     JOIN activities a ON p.raw->'transaction_info'->>'transaction_subject' = 'activity:' || a.name
     WHERE p.kind = 'sale'
     ON CONFLICT (record_id) DO UPDATE SET
       proposed_activity_id = EXCLUDED.proposed_activity_id,
       evidence = EXCLUDED.evidence
     WHERE classifications.confirmed_at IS NULL`,
  );
  await pool.query(
    `INSERT INTO classifications (record_id, proposed_activity_id, evidence)
     SELECT refund.id, sale_class.confirmed_activity_id, 'Refund references a confirmed sale'
     FROM paypal_records refund
     JOIN paypal_records sale ON refund.reference_id = sale.paypal_transaction_id
     JOIN classifications sale_class ON sale_class.record_id = sale.id
     WHERE refund.kind = 'refund' AND sale_class.confirmed_activity_id IS NOT NULL
     ON CONFLICT (record_id) DO UPDATE SET
       proposed_activity_id = EXCLUDED.proposed_activity_id,
       evidence = EXCLUDED.evidence
     WHERE classifications.confirmed_at IS NULL`,
  );
  return { result: 'ok', ...result };
}

async function listRecords() {
  const result = await pool.query<{
    id: string;
    event_code: string;
    initiated_at: Date;
    status: string;
    amount_minor: string;
    fee_minor: string | null;
    currency: string;
    kind: string;
    proposed_activity: string | null;
    confirmed_activity: string | null;
  }>(
    `SELECT p.id, p.event_code, p.initiated_at, p.status,
            p.amount_minor, p.fee_minor, p.currency, p.kind,
            ap.name AS proposed_activity, ac.name AS confirmed_activity
     FROM paypal_records p
     LEFT JOIN classifications c ON c.record_id = p.id
     LEFT JOIN activities ap ON ap.id = c.proposed_activity_id
     LEFT JOIN activities ac ON ac.id = c.confirmed_activity_id
     ORDER BY p.initiated_at DESC LIMIT 100`,
  );
  return result.rows.map((row) => ({
    id: row.id,
    eventCode: row.event_code,
    initiatedAt: row.initiated_at.toISOString(),
    status: row.status,
    amount: fromMinor(BigInt(row.amount_minor)),
    fee: row.fee_minor === null ? null : fromMinor(BigInt(row.fee_minor)),
    currency: row.currency.trim(),
    kind: row.kind,
    proposedActivity: row.proposed_activity,
    confirmedActivity: row.confirmed_activity,
  }));
}

async function confirmClassification() {
  const [recordIdArg, activityName, clientLabel] = args;
  const recordId = uuid.parse(recordIdArg);
  if (!activityName)
    throw new Error('Usage: finsig:confirm <record-uuid> <activity> [client-label]');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const activity = await client.query<{ id: string }>(
      'SELECT id FROM activities WHERE name = $1',
      [activityName],
    );
    const activityId = activity.rows[0]?.id;
    if (!activityId) throw new Error(`Unknown activity: ${activityName}`);
    const record = await client.query<{ id: string }>(
      `SELECT id FROM paypal_records WHERE id = $1 AND kind IN ('sale', 'refund')`,
      [recordId],
    );
    if (!record.rowCount) throw new Error('Record not found or not a commercial transaction.');
    await client.query(
      `INSERT INTO classifications (record_id, confirmed_activity_id, client_label, confirmed_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (record_id) DO UPDATE SET
         confirmed_activity_id = EXCLUDED.confirmed_activity_id,
         client_label = EXCLUDED.client_label,
         confirmed_at = now()`,
      [recordId, activityId, clientLabel ?? null],
    );
    await client.query('COMMIT');
    return { result: 'ok', recordId, activity: activityName };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function upsertWork() {
  const [activityName, monthArg, hoursArg, costArg] = args;
  const period = `${month.parse(monthArg)}-01`;
  if (!activityName || hoursArg === undefined || costArg === undefined) {
    throw new Error('Usage: finsig:work <activity> <YYYY-MM> <hours|unknown> <USD-cost|unknown>');
  }
  const hours = hoursArg === 'unknown' ? null : new Decimal(hoursArg);
  if (hours && (!hours.isFinite() || hours.isNegative() || hours.decimalPlaces() > 2)) {
    throw new Error('Hours must be a nonnegative decimal with at most two places.');
  }
  const cost = costArg === 'unknown' ? null : toMinor(costArg, 'USD');
  if (cost !== null && cost < 0n) throw new Error('Direct cost must be nonnegative.');
  const result = await pool.query(
    `INSERT INTO work_inputs (activity_id, period, hours, direct_cost_minor, currency)
     SELECT id, $2::date, $3::numeric, $4::bigint, 'USD'
     FROM activities WHERE name = $1
     ON CONFLICT (activity_id, period, currency) DO UPDATE SET
       hours = EXCLUDED.hours,
       direct_cost_minor = EXCLUDED.direct_cost_minor,
       updated_at = now()`,
    [activityName, period, hours?.toFixed(2) ?? null, cost?.toString() ?? null],
  );
  if (!result.rowCount) throw new Error(`Unknown activity: ${activityName}`);
  return {
    result: 'ok',
    activity: activityName,
    period,
    hours: hours?.toFixed(2) ?? null,
    directCost: cost === null ? null : fromMinor(cost),
  };
}

async function summary() {
  const period = args[0] ? month.parse(args[0]) : null;
  const records = await pool.query<{
    kind: string;
    currency: string;
    amount_minor: string;
    fee_minor: string | null;
    confirmed_activity: string | null;
  }>(
    `SELECT p.kind, p.currency, p.amount_minor, p.fee_minor, a.name AS confirmed_activity
     FROM paypal_records p
     LEFT JOIN classifications c ON c.record_id = p.id
     LEFT JOIN activities a ON a.id = c.confirmed_activity_id
     WHERE p.status = 'S' AND p.kind IN ('sale', 'refund')
       AND ($1::text IS NULL OR to_char(p.initiated_at AT TIME ZONE 'UTC', 'YYYY-MM') = $1)`,
    [period],
  );
  const totals = new Map<
    string,
    { gross: bigint; refunds: bigint; fees: bigint; unassigned: number }
  >();
  const byActivity = new Map<
    string,
    { activity: string; currency: string; gross: bigint; refunds: bigint; fees: bigint }
  >();
  for (const record of records.rows) {
    const currency = record.currency.trim();
    const total = totals.get(currency) ?? { gross: 0n, refunds: 0n, fees: 0n, unassigned: 0 };
    const amount = BigInt(record.amount_minor);
    if (record.kind === 'sale') total.gross += amount;
    else total.refunds += amount;
    total.fees += BigInt(record.fee_minor ?? '0');
    if (!record.confirmed_activity) total.unassigned += 1;
    totals.set(currency, total);
    if (record.confirmed_activity) {
      const key = `${record.confirmed_activity}\u0000${currency}`;
      const activity = byActivity.get(key) ?? {
        activity: record.confirmed_activity,
        currency,
        gross: 0n,
        refunds: 0n,
        fees: 0n,
      };
      if (record.kind === 'sale') activity.gross += amount;
      else activity.refunds += amount;
      activity.fees += BigInt(record.fee_minor ?? '0');
      byActivity.set(key, activity);
    }
  }
  const work = await pool.query<{
    activity: string;
    period: string;
    hours: string | null;
    direct_cost_minor: string | null;
    currency: string;
  }>(
    `SELECT a.name AS activity, to_char(w.period, 'YYYY-MM') AS period,
            w.hours, w.direct_cost_minor, w.currency
     FROM work_inputs w JOIN activities a ON a.id = w.activity_id
     WHERE $1::text IS NULL OR to_char(w.period, 'YYYY-MM') = $1
     ORDER BY a.name, w.period`,
    [period],
  );
  return {
    period,
    currencies: [...totals.entries()].map(([currency, total]) => ({
      currency,
      gross: fromMinor(total.gross),
      refunds: fromMinor(total.refunds),
      fees: fromMinor(total.fees),
      net: fromMinor(total.gross + total.refunds + total.fees),
      unassignedRecords: total.unassigned,
    })),
    work: work.rows.map((row) => ({
      activity: row.activity,
      period: row.period,
      hours: row.hours,
      directCost: row.direct_cost_minor === null ? null : fromMinor(BigInt(row.direct_cost_minor)),
      currency: row.currency.trim(),
    })),
    activities: [...byActivity.values()].map((activity) => {
      const workInput = period
        ? work.rows.find(
            (row) =>
              row.activity === activity.activity && row.currency.trim() === activity.currency,
          )
        : undefined;
      const netMinor = activity.gross + activity.refunds + activity.fees;
      const costMinor =
        workInput?.direct_cost_minor == null ? null : BigInt(workInput.direct_cost_minor);
      const hours = workInput?.hours == null ? null : new Decimal(workInput.hours);
      return {
        activity: activity.activity,
        currency: activity.currency,
        gross: fromMinor(activity.gross),
        refunds: fromMinor(activity.refunds),
        fees: fromMinor(activity.fees),
        net: fromMinor(netMinor),
        hours: hours?.toFixed(2) ?? null,
        directCost: costMinor === null ? null : fromMinor(costMinor),
        contribution: costMinor === null ? null : fromMinor(netMinor - costMinor),
        netPerHour:
          hours && hours.greaterThan(0)
            ? new Decimal(netMinor.toString()).div(100).div(hours).toFixed(2)
            : null,
        contributionPerHour:
          hours && hours.greaterThan(0) && costMinor !== null
            ? new Decimal((netMinor - costMinor).toString()).div(100).div(hours).toFixed(2)
            : null,
      };
    }),
  };
}

try {
  const output = await (async () => {
    switch (command) {
      case 'migrate':
        return migrate();
      case 'import':
        return importReporting();
      case 'records':
        return listRecords();
      case 'confirm':
        return confirmClassification();
      case 'work':
        return upsertWork();
      case 'summary':
        return summary();
      default:
        throw new Error('Commands: migrate, import, records, confirm, work, summary');
    }
  })();
  console.log(JSON.stringify(output, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await pool.end();
}
