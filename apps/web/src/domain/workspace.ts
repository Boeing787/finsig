import Decimal from 'decimal.js';
import { fromMinor } from './money';

/**
 * FinSig sample workspace.
 *
 * Twelve complete months (Nov 2025 – Oct 2026) plus November 2026 month-to-date of fictional,
 * PayPal-shaped records for one independent designer and consultant. Every amount is held in
 * integer cents; every derived figure on screen comes from the functions below, never from AI.
 */

export type ActivityId = 'design' | 'consulting' | 'support';
export type ClientId = 'northstar' | 'atlas' | 'lumen' | 'pinecone' | 'kestrel' | 'orbit';
export type RecordKind = 'sale' | 'refund' | 'expense' | 'withdrawal' | 'review';
/** PayPal Transaction Search status: S = completed, P = pending. */
export type RecordStatus = 'S' | 'P';

export interface WorkspaceRecord {
  id: string;
  paypalEventCode: string;
  initiatedAt: string;
  amountMinor: bigint;
  feeMinor: bigint | null;
  currency: 'USD';
  status: RecordStatus;
  kind: RecordKind;
  subject: string;
  itemName: string;
  counterparty: string;
  clientId: ClientId | null;
  /** Activity already confirmed by the freelancer in an earlier session; null needs review. */
  activityId: ActivityId | null;
  referenceId: string | null;
}

export interface Activity {
  id: ActivityId;
  name: string;
  color: string;
}

export interface Client {
  id: ClientId;
  name: string;
  initials: string;
  color: string;
  engagement: 'Retainer' | 'Milestones' | 'Workshops' | 'Project' | 'Ad hoc';
  activityId: ActivityId;
}

export interface Invoice {
  id: string;
  clientId: ClientId;
  title: string;
  amountMinor: bigint;
  issuedOn: string;
  dueOn: string;
}

export const activities: Activity[] = [
  { id: 'design', name: 'Design', color: '#5b6cf5' },
  { id: 'consulting', name: 'Consulting', color: '#14a89b' },
  { id: 'support', name: 'Support', color: '#f0a43a' },
];

export const clients: Client[] = [
  {
    id: 'northstar',
    name: 'Northstar Studio',
    initials: 'NS',
    color: '#5b6cf5',
    engagement: 'Retainer',
    activityId: 'design',
  },
  {
    id: 'atlas',
    name: 'Atlas Works',
    initials: 'AW',
    color: '#14a89b',
    engagement: 'Workshops',
    activityId: 'consulting',
  },
  {
    id: 'lumen',
    name: 'Lumen Health',
    initials: 'LH',
    color: '#f0a43a',
    engagement: 'Milestones',
    activityId: 'design',
  },
  {
    id: 'kestrel',
    name: 'Kestrel Analytics',
    initials: 'KA',
    color: '#9a6bf2',
    engagement: 'Project',
    activityId: 'consulting',
  },
  {
    id: 'pinecone',
    name: 'Pinecone Labs',
    initials: 'PL',
    color: '#2f9e6e',
    engagement: 'Retainer',
    activityId: 'support',
  },
  {
    id: 'orbit',
    name: 'Orbit Coffee Co.',
    initials: 'OC',
    color: '#e0679a',
    engagement: 'Ad hoc',
    activityId: 'design',
  },
];

export const PERIODS = [
  '2025-11',
  '2025-12',
  '2026-01',
  '2026-02',
  '2026-03',
  '2026-04',
  '2026-05',
  '2026-06',
  '2026-07',
  '2026-08',
  '2026-09',
  '2026-10',
] as const;
export type Period = (typeof PERIODS)[number];
export const DEFAULT_PERIOD: Period = '2026-10';
export const CURRENT_MONTH = '2026-11';
export const AS_OF = '2026-11-10T09:00:00Z';
export const OPENING_BALANCE_MINOR = 215_000n;
export const WORKSPACE_OWNER = { name: 'Alex Morgan', role: 'Independent product designer' };

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function monthLong(month: string): string {
  const [year, index] = month.split('-');
  return `${monthNames[Number(index) - 1]} ${year}`;
}

export function monthName(month: string): string {
  return monthNames[Number(month.split('-')[1]) - 1] ?? month;
}

export function monthShort(month: string): string {
  return monthName(month).slice(0, 3);
}

