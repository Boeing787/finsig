import { buildBridge, demoRecords, periodTotals, type DemoRecord } from './demo';

export type AnalyticsRecord = {
  record_id: string;
  activity: string;
  counterparty: string;
  date: string;
  event_code: string;
  fees_usd: number;
  gross_usd: number;
  kind: DemoRecord['kind'];
  month: string;
  net_usd: number;
  refund_usd: number;
  source: string;
  subject: string;
};

export type AnalyticsBridgeItem = {
  id: string;
  label: string;
  value_usd: number;
  record_ids: string[];
};

function minorToDollars(value: bigint): number {
  const absoluteValue = value < 0n ? -value : value;
  if (absoluteValue > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('Money value exceeds the safe analytics projection range.');
  }
  return Number(value) / 100;
}

function activityName(record: DemoRecord): string {
  if (record.kind === 'review') return 'Excluded';
  if (record.activityId === 'design') return 'Design';
  if (record.activityId === 'consulting') return 'Consulting';
  if (record.activityId === 'support') return 'Support';
  return 'Needs review';
}

export function buildAnalyticsRecords(): AnalyticsRecord[] {
  return demoRecords.map((record) => {
    const grossMinor = record.kind === 'sale' ? record.amountMinor : 0n;
    const refundMinor = record.kind === 'refund' ? record.amountMinor : 0n;
    const feeMinor = record.feeMinor ?? 0n;
    return {
      record_id: record.id,
      activity: activityName(record),
      counterparty: record.counterparty,
      date: record.initiatedAt.slice(0, 10),
      event_code: record.paypalEventCode,
      fees_usd: minorToDollars(feeMinor),
      gross_usd: minorToDollars(grossMinor),
      kind: record.kind,
      month: record.initiatedAt.slice(0, 7),
      net_usd: minorToDollars(grossMinor + refundMinor + feeMinor),
      refund_usd: minorToDollars(refundMinor),
      source: `/demo?record=${encodeURIComponent(record.id)}#sources`,
      subject: record.subject,
    };
  });
}

export function buildAnalyticsBridge(): AnalyticsBridgeItem[] {
  return buildBridge().map((item) => ({
    id: item.id,
    label: item.label,
    value_usd: minorToDollars(item.valueMinor),
    record_ids: item.recordIds,
  }));
}

export function buildAnalyticsSummary() {
  const previous = periodTotals('2026-09');
  const current = periodTotals('2026-10');
  return {
    previous_net_usd: minorToDollars(previous.netMinor),
    current_net_usd: minorToDollars(current.netMinor),
    delta_usd: minorToDollars(current.netMinor - previous.netMinor),
    delta_percent: Number(
      (
        ((Number(current.netMinor) - Number(previous.netMinor)) / Number(previous.netMinor)) *
        100
      ).toFixed(1),
    ),
  };
}
