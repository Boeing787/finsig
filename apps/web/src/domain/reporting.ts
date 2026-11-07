import { createHash } from 'node:crypto';
import { z } from 'zod';
import { toMinor } from './money';

export const reportingRecordSchema = z
  .object({
    transaction_info: z
      .object({
        transaction_id: z.string().min(1),
        transaction_event_code: z.string().min(1),
        transaction_initiation_date: z.string(),
        transaction_status: z.string().default('UNKNOWN'),
        transaction_amount: z.object({ currency_code: z.string(), value: z.string() }),
        fee_amount: z.object({ currency_code: z.string(), value: z.string() }).optional(),
        paypal_reference_id: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();

export type ReportingRecord = z.infer<typeof reportingRecordSchema>;
export type RecordKind = 'sale' | 'refund' | 'review';

export function classifyEvent(eventCode: string, amountMinor: bigint): RecordKind {
  if (eventCode === 'T0006' && amountMinor > 0n) return 'sale';
  if (eventCode === 'T1107' && amountMinor < 0n) return 'refund';
  return 'review';
}

export function normalizeRecord(raw: unknown) {
  const record = reportingRecordSchema.parse(raw);
  const info = record.transaction_info;
  const currency = info.transaction_amount.currency_code;
  const amountMinor = toMinor(info.transaction_amount.value, currency);
  if (info.fee_amount && info.fee_amount.currency_code !== currency) {
    throw new Error('Fee currency differs from transaction currency.');
  }
  const date = new Date(info.transaction_initiation_date);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid transaction initiation date.');
  const sourceKey = createHash('sha256')
    .update(
      JSON.stringify([
        info.transaction_id,
        info.transaction_event_code,
        date.toISOString(),
        currency,
        info.transaction_amount.value,
      ]),
    )
    .digest('hex');

  return {
    sourceKey,
    transactionId: info.transaction_id,
    eventCode: info.transaction_event_code,
    initiatedAt: date,
    status: info.transaction_status,
    amountMinor,
    feeMinor: info.fee_amount ? toMinor(info.fee_amount.value, currency) : null,
    currency,
    kind: classifyEvent(info.transaction_event_code, amountMinor),
    referenceId: info.paypal_reference_id ?? null,
    raw: record,
  };
}