/** PayPal standard commercial rate used for the sample: 3.49% + $0.49, rounded half-up. */
export function paypalFee(amountMinor: bigint): bigint {
  return -((amountMinor * 349n + 5_000n) / 10_000n + 49n);
}

const usdMinor = (usd: number) => BigInt(Math.round(usd * 100));

type SaleSpec = {
  date: string;
  time: string;
  client: ClientId;
  usd: number;
  subject: string;
  item: string;
  activity?: ActivityId | null;
  status?: RecordStatus;
};

const saleSpecs: SaleSpec[] = [
  ...[
    '2025-11',
    '2025-12',
    '2026-01',
    '2026-02',
    '2026-03',
    '2026-04',
    '2026-05',
    '2026-06',
    '2026-07',
    '2026-08',
    '2026-09',
    '2026-10',
    '2026-11',
  ].map((month): SaleSpec => ({
    date: `${month}-06`,
    time: '10:40:00',
    client: 'northstar',
    usd: 2400,
    subject: `Design retainer — ${monthLong(month)}`,
    item: 'Monthly design retainer',
  })),
  ...(
    [
      ['2025-11-18', 1800, 'Service blueprint workshop'],
      ['2026-01-18', 2200, 'Annual planning workshop'],
      ['2026-02-18', 1800, 'Customer journey workshop'],
      ['2026-04-18', 2400, 'Product strategy offsite'],
      ['2026-05-18', 1800, 'Pricing research workshop'],
      ['2026-07-18', 2600, 'Roadmap prioritisation offsite'],
      ['2026-08-18', 1800, 'Discovery workshop'],
      ['2026-09-18', 1800, 'Product strategy workshop'],
    ] as const
  ).map(([date, usd, subject]): SaleSpec => ({
    date,
    time: '15:30:00',
    client: 'atlas',
    usd,
    subject,
    item: 'Consulting session',
  })),
  {
    date: '2026-10-18',
    time: '15:30:00',
    client: 'atlas',
    usd: 1700,
    subject: 'Quarterly roadmap and analytics workshop',
    item: 'Strategy session',
    activity: null,
  },
  {
    date: '2026-11-09',
    time: '16:05:00',
    client: 'atlas',
    usd: 1900,
    subject: 'Pricing strategy workshop',
    item: 'Consulting session',
    status: 'P',
  },
  ...(
    [
      ['2026-01-12', 3000, 'Patient portal discovery milestone'],
      ['2026-03-12', 3500, 'Patient portal UI milestone'],
      ['2026-06-12', 4000, 'Design system milestone'],
      ['2026-09-12', 2500, 'Accessibility audit milestone'],
    ] as const
  ).map(([date, usd, subject]): SaleSpec => ({
    date,
    time: '09:20:00',
    client: 'lumen',
    usd,
    subject,
    item: 'Design milestone',
  })),
  ...[
    '2026-02',
    '2026-03',
    '2026-04',
    '2026-05',
    '2026-06',
    '2026-07',
    '2026-08',
    '2026-09',
    '2026-10',
    '2026-11',
  ].map((month): SaleSpec => ({
    date: `${month}-02`,
    time: '08:00:00',
    client: 'pinecone',
    usd: 650,
    subject: `Maintenance & support — ${monthLong(month)}`,
    item: 'Support retainer',
  })),
  ...(
    [
      ['2026-08-26', 1200, 'Dashboard UX audit'],
      ['2026-09-26', 1800, 'Analytics dashboard sprint'],
      ['2026-10-26', 900, 'Sprint review and handoff'],
    ] as const
  ).map(([date, usd, subject]): SaleSpec => ({
    date,
    time: '13:10:00',
    client: 'kestrel',
    usd,
    subject,
    item: 'Consulting sprint',
  })),
  ...(
    [
      ['2025-12-22', 600, 'Holiday menu illustrations'],
      ['2026-04-22', 450, 'Loyalty card design'],
      ['2026-07-22', 900, 'Packaging refresh'],
    ] as const
  ).map(([date, usd, subject]): SaleSpec => ({
    date,
    time: '11:45:00',
    client: 'orbit',
    usd,
    subject,
    item: 'Design job',
  })),
  {
    date: '2026-11-03',
    time: '11:45:00',
    client: 'orbit',
    usd: 520,
    subject: 'Seasonal menu layout files',
    item: 'Print-ready files',
    activity: null,
  },
];

function clientById(id: ClientId): Client {
  const client = clients.find((item) => item.id === id);
  if (!client) throw new Error(`Unknown client ${id}`);
  return client;
}

