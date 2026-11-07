import Decimal from 'decimal.js';
import { fromMinor } from './money';

export type ActivityId = 'design' | 'consulting' | 'support';
export type RecordKind = 'sale' | 'refund' | 'review';

export interface DemoRecord {
  id: string;
  paypalEventCode: string;
  initiatedAt: string;
  amountMinor: bigint;
  feeMinor: bigint | null;
  currency: 'USD';
  kind: RecordKind;
  subject: string;
  itemName: string;
  counterparty: string;
  activityId: ActivityId | null;
  referenceId: string | null;
}

export const demoActivities: { id: ActivityId; name: string; color: string }[] = [
  { id: 'design', name: 'Design', color: '#7357e8' },
  { id: 'consulting', name: 'Consulting', color: '#0f9b8e' },
  { id: 'support', name: 'Support', color: '#d59834' },
];

export const demoRecords: DemoRecord[] = [
  {
    id: 'pp-sep-design',
    paypalEventCode: 'T0006',
    initiatedAt: '2026-09-08T12:00:00Z',
    amountMinor: 300_000n,
    feeMinor: -12_000n,
    currency: 'USD',
    kind: 'sale',
    subject: 'Brand system and landing page',
    itemName: 'Design milestone',
    counterparty: 'Northstar Studio',
    activityId: 'design',
    referenceId: null,
  },
  {
    id: 'pp-sep-consulting',
    paypalEventCode: 'T0006',
    initiatedAt: '2026-09-19T16:20:00Z',
    amountMinor: 180_000n,
    feeMinor: -8_000n,
    currency: 'USD',
    kind: 'sale',
    subject: 'Product strategy workshop',
    itemName: 'Consulting session',
    counterparty: 'Atlas Works',
    activityId: 'consulting',
    referenceId: null,
  },
  {
    id: 'pp-oct-design',
    paypalEventCode: 'T0006',
    initiatedAt: '2026-10-09T10:40:00Z',
    amountMinor: 200_000n,
    feeMinor: -8_000n,
    currency: 'USD',
    kind: 'sale',
    subject: 'Brand system phase two',
    itemName: 'Design milestone',
    counterparty: 'Northstar Studio',
    activityId: 'design',
    referenceId: null,
  },
  {
    id: 'pp-oct-consulting',
    paypalEventCode: 'T0006',
    initiatedAt: '2026-10-18T15:30:00Z',
    amountMinor: 170_000n,
    feeMinor: -7_000n,
    currency: 'USD',
    kind: 'sale',
    subject: 'Quarterly roadmap and analytics workshop',
    itemName: 'Strategy session',
    counterparty: 'Atlas Works',
    activityId: null,
    referenceId: null,
  },
  {
    id: 'pp-oct-refund',
    paypalEventCode: 'T1107',
    initiatedAt: '2026-10-22T09:15:00Z',
    amountMinor: -15_000n,
    feeMinor: null,
    currency: 'USD',
    kind: 'refund',
    subject: 'Partial refund for roadmap workshop',
    itemName: 'Strategy session adjustment',
    counterparty: 'Atlas Works',
    activityId: null,
    referenceId: 'pp-oct-consulting',
  },
  {
    id: 'pp-oct-correction',
    paypalEventCode: 'T1900',
    initiatedAt: '2026-10-23T11:00:00Z',
    amountMinor: 500_000n,
    feeMinor: null,
    currency: 'USD',
    kind: 'review',
    subject: 'Account correction — excluded from commercial revenue',
    itemName: 'Balance adjustment',
    counterparty: 'PayPal',
    activityId: null,
    referenceId: null,
  },
];

export interface WorkInput {
  hours: string;
  directCostMinor: bigint;
}

export type DemoState = {
  confirmedActivityIds: Record<string, ActivityId>;
  work: Record<ActivityId, WorkInput>;
};

export const initialDemoState: DemoState = {
  confirmedActivityIds: {},
  work: {
    design: { hours: '40.00', directCostMinor: 50_000n },
    consulting: { hours: '20.00', directCostMinor: 25_000n },
    support: { hours: '0.00', directCostMinor: 0n },
  },
};

export interface Metric {
  id: string;
  label: string;
  valueMinor: bigint;
  recordIds: string[];
}

