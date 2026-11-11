import {
  AS_OF,
  invoiceViews,
  money,
  paypalFee,
  workspaceRecords,
  type ClientId,
  type WorkspaceRecord,
  type WorkspaceState,
} from './workspace';

/**
 * The AI manager's 30-day cash plan: expected income and expenses from the sample history, open
 * invoices and the person's own entries. Code builds every event and total; the model only
 * explains them. Cash basis: each event sits on the date money is expected to move.
 *
 * Rules (product plan, section 6):
 * - Income counts when it is invoiced, already pending in PayPal, or entered or confirmed by the
 *   person. A repeating payment alone is a candidate: it proves no new order, so it waits for
 *   confirmation. An overdue invoice needs the same confirmation rather than a guess.
 * - An expense counts when it repeated monthly at least three times (a subscription pattern) or the
 *   person entered it. A single payment never becomes an annual renewal.
 * - Without a confirmed opening balance the plan shows a difference of flows, not a balance.
 */

export const PLAN_HORIZON_DAYS = 30;
const DAY = 86_400_000;
const MIN_OBSERVATIONS = 3;
/** An expense at least this large gets an in-app alert when it falls inside the plan. */
export const ALERT_THRESHOLD_MINOR = 10_000n;

export type PlanEventStatus =
  | 'invoiced'
  | 'pending_paypal'
  | 'observed_pattern'
  | 'user_entered'
  | 'user_confirmed'
  | 'needs_confirmation'
  | 'overdue';

export interface PlanEvent {
  id: string;
  direction: 'in' | 'out';
  label: string;
  /** Why FinSig expects it, in words a person can check. */
  basis: string;
  /** YYYY-MM-DD; for an overdue invoice, the missed due date. */
  date: string;
  /** Gross amount, always positive. */
  amountMinor: bigint;
  /** Estimated PayPal fee on expected income (negative); zero for expenses. */
  feeMinor: bigint;
  status: PlanEventStatus;
  counted: boolean;
  sourceRecordIds: string[];
  /** The person can confirm it into the plan. */
  confirmable: boolean;
  /** The person can remove it (an entry they added, or a detected event that stopped). */
  removable: boolean;
}

export interface NotForecast {
  label: string;
  reason: string;
  sourceRecordIds: string[];
}

export interface PlanAlert {
  id: string;
  eventId: string;
  title: string;
  detail: string;
  daysAway: number;
}

export interface CashPlan {
  asOf: string;
  horizonEnd: string;
  events: PlanEvent[];
  inMinor: bigint;
  feesMinor: bigint;
  outMinor: bigint;
  /** inMinor + feesMinor − outMinor: a difference of expected flows, not a balance. */
  differenceMinor: bigint;
  /** Candidates and overdue invoices that are not counted until confirmed. */
  awaitingMinor: bigint;
  notForecast: NotForecast[];
  alerts: PlanAlert[];
}

const isoDate = (time: number) => new Date(time).toISOString().slice(0, 10);
const dayOf = (iso: string) => Date.parse(iso.slice(0, 10));

/** Same day next calendar month, clamped to the month's length (31 Jan → 28/29 Feb). */
function addMonth(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number) as [number, number, number];
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return isoDate(Date.UTC(year, month, Math.min(day, lastDay)));
}

function median(values: bigint[]): bigint {
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2n;
}

interface Series {
  key: string;
  counterparty: string;
  clientId: ClientId | null;
  kind: 'sale' | 'expense';
  records: WorkspaceRecord[];
}

function seriesUntil(asOf: string): Series[] {
  const groups = new Map<string, Series>();
  for (const record of workspaceRecords) {
    if (record.status !== 'S' || record.initiatedAt > asOf) continue;
    if (record.kind !== 'sale' && record.kind !== 'expense') continue;
    const key = `${record.kind}:${record.clientId ?? record.counterparty}`;
    const series = groups.get(key) ?? {
      key,
      counterparty: record.counterparty,
      clientId: record.clientId,
      kind: record.kind,
      records: [],
    };
    series.records.push(record);
    groups.set(key, series);
  }
  return [...groups.values()];
}