function saleRecord(spec: SaleSpec): WorkspaceRecord {
  const amountMinor = usdMinor(spec.usd);
  const client = clientById(spec.client);
  return {
    id: `pp-${spec.date.slice(0, 7)}-${spec.client}`,
    paypalEventCode: 'T0006',
    initiatedAt: `${spec.date}T${spec.time}Z`,
    amountMinor,
    feeMinor: paypalFee(amountMinor),
    currency: 'USD',
    status: spec.status ?? 'S',
    kind: 'sale',
    subject: spec.subject,
    itemName: spec.item,
    counterparty: client.name,
    clientId: spec.client,
    activityId: spec.activity === undefined ? client.activityId : spec.activity,
    referenceId: null,
  };
}

const refunds: WorkspaceRecord[] = [
  {
    id: 'pp-2026-04-orbit-refund',
    paypalEventCode: 'T1107',
    initiatedAt: '2026-04-28T10:00:00Z',
    amountMinor: -10_000n,
    feeMinor: null,
    currency: 'USD',
    status: 'S',
    kind: 'refund',
    subject: 'Partial refund — print file revision',
    itemName: 'Design job adjustment',
    counterparty: 'Orbit Coffee Co.',
    clientId: 'orbit',
    activityId: null,
    referenceId: 'pp-2026-04-orbit',
  },
  {
    id: 'pp-2026-10-atlas-refund',
    paypalEventCode: 'T1107',
    initiatedAt: '2026-10-22T09:15:00Z',
    amountMinor: -15_000n,
    feeMinor: null,
    currency: 'USD',
    status: 'S',
    kind: 'refund',
    subject: 'Partial refund for roadmap workshop',
    itemName: 'Strategy session adjustment',
    counterparty: 'Atlas Works',
    clientId: 'atlas',
    activityId: null,
    referenceId: 'pp-2026-10-atlas',
  },
];

const ALL_MONTHS = [...PERIODS, CURRENT_MONTH];

function expenseRecord(
  date: string,
  slug: string,
  usd: number,
  counterparty: string,
  subject: string,
): WorkspaceRecord {
  return {
    id: `pp-${date.slice(0, 7)}-exp-${slug}`,
    paypalEventCode: 'T0002',
    initiatedAt: `${date}T07:00:00Z`,
    amountMinor: -usdMinor(usd),
    feeMinor: null,
    currency: 'USD',
    status: 'S',
    kind: 'expense',
    subject,
    itemName: 'Business subscription',
    counterparty,
    clientId: null,
    activityId: null,
    referenceId: null,
  };
}

const expenses: WorkspaceRecord[] = [
  ...ALL_MONTHS.map((month) =>
    expenseRecord(`${month}-01`, 'vectorly', 24, 'Vectorly Pro', 'Design tool subscription'),
  ),
  ...ALL_MONTHS.map((month) =>
    expenseRecord(`${month}-03`, 'cloudnest', 12, 'Cloudnest Storage', 'Cloud storage plan'),
  ),
  ...ALL_MONTHS.filter((month) => month >= '2026-03').map((month) =>
    expenseRecord(`${month}-10`, 'taskline', 16, 'Taskline Teams', 'Project management plan'),
  ),
  expenseRecord('2026-01-15', 'typecase', 180, 'Typecase Fonts', 'Annual font licence'),
  expenseRecord('2026-05-20', 'shapeshift', 350, 'Shapeshift Conf', 'Design conference ticket'),
];

const withdrawalPlanUsd: Record<Period, number> = {
  '2025-11': 3500,
  '2025-12': 3000,
  '2026-01': 6000,
  '2026-02': 4500,
  '2026-03': 6000,
  '2026-04': 5500,
  '2026-05': 4500,
  '2026-06': 6500,
  '2026-07': 6000,
  '2026-08': 5500,
  '2026-09': 8500,
  '2026-10': 5500,
};

const withdrawals: WorkspaceRecord[] = PERIODS.map((month) => ({
  id: `pp-${month}-transfer`,
  paypalEventCode: 'T0400',
  initiatedAt: `${month}-27T12:00:00Z`,
  amountMinor: -usdMinor(withdrawalPlanUsd[month]),
  feeMinor: null,
  currency: 'USD',
  status: 'S',
  kind: 'withdrawal',
  subject: 'Transfer to bank account',
  itemName: 'Withdrawal',
  counterparty: 'Bank ••4821',
  clientId: null,
  activityId: null,
  referenceId: null,
}));

