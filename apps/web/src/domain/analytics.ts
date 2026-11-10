import {
  activityName,
  clientName,
  DEFAULT_PERIOD,
  initialWorkspaceState,
  kindLabels,
  monthTotals,
  netChangeBridge,
  previousPeriod,
  resolvedActivity,
  workspaceRecords,
  type WorkspaceRecord,
} from './workspace';

/** Numeric projection of the cent-based ledger for AG Studio. */
export type AnalyticsRecord = {
  record_id: string;
  activity: string;
  client: string;
  counterparty: string;
  date: string;
  event_code: string;
  expense_usd: number;
  fees_usd: number;
  gross_usd: number;
  kind: WorkspaceRecord['kind'];
  type: string;
  month: string;
  net_usd: number;
  refund_usd: number;
  source: string;
  status: string;
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

function activityLabel(record: WorkspaceRecord): string {
  if (record.kind === 'review') return 'Excluded';
  if (record.kind === 'expense') return 'Business expense';
  if (record.kind === 'withdrawal') return 'Transfer';
  return activityName(resolvedActivity(record, initialWorkspaceState));
}

/** Income and expense rows only: bank transfers move money but are not income or cost. */
export function buildAnalyticsRecords(): AnalyticsRecord[] {
  return workspaceRecords
    .filter((record) => record.kind !== 'withdrawal')
    .map((record) => {
      const counts = record.status === 'S' && record.kind !== 'review';
      const grossMinor = counts && record.kind === 'sale' ? record.amountMinor : 0n;
      const refundMinor = counts && record.kind === 'refund' ? record.amountMinor : 0n;
      const expenseMinor = counts && record.kind === 'expense' ? record.amountMinor : 0n;
      const feeMinor = counts ? (record.feeMinor ?? 0n) : 0n;
      return {
        record_id: record.id,
        activity: activityLabel(record),
        client: record.clientId ? clientName(record.clientId) : '—',
        counterparty: record.counterparty,
        date: record.initiatedAt.slice(0, 10),
        event_code: record.paypalEventCode,
        expense_usd: minorToDollars(expenseMinor),
        fees_usd: minorToDollars(feeMinor),
        gross_usd: minorToDollars(grossMinor),
        kind: record.kind,
        type: kindLabels[record.kind],
        month: record.initiatedAt.slice(0, 7),
        net_usd: minorToDollars(grossMinor + refundMinor + feeMinor),
        refund_usd: minorToDollars(refundMinor),
        source: `/app/transactions?record=${encodeURIComponent(record.id)}`,
        status:
          record.kind === 'review' ? 'In review' : record.status === 'P' ? 'Pending' : 'Completed',
        subject: record.subject,
      };
    });
}

export function buildAnalyticsBridge(period: string = DEFAULT_PERIOD): AnalyticsBridgeItem[] {
  return netChangeBridge(period).map((item) => ({
    id: item.id,
    label: item.label,
    value_usd: minorToDollars(item.valueMinor),
    record_ids: item.recordIds,
  }));
}

export function buildAnalyticsSummary(period: string = DEFAULT_PERIOD) {
  const previous = monthTotals(previousPeriod(period));
  const current = monthTotals(period);
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