/** A monthly pattern: three or more payments, each 27–33 days after the one before. */
function monthlyPattern(series: Series) {
  const recent = series.records.slice(-6);
  if (recent.length < MIN_OBSERVATIONS) return null;
  const gaps = recent.slice(1).map((record, index) => {
    return (dayOf(record.initiatedAt) - dayOf(recent[index]!.initiatedAt)) / DAY;
  });
  if (gaps.some((gap) => gap < 27 || gap > 33)) return null;
  const amounts = recent.map((record) =>
    record.amountMinor < 0n ? -record.amountMinor : record.amountMinor,
  );
  const low = amounts.reduce((min, value) => (value < min ? value : min));
  const high = amounts.reduce((max, value) => (value > max ? value : max));
  return {
    first: recent[0]!,
    last: recent[recent.length - 1]!,
    observations: recent.length,
    amountMinor: median(amounts),
    varies: low !== high,
    low,
    high,
    sourceRecordIds: recent.map((record) => record.id),
  };
}

export function cashPlan(
  state: WorkspaceState,
  asOf: string = AS_OF,
  horizonDays: number = PLAN_HORIZON_DAYS,
): CashPlan {
  const start = dayOf(asOf);
  const end = start + horizonDays * DAY;
  const inWindow = (iso: string) => dayOf(iso) > start && dayOf(iso) <= end;
  const { confirmed, dismissed, added } = state.expectations;
  const events: PlanEvent[] = [];
  const notForecast: NotForecast[] = [];

  // Open invoices the person issued. Overdue ones wait for "still expected".
  const invoiced = new Set<ClientId>();
  for (const invoice of invoiceViews(asOf)) {
    if (dayOf(invoice.dueOn) > end) continue;
    const id = `invoice:${invoice.id}`;
    if (dismissed.includes(id)) continue;
    const overdue = invoice.daysUntilDue < 0;
    const isConfirmed = overdue && confirmed.includes(id);
    invoiced.add(invoice.clientId);
    events.push({
      id,
      direction: 'in',
      label: `${invoice.client.name} · ${invoice.title}`,
      basis: overdue
        ? `${invoice.id} was due ${invoice.dueOn} and is ${Math.abs(invoice.daysUntilDue)} days late`
        : `${invoice.id}, issued ${invoice.issuedOn}, due ${invoice.dueOn}`,
      date: invoice.dueOn,
      amountMinor: invoice.amountMinor,
      feeMinor: paypalFee(invoice.amountMinor),
      status: overdue ? (isConfirmed ? 'user_confirmed' : 'overdue') : 'invoiced',
      counted: !overdue || isConfirmed,
      sourceRecordIds: [],
      confirmable: overdue && !isConfirmed,
      removable: overdue,
    });
  }

  // Payments PayPal already shows as pending.
  for (const record of workspaceRecords) {
    if (record.status !== 'P' || record.kind !== 'sale' || record.initiatedAt > asOf) continue;
    const id = `pending:${record.id}`;
    if (dismissed.includes(id)) continue;
    if (record.clientId) invoiced.add(record.clientId);
    events.push({
      id,
      direction: 'in',
      label: `${record.counterparty} · ${record.subject}`,
      basis: `Pending in PayPal since ${record.initiatedAt.slice(0, 10)}`,
      date: isoDate(start + DAY),
      amountMinor: record.amountMinor,
      feeMinor: record.feeMinor ?? paypalFee(record.amountMinor),
      status: 'pending_paypal',
      counted: true,
      sourceRecordIds: [record.id],
      confirmable: false,
      removable: false,
    });
  }

  // Monthly patterns in the history.
  for (const series of seriesUntil(asOf)) {
    const pattern = monthlyPattern(series);
    if (!pattern) {
      if (series.kind === 'expense' && series.records.length < MIN_OBSERVATIONS) {
        const record = series.records[series.records.length - 1]!;
        notForecast.push({
          label: `${series.counterparty} · ${record.subject}`,
          reason: `${series.records.length === 1 ? 'One payment' : `${series.records.length} payments`} so far; FinSig does not guess a renewal. Add it if it repeats.`,
          sourceRecordIds: series.records.map((item) => item.id),
        });
      }
      continue;
    }
    let next = addMonth(pattern.last.initiatedAt);
    while (dayOf(next) <= start) next = addMonth(next);
    if (!inWindow(next)) continue;
    const range = pattern.varies
      ? `, ${money(pattern.low)}–${money(pattern.high)}`
      : `, ${money(pattern.amountMinor)} each`;
    const basis = `${pattern.observations} monthly payments since ${pattern.first.initiatedAt.slice(0, 10)}${range}`;

    if (series.kind === 'expense') {
      const id = `pattern:${series.key}`;
      if (dismissed.includes(id)) continue;
      events.push({
        id,
        direction: 'out',
        label: `${series.counterparty} · ${pattern.last.subject}`,
        basis,
        date: next,
        amountMinor: pattern.amountMinor,
        feeMinor: 0n,
        status: 'observed_pattern',
        counted: true,
        sourceRecordIds: pattern.sourceRecordIds,
        confirmable: false,
        removable: true,
      });
      continue;
    }
    // A client already invoiced or paying in this window is covered; a pattern would count twice.
    if (series.clientId && invoiced.has(series.clientId)) continue;
    const id = `pattern:${series.key}`;
    if (dismissed.includes(id)) continue;
    const isConfirmed = confirmed.includes(id);
    events.push({
      id,
      direction: 'in',
      label: `${series.counterparty} · ${pattern.last.subject.replace(/ — .*$/u, '')}`,
      basis,
      date: next,
      amountMinor: pattern.amountMinor,
      feeMinor: paypalFee(pattern.amountMinor),
      status: isConfirmed ? 'user_confirmed' : 'needs_confirmation',
      counted: isConfirmed,
      sourceRecordIds: pattern.sourceRecordIds,
      confirmable: !isConfirmed,
      removable: true,
    });
  }

  // The person's own entries.
  for (const entry of added) {
    if (!inWindow(entry.date)) continue;
    events.push({
      id: entry.id,
      direction: entry.direction,
      label: entry.label,
      basis: 'Entered by you',
      date: entry.date,
      amountMinor: entry.amountMinor,
      feeMinor: entry.direction === 'in' ? paypalFee(entry.amountMinor) : 0n,
      status: 'user_entered',
      counted: true,
      sourceRecordIds: [],
      confirmable: false,
      removable: true,
    });
  }

  events.sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
  const counted = events.filter((event) => event.counted);
  const sum = (items: PlanEvent[], pick: (event: PlanEvent) => bigint) =>
    items.reduce((total, event) => total + pick(event), 0n);
  const incoming = counted.filter((event) => event.direction === 'in');
  const outgoing = counted.filter((event) => event.direction === 'out');
  const inMinor = sum(incoming, (event) => event.amountMinor);
  const feesMinor = sum(incoming, (event) => event.feeMinor);
  const outMinor = sum(outgoing, (event) => event.amountMinor);

  const alerts = outgoing
    .filter((event) => event.amountMinor >= ALERT_THRESHOLD_MINOR)
    .map((event): PlanAlert => {
      const daysAway = Math.round((dayOf(event.date) - start) / DAY);
      return {
        id: `plan:${event.id}:${event.date}`,
        eventId: event.id,
        title: `${event.label} in ${daysAway} day${daysAway === 1 ? '' : 's'}`,
        detail: `${money(event.amountMinor)} on ${event.date} · in your 30-day plan`,
        daysAway,
      };
    });

  return {
    asOf,
    horizonEnd: isoDate(end),
    events,
    inMinor,
    feesMinor,
    outMinor,
    differenceMinor: inMinor + feesMinor - outMinor,
    awaitingMinor: sum(
      events.filter((event) => !event.counted && event.direction === 'in'),
      (event) => event.amountMinor,
    ),
    notForecast,
    alerts,
  };
}