const review: WorkspaceRecord = {
  id: 'pp-2026-10-correction',
  paypalEventCode: 'T1900',
  initiatedAt: '2026-10-23T11:00:00Z',
  amountMinor: 500_000n,
  feeMinor: null,
  currency: 'USD',
  status: 'S',
  kind: 'review',
  subject: 'Account correction — excluded from income',
  itemName: 'Balance adjustment',
  counterparty: 'PayPal',
  clientId: null,
  activityId: null,
  referenceId: null,
};

export const workspaceRecords: WorkspaceRecord[] = [
  ...saleSpecs.map(saleRecord),
  ...refunds,
  ...expenses,
  ...withdrawals,
  review,
].sort((a, b) => a.initiatedAt.localeCompare(b.initiatedAt));

export const recordById = new Map(workspaceRecords.map((record) => [record.id, record]));

export const invoices: Invoice[] = [
  {
    id: 'INV-2026-041',
    clientId: 'lumen',
    title: 'Research synthesis phase',
    amountMinor: 320_000n,
    issuedOn: '2026-10-20',
    dueOn: '2026-11-03',
  },
  {
    id: 'INV-2026-043',
    clientId: 'kestrel',
    title: 'Dashboard rollout support',
    amountMinor: 135_000n,
    issuedOn: '2026-10-31',
    dueOn: '2026-11-14',
  },
  {
    id: 'INV-2026-045',
    clientId: 'atlas',
    title: 'Next-quarter planning workshop',
    amountMinor: 210_000n,
    issuedOn: '2026-11-07',
    dueOn: '2026-11-28',
  },
  {
    id: 'INV-2026-046',
    clientId: 'northstar',
    title: 'December design retainer',
    amountMinor: 240_000n,
    issuedOn: '2026-11-08',
    dueOn: '2026-12-06',
  },
];

type HoursRow = Record<ActivityId, string>;
export const defaultHours: Record<string, HoursRow> = {
  '2025-11': { design: '52.00', consulting: '14.00', support: '0.00' },
  '2025-12': { design: '44.00', consulting: '0.00', support: '0.00' },
  '2026-01': { design: '78.00', consulting: '18.00', support: '0.00' },
  '2026-02': { design: '50.00', consulting: '14.00', support: '6.00' },
  '2026-03': { design: '70.00', consulting: '0.00', support: '7.00' },
  '2026-04': { design: '58.00', consulting: '19.00', support: '6.00' },
  '2026-05': { design: '50.00', consulting: '14.00', support: '8.00' },
  '2026-06': { design: '74.00', consulting: '0.00', support: '7.00' },
  '2026-07': { design: '64.00', consulting: '20.00', support: '6.00' },
  '2026-08': { design: '50.00', consulting: '24.00', support: '7.00' },
  '2026-09': { design: '68.00', consulting: '26.00', support: '6.00' },
  '2026-10': { design: '46.00', consulting: '22.00', support: '7.00' },
  '2026-11': { design: '14.00', consulting: '5.00', support: '2.00' },
};

/** An expected payment or expense the person entered. It is their expectation, not a fact. */
export interface ExpectationInput {
  id: string;
  direction: 'in' | 'out';
  label: string;
  amountMinor: bigint;
  /** YYYY-MM-DD. */
  date: string;
}

export interface ExpectationsState {
  /** Detected candidates (or overdue invoices) the person confirmed as still expected. */
  confirmed: string[];
  /** Detected events the person removed, for example a cancelled subscription. */
  dismissed: string[];
  added: ExpectationInput[];
}

export interface WorkspaceState {
  confirmedActivityIds: Record<string, ActivityId>;
  hours: Record<string, Partial<HoursRow>>;
  taxRatePercent: number;
  monthlyGoalMinor: bigint;
  expectations: ExpectationsState;
}

export const initialWorkspaceState: WorkspaceState = {
  confirmedActivityIds: {},
  hours: {},
  taxRatePercent: 25,
  monthlyGoalMinor: 600_000n,
  expectations: {
    confirmed: [],
    dismissed: [],
    // The sample freelancer entered this earlier: one payment cannot reveal an annual renewal.
    added: [
      {
        id: 'user-framewise-annual',
        direction: 'out',
        label: 'Framewise annual plan renewal',
        amountMinor: 24_000n,
        date: '2026-11-25',
      },
    ],
  },
};

