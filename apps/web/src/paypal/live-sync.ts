import { createHash } from 'node:crypto';
import { z } from 'zod';
import { normalizeRecord } from '../domain/reporting';
import { PayPalReportingClient } from './reporting-client';

/**
 * Live read of the configured sandbox merchant through PayPal Transaction Search.
 *
 * Reads the last 90 days in three 30-day windows (the API allows at most 31 days per request),
 * normalizes every record with the same code as the importer and returns only sanitized fields:
 * no buyer name, email or raw transaction ID leaves the server.
 */

export interface LiveRecord {
  id: string;
  eventCode: string;
  initiatedAt: string;
  status: string;
  kind: 'sale' | 'refund' | 'review';
  amountMinor: string;
  feeMinor: string | null;
  currency: string;
  subject: string | null;
  referencesRecord: string | null;
}

export type LiveSyncResult =
  | { configured: false }
  | {
      configured: true;
      ok: true;
      fetchedAt: string;
      refreshedAt: string | null;
      windowStart: string;
      windowEnd: string;
      records: LiveRecord[];
      totals: { grossMinor: string; refundsMinor: string; feesMinor: string; netMinor: string };
    }
  | { configured: true; ok: false; fetchedAt: string; error: string };

const subjectSchema = z
  .object({
    transaction_info: z
      .object({
        transaction_subject: z.string().optional(),
        transaction_note: z.string().optional(),
      })
      .passthrough(),
    cart_info: z
      .object({
        item_details: z
          .array(z.object({ item_name: z.string().optional() }).passthrough())
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const shortHash = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 12);

let cache: { expiresAt: number; value: LiveSyncResult } | null = null;
let inFlight: Promise<LiveSyncResult> | null = null;

export async function liveSandboxSync(now = new Date()): Promise<LiveSyncResult> {
  if (!process.env.PAYPAL_SANDBOX_CLIENT_ID || !process.env.PAYPAL_SANDBOX_CLIENT_SECRET) {
    return { configured: false };
  }
  if (cache && cache.expiresAt > now.getTime()) return cache.value;
  inFlight ??= runSync(now).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runSync(now: Date): Promise<LiveSyncResult> {
  const fetchedAt = now.toISOString();
  const client = new PayPalReportingClient();
  const windowEnd = new Date(now.getTime() - 60_000);
  const windowStart = new Date(windowEnd.getTime() - 90 * 86_400_000);
  try {
    const records: LiveRecord[] = [];
    let refreshedAt: Date | null = null;
    for (let index = 0; index < 3; index += 1) {
      const start = new Date(windowStart.getTime() + index * 30 * 86_400_000);
      const end = new Date(Math.min(start.getTime() + 30 * 86_400_000, windowEnd.getTime()));
      for await (const page of client.pages(start, end)) {
        if (page.refreshedAt && (!refreshedAt || page.refreshedAt > refreshedAt)) {
          refreshedAt = page.refreshedAt;
        }
        for (const raw of page.records) {
          const normalized = normalizeRecord(raw);
          const extra = subjectSchema.safeParse(raw);
          const subject = extra.success
            ? (extra.data.cart_info?.item_details?.[0]?.item_name ??
              extra.data.transaction_info.transaction_subject ??
              null)
            : null;
          records.push({
            id: normalized.sourceKey.slice(0, 12),
            eventCode: normalized.eventCode,
            initiatedAt: normalized.initiatedAt.toISOString(),
            status: normalized.status,
            kind: normalized.kind,
            amountMinor: normalized.amountMinor.toString(),
            feeMinor: normalized.feeMinor === null ? null : normalized.feeMinor.toString(),
            currency: normalized.currency,
            subject: subject?.slice(0, 80) ?? null,
            referencesRecord: normalized.referenceId ? shortHash(normalized.referenceId) : null,
          });
        }
      }
    }
    records.sort((a, b) => b.initiatedAt.localeCompare(a.initiatedAt));
    let gross = 0n;
    let refunds = 0n;
    let fees = 0n;
    for (const record of records) {
      if (record.status !== 'S' || record.currency !== 'USD') continue;
      if (record.kind === 'sale') gross += BigInt(record.amountMinor);
      if (record.kind === 'refund') refunds += BigInt(record.amountMinor);
      if (record.kind === 'sale' || record.kind === 'refund')
        fees += BigInt(record.feeMinor ?? '0');
    }
    const value: LiveSyncResult = {
      configured: true,
      ok: true,
      fetchedAt,
      refreshedAt: refreshedAt?.toISOString() ?? null,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      records: records.slice(0, 50),
      totals: {
        grossMinor: gross.toString(),
        refundsMinor: refunds.toString(),
        feesMinor: fees.toString(),
        netMinor: (gross + refunds + fees).toString(),
      },
    };
    cache = { expiresAt: now.getTime() + 5 * 60_000, value };
    return value;
  } catch (error) {
    const value: LiveSyncResult = {
      configured: true,
      ok: false,
      fetchedAt,
      error:
        error instanceof Error && error.message.startsWith('PayPal HTTP')
          ? error.message
          : 'PayPal sandbox did not return transactions.',
    };
    cache = { expiresAt: now.getTime() + 60_000, value };
    return value;
  }
}