export interface PeriodTotals {
  grossMinor: bigint;
  refundsMinor: bigint;
  feesMinor: bigint;
  netMinor: bigint;
  recordIds: string[];
}

function recordsForPeriod(period: string): DemoRecord[] {
  return demoRecords.filter(
    (record) => record.initiatedAt.startsWith(period) && record.kind !== 'review',
  );
}

export function periodTotals(period: string): PeriodTotals {
  const records = recordsForPeriod(period);
  let grossMinor = 0n;
  let refundsMinor = 0n;
  let feesMinor = 0n;
  for (const record of records) {
    if (record.kind === 'sale') grossMinor += record.amountMinor;
    if (record.kind === 'refund') refundsMinor += record.amountMinor;
    feesMinor += record.feeMinor ?? 0n;
  }
  return {
    grossMinor,
    refundsMinor,
    feesMinor,
    netMinor: grossMinor + refundsMinor + feesMinor,
    recordIds: records.map((record) => record.id),
  };
}

export function buildBridge(): Metric[] {
  const previous = periodTotals('2026-09');
  const current = periodTotals('2026-10');
  const sales = demoRecords.filter((record) => record.kind === 'sale').map((record) => record.id);
  const refunds = demoRecords
    .filter((record) => record.kind === 'refund')
    .map((record) => record.id);
  return [
    {
      id: 'gross_delta',
      label: 'Gross receipts',
      valueMinor: current.grossMinor - previous.grossMinor,
      recordIds: sales,
    },
    {
      id: 'refund_delta',
      label: 'Refunds',
      valueMinor: current.refundsMinor - previous.refundsMinor,
      recordIds: refunds,
    },
    {
      id: 'fee_delta',
      label: 'PayPal fees',
      valueMinor: current.feesMinor - previous.feesMinor,
      recordIds: sales,
    },
  ];
}

export function bridgeReconciles(): boolean {
  const total = buildBridge().reduce((sum, metric) => sum + metric.valueMinor, 0n);
  return total === periodTotals('2026-10').netMinor - periodTotals('2026-09').netMinor;
}

export function resolvedActivity(record: DemoRecord, state: DemoState): ActivityId | null {
  const own = state.confirmedActivityIds[record.id] ?? record.activityId;
  if (own) return own;
  if (record.kind === 'refund' && record.referenceId) {
    const sale = demoRecords.find((candidate) => candidate.id === record.referenceId);
    return sale ? (state.confirmedActivityIds[sale.id] ?? sale.activityId) : null;
  }
  return null;
}

export function activityRows(state: DemoState) {
  const records = recordsForPeriod('2026-10');
  return demoActivities.map((activity) => {
    const assigned = records.filter((record) => resolvedActivity(record, state) === activity.id);
    const netMinor = assigned.reduce(
      (sum, record) => sum + record.amountMinor + (record.feeMinor ?? 0n),
      0n,
    );
    const work = state.work[activity.id];
    const hours = new Decimal(work.hours);
    const contributionMinor = netMinor - work.directCostMinor;
    return {
      ...activity,
      netMinor,
      costMinor: work.directCostMinor,
      contributionMinor,
      hours: hours.toFixed(2),
      contributionPerHour:
        assigned.length && hours.gt(0)
          ? new Decimal(contributionMinor.toString()).div(100).div(hours).toFixed(2)
          : null,
      recordIds: assigned.map((record) => record.id),
    };
  });
}

export function forecast30Days(state: DemoState = initialDemoState): {
  receiptsMinor: bigint;
  contributionMinor: bigint;
} {
  const current = periodTotals('2026-10');
  const costMinor = Object.values(state.work).reduce((sum, work) => sum + work.directCostMinor, 0n);
  const scale = (value: bigint) =>
    BigInt(new Decimal(value.toString()).mul(30).div(31).toDecimalPlaces(0).toString());
  return {
    receiptsMinor: scale(current.netMinor),
    contributionMinor: scale(current.netMinor - costMinor),
  };
}

export function money(minor: bigint, signed = false): string {
  const value = Number(fromMinor(minor));
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    signDisplay: signed ? 'always' : 'auto',
  }).format(value);
}