// ---------------------------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------------------------

export function previousPeriod(month: string): string {
  const [year, index] = month.split('-').map(Number) as [number, number];
  const date = new Date(Date.UTC(year, index - 2, 1));
  return date.toISOString().slice(0, 7);
}

export function money(
  minor: bigint,
  options: { signed?: boolean; cents?: boolean; compact?: boolean } = {},
): string {
  const value = Number(fromMinor(minor));
  if (options.compact) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
      signDisplay: options.signed ? 'exceptZero' : 'auto',
    }).format(value);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: options.cents === false ? 0 : 2,
    maximumFractionDigits: options.cents === false ? 0 : 2,
    signDisplay: options.signed ? 'exceptZero' : 'auto',
  }).format(value);
}

export function percent(value: Decimal | number, digits = 1, signed = false): string {
  const number = typeof value === 'number' ? value : value.toNumber();
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(number);
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  });
}

export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------------------------
// Calculations
// ---------------------------------------------------------------------------------------------

export function resolvedActivity(
  record: WorkspaceRecord,
  state: WorkspaceState,
): ActivityId | null {
  const own = state.confirmedActivityIds[record.id] ?? record.activityId;
  if (own) return own;
  if (record.kind === 'refund' && record.referenceId) {
    const sale = recordById.get(record.referenceId);
    return sale ? (state.confirmedActivityIds[sale.id] ?? sale.activityId) : null;
  }
  return null;
}

function inMonth(record: WorkspaceRecord, month: string): boolean {
  return record.initiatedAt.startsWith(month);
}

/** Records that count toward income: completed sales and refunds. Review rows never count. */
function isIncomeRecord(record: WorkspaceRecord): boolean {
  return record.status === 'S' && (record.kind === 'sale' || record.kind === 'refund');
}

export interface MonthTotals {
  month: string;
  grossMinor: bigint;
  refundsMinor: bigint;
  feesMinor: bigint;
  netMinor: bigint;
  expensesMinor: bigint;
  profitMinor: bigint;
  withdrawalsMinor: bigint;
  recordIds: string[];
  expenseRecordIds: string[];
  salesCount: number;
}

export function monthTotals(month: string): MonthTotals {
  let grossMinor = 0n;
  let refundsMinor = 0n;
  let feesMinor = 0n;
  let expensesMinor = 0n;
  let withdrawalsMinor = 0n;
  let salesCount = 0;
  const recordIds: string[] = [];
  const expenseRecordIds: string[] = [];
  for (const record of workspaceRecords) {
    if (!inMonth(record, month) || record.status !== 'S') continue;
    if (record.kind === 'sale') {
      grossMinor += record.amountMinor;
      feesMinor += record.feeMinor ?? 0n;
      salesCount += 1;
      recordIds.push(record.id);
    } else if (record.kind === 'refund') {
      refundsMinor += record.amountMinor;
      feesMinor += record.feeMinor ?? 0n;
      recordIds.push(record.id);
    } else if (record.kind === 'expense') {
      expensesMinor += record.amountMinor;
      expenseRecordIds.push(record.id);
    } else if (record.kind === 'withdrawal') {
      withdrawalsMinor += record.amountMinor;
    }
  }
  const netMinor = grossMinor + refundsMinor + feesMinor;
  return {
    month,
    grossMinor,
    refundsMinor,
    feesMinor,
    netMinor,
    expensesMinor,
    profitMinor: netMinor + expensesMinor,
    withdrawalsMinor,
    recordIds,
    expenseRecordIds,
    salesCount,
  };
}

export function monthlySeries(): MonthTotals[] {
  return PERIODS.map((month) => monthTotals(month));
}

export function hoursFor(month: string, state: WorkspaceState): HoursRow {
  const base = defaultHours[month] ?? { design: '0.00', consulting: '0.00', support: '0.00' };
  return { ...base, ...state.hours[month] };
}

export function totalHours(month: string, state: WorkspaceState): Decimal {
  const hours = hoursFor(month, state);
  return activities.reduce((sum, activity) => sum.plus(hours[activity.id]), new Decimal(0));
}

/** Net income after PayPal-paid business expenses, divided by all logged hours. */
export function effectiveHourlyRate(month: string, state: WorkspaceState): Decimal | null {
  const hours = totalHours(month, state);
  if (hours.lte(0)) return null;
  return new Decimal(monthTotals(month).profitMinor.toString()).div(100).div(hours);
}

export interface BridgeDriver {
  id: string;
  label: string;
  valueMinor: bigint;
  recordIds: string[];
  clientId?: ClientId;
}

/** Exact month-over-month bridge: per-client gross change, then refunds, then PayPal fees. */
export function netChangeBridge(period: string): BridgeDriver[] {
  const previous = previousPeriod(period);
  const drivers: BridgeDriver[] = [];
  for (const client of clients) {
    const sales = workspaceRecords.filter(
      (record) =>
        record.kind === 'sale' &&
        record.status === 'S' &&
        record.clientId === client.id &&
        (inMonth(record, period) || inMonth(record, previous)),
    );
    const delta = sales.reduce(
      (sum, record) => sum + (inMonth(record, period) ? record.amountMinor : -record.amountMinor),
      0n,
    );
    if (delta !== 0n) {
      drivers.push({
        id: `client_delta:${client.id}`,
        label: `${client.name} payments`,
        valueMinor: delta,
        recordIds: sales.map((record) => record.id),
        clientId: client.id,
      });
    }
  }
  const current = monthTotals(period);
  const prior = monthTotals(previous);
  const refundIds = workspaceRecords
    .filter(
      (record) =>
        record.kind === 'refund' && (inMonth(record, period) || inMonth(record, previous)),
    )
    .map((record) => record.id);
  if (current.refundsMinor !== prior.refundsMinor) {
    drivers.push({
      id: 'refund_delta',
      label: 'Refunds',
      valueMinor: current.refundsMinor - prior.refundsMinor,
      recordIds: refundIds,
    });
  }
  drivers.push({
    id: 'fee_delta',
    label: 'PayPal fees',
    valueMinor: current.feesMinor - prior.feesMinor,
    recordIds: [...prior.recordIds, ...current.recordIds].filter(
      (id) => recordById.get(id)?.kind === 'sale',
    ),
  });
  return drivers;
}

export function bridgeReconciles(period: string): boolean {
  const total = netChangeBridge(period).reduce((sum, driver) => sum + driver.valueMinor, 0n);
  return total === monthTotals(period).netMinor - monthTotals(previousPeriod(period)).netMinor;
}

export interface ActivityRow extends Activity {
  netMinor: bigint;
  hours: string;
  perHour: string | null;
  recordIds: string[];
  share: number;
}

export function activityRows(month: string, state: WorkspaceState): ActivityRow[] {
  const records = workspaceRecords.filter(
    (record) => inMonth(record, month) && isIncomeRecord(record),
  );
  const hours = hoursFor(month, state);
  const totalNet = monthTotals(month).netMinor;
  return activities.map((activity) => {
    const assigned = records.filter((record) => resolvedActivity(record, state) === activity.id);
    const netMinor = assigned.reduce(
      (sum, record) => sum + record.amountMinor + (record.feeMinor ?? 0n),
      0n,
    );
    const activityHours = new Decimal(hours[activity.id]);
    return {
      ...activity,
      netMinor,
      hours: activityHours.toFixed(2),
      perHour:
        assigned.length && activityHours.gt(0)
          ? new Decimal(netMinor.toString()).div(100).div(activityHours).toFixed(2)
          : null,
      recordIds: assigned.map((record) => record.id),
      share: totalNet > 0n ? Number(netMinor) / Number(totalNet) : 0,
    };
  });
}

export function unassignedSales(state: WorkspaceState): WorkspaceRecord[] {
  return workspaceRecords.filter(
    (record) => record.kind === 'sale' && resolvedActivity(record, state) === null,
  );
}

export const classifiableRecordIds = workspaceRecords
  .filter((record) => record.kind === 'sale' && record.activityId === null)
  .map((record) => record.id);

export interface ClientSummary extends Client {
  grossMinor: bigint;
  netMinor: bigint;
  share: number;
  payments: number;
  lastPaidAt: string | null;
  monthlyNetMinor: bigint[];
  recordIds: string[];
  periodNetMinor: bigint;
}

/** Twelve-month client view ending at the selected period. */
export function clientSummaries(period: string = DEFAULT_PERIOD): ClientSummary[] {
  const end = PERIODS.indexOf(period as Period);
  const window = PERIODS.slice(Math.max(0, end - 11), end + 1) as string[];
  const totalGross = window.reduce((sum, month) => sum + monthTotals(month).grossMinor, 0n);
  return clients
    .map((client) => {
      const records = workspaceRecords.filter(
        (record) =>
          record.clientId === client.id &&
          isIncomeRecord(record) &&
          window.some((month) => inMonth(record, month)),
      );
      const sales = records.filter((record) => record.kind === 'sale');
      const grossMinor = sales.reduce((sum, record) => sum + record.amountMinor, 0n);
      const netOf = (items: WorkspaceRecord[]) =>
        items.reduce((sum, record) => sum + record.amountMinor + (record.feeMinor ?? 0n), 0n);
      return {
        ...client,
        grossMinor,
        netMinor: netOf(records),
        share: totalGross > 0n ? Number(grossMinor) / Number(totalGross) : 0,
        payments: sales.length,
        lastPaidAt: sales.at(-1)?.initiatedAt ?? null,
        monthlyNetMinor: window.map((month) =>
          netOf(records.filter((record) => inMonth(record, month))),
        ),
        recordIds: records.map((record) => record.id),
        periodNetMinor: netOf(records.filter((record) => inMonth(record, period))),
      };
    })
    .sort((a, b) => (b.grossMinor > a.grossMinor ? 1 : b.grossMinor < a.grossMinor ? -1 : 0));
}

export interface BalanceSummary {
  availableMinor: bigint;
  pendingMinor: bigint;
  heldForReviewMinor: bigint;
  pendingRecordIds: string[];
}

/** Opening balance plus every completed, balance-affecting record and fee. */
export function balanceSummary(): BalanceSummary {
  let availableMinor = OPENING_BALANCE_MINOR;
  let pendingMinor = 0n;
  let heldForReviewMinor = 0n;
  const pendingRecordIds: string[] = [];
  for (const record of workspaceRecords) {
    if (record.kind === 'review') {
      heldForReviewMinor += record.amountMinor;
      continue;
    }
    if (record.status === 'P') {
      pendingMinor += record.amountMinor + (record.feeMinor ?? 0n);
      pendingRecordIds.push(record.id);
      continue;
    }
    availableMinor += record.amountMinor + (record.feeMinor ?? 0n);
  }
  return { availableMinor, pendingMinor, heldForReviewMinor, pendingRecordIds };
}

export type InvoiceStatus = 'overdue' | 'due-soon' | 'scheduled';

export interface InvoiceView extends Invoice {
  client: Client;
  status: InvoiceStatus;
  daysUntilDue: number;
}

export function invoiceViews(asOf: string = AS_OF): InvoiceView[] {
  const today = Date.parse(asOf.slice(0, 10));
  return invoices
    .map((invoice) => {
      const daysUntilDue = Math.round((Date.parse(invoice.dueOn) - today) / 86_400_000);
      const status: InvoiceStatus =
        daysUntilDue < 0 ? 'overdue' : daysUntilDue <= 7 ? 'due-soon' : 'scheduled';
      return { ...invoice, client: clientById(invoice.clientId), status, daysUntilDue };
    })
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}

export interface Forecast {
  runRateMinor: bigint;
  invoicedMinor: bigint;
  invoicedNetMinor: bigint;
  overdueMinor: bigint;
  basisMonths: string[];
}

/** Next 30 days: three-month net run rate versus open invoices net of the standard fee. */
export function forecast30Days(period: string = DEFAULT_PERIOD): Forecast {
  const end = PERIODS.indexOf(period as Period);
  const basisMonths = PERIODS.slice(Math.max(0, end - 2), end + 1) as string[];
  const sum = basisMonths.reduce((total, month) => total + monthTotals(month).netMinor, 0n);
  const runRateMinor = BigInt(
    new Decimal(sum.toString()).div(basisMonths.length).toDecimalPlaces(0).toString(),
  );
  const open = invoiceViews().filter((invoice) => invoice.daysUntilDue <= 30);
  const invoicedMinor = open.reduce((total, invoice) => total + invoice.amountMinor, 0n);
  const invoicedNetMinor = open.reduce(
    (total, invoice) => total + invoice.amountMinor + paypalFee(invoice.amountMinor),
    0n,
  );
  const overdueMinor = open
    .filter((invoice) => invoice.status === 'overdue')
    .reduce((total, invoice) => total + invoice.amountMinor, 0n);
  return { runRateMinor, invoicedMinor, invoicedNetMinor, overdueMinor, basisMonths };
}

export function taxSetAside(month: string, state: WorkspaceState): bigint {
  const profit = monthTotals(month).profitMinor;
  if (profit <= 0n) return 0n;
  return BigInt(
    new Decimal(profit.toString()).mul(state.taxRatePercent).div(100).toDecimalPlaces(0).toString(),
  );
}

export function goalProgress(month: string, state: WorkspaceState): number {
  if (state.monthlyGoalMinor <= 0n) return 0;
  return Number(monthTotals(month).netMinor) / Number(state.monthlyGoalMinor);
}

export interface HealthComponent {
  id: 'stability' | 'diversification' | 'recurring' | 'buffer';
  label: string;
  score: number;
  max: 25;
  detail: string;
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Income health: four deterministic, equally weighted components (0–25 each).
 * Stability uses the coefficient of variation of monthly net income, diversification the largest
 * client's share of gross, recurring the retainer share, and buffer the months of typical
 * withdrawals covered by the available balance.
 */
export function incomeHealth(period: string = DEFAULT_PERIOD): {
  score: number;
  label: string;
  components: HealthComponent[];
} {
  const end = PERIODS.indexOf(period as Period);
  const window = PERIODS.slice(Math.max(0, end - 11), end + 1) as string[];
  const nets = window.map((month) => Number(monthTotals(month).netMinor));
  const mean = nets.reduce((sum, value) => sum + value, 0) / nets.length;
  const variance = nets.reduce((sum, value) => sum + (value - mean) ** 2, 0) / nets.length;
  const variation = mean > 0 ? Math.sqrt(variance) / mean : 1;

  const summaries = clientSummaries(period);
  const top = summaries[0];
  const recurringShare = summaries
    .filter((client) => client.engagement === 'Retainer')
    .reduce((sum, client) => sum + client.share, 0);

  const withdrawalsTotal = window.reduce(
    (sum, month) => sum + Number(-monthTotals(month).withdrawalsMinor),
    0,
  );
  const monthlyDraw = withdrawalsTotal / window.length;
  const runway = monthlyDraw > 0 ? Number(balanceSummary().availableMinor) / monthlyDraw : 0;

  const components: HealthComponent[] = [
    {
      id: 'stability',
      label: 'Stability',
      score: Math.round(25 * clamp(1 - variation / 0.6)),
      max: 25,
      detail: `Monthly net varies ${percent(variation, 0)} around its average`,
    },
    {
      id: 'diversification',
      label: 'Diversification',
      score: Math.round(25 * clamp((0.6 - (top?.share ?? 1)) / 0.35)),
      max: 25,
      detail: `${top?.name ?? 'Top client'} is ${percent(top?.share ?? 0, 0)} of gross`,
    },
    {
      id: 'recurring',
      label: 'Recurring income',
      score: Math.round(25 * clamp(recurringShare / 0.6)),
      max: 25,
      detail: `Retainers are ${percent(recurringShare, 0)} of gross`,
    },
    {
      id: 'buffer',
      label: 'Cash buffer',
      score: Math.round(25 * clamp(runway / 3)),
      max: 25,
      detail: `Balance covers ${runway.toFixed(1)} months of typical withdrawals`,
    },
  ];
  const score = components.reduce((sum, component) => sum + component.score, 0);
  const label =
    score >= 80 ? 'Strong' : score >= 60 ? 'Steady' : score >= 40 ? 'Fragile' : 'At risk';
  return { score, label, components };
}

export function deltaRatio(current: bigint, previous: bigint): number | null {
  if (previous === 0n) return null;
  return (Number(current) - Number(previous)) / Math.abs(Number(previous));
}

export function recentActivity(limit = 8): WorkspaceRecord[] {
  return [...workspaceRecords]
    .filter((record) => record.initiatedAt <= AS_OF)
    .sort((a, b) => b.initiatedAt.localeCompare(a.initiatedAt))
    .slice(0, limit);
}

export function clientName(id: ClientId | null): string {
  return id ? clientById(id).name : '—';
}

export function activityName(id: ActivityId | null): string {
  return activities.find((activity) => activity.id === id)?.name ?? 'Needs review';
}

export function recordNetMinor(record: WorkspaceRecord): bigint {
  return record.amountMinor + (record.feeMinor ?? 0n);
}

export const kindLabels: Record<RecordKind, string> = {
  sale: 'Payment received',
  refund: 'Refund',
  expense: 'Business expense',
  withdrawal: 'Bank transfer',
  review: 'In review',
};
