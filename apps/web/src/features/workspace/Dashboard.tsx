'use client';

import { AreaChart, BarChart, Donut, Gauge, Sparkline } from '@finsig/ui';
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  CalendarClock,
  Clock3,
  ExternalLink,
  Landmark,
  PiggyBank,
  ReceiptText,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  balanceSummary,
  clientSummaries,
  deltaRatio,
  effectiveHourlyRate,
  goalProgress,
  invoiceViews,
  money,
  monthLong,
  monthlySeries,
  monthName,
  monthShort,
  monthTotals,
  percent,
  PERIODS,
  previousPeriod,
  recentActivity,
  recordNetMinor,
  shortDate,
  taxSetAside,
  type Period,
} from '../../domain/workspace';
import { suggestedQuestions } from './ai';
import { CardHeader, ClientAvatar, Delta, RecordIcon, StatusPill } from './parts';
import { ReviewQueue } from './ReviewQueue';
import { useWorkspace } from './WorkspaceProvider';

const toUsd = (minor: bigint) => Number(minor) / 100;
const usd0 = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
const usd2 = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

export function Dashboard() {
  const { user, period, state } = useWorkspace();
  const firstName = user.name.split(' ')[0] ?? user.name;
  const series = useMemo(() => monthlySeries(), []);
  const current = monthTotals(period);
  const previous = monthTotals(previousPeriod(period));
  const rate = effectiveHourlyRate(period, state);
  const previousRate = effectiveHourlyRate(previousPeriod(period), state);
  const rates = PERIODS.map((month) => effectiveHourlyRate(month, state)?.toNumber() ?? 0);
  const tax = taxSetAside(period, state);

  return (
    <div className="page dashboard">
      <section className="page-intro">
        <div>
          <h1>Welcome back, {firstName}</h1>
          <p>
            Fictional sample workspace for <strong>{monthLong(period)}</strong>. Live records from
            FinSig’s configured sandbox merchant are separate and do not drive these analytics.
          </p>
        </div>
        <Link className="intro-link" href="/app/insights">
          <Sparkles size={15} /> Ask FinSig AI <ArrowRight size={14} />
        </Link>
      </section>

      <div className="dashboard-grid">
        <div className="dashboard-main">
          <BalanceCard taxMinor={tax} />
          <div className="kpi-row">
            <KpiCard
              icon={<Wallet size={16} />}
              label="Net income"
              value={money(current.netMinor)}
              ratio={deltaRatio(current.netMinor, previous.netMinor)}
              detail={`vs ${money(previous.netMinor, { cents: false })} in ${monthShort(previousPeriod(period))}`}
              spark={series.map((month) => toUsd(month.netMinor))}
            />
            <KpiCard
              icon={<Clock3 size={16} />}
              label="Effective hourly rate"
              value={rate ? `${usd2(rate.toNumber())}/h` : '—'}
              ratio={
                rate && previousRate
                  ? (rate.toNumber() - previousRate.toNumber()) / previousRate.toNumber()
                  : null
              }
              detail="Profit ÷ logged hours"
              spark={rates}
              color="#14a89b"
            />
            <KpiCard
              icon={<ReceiptText size={16} />}
              label="PayPal fees"
              value={money(-current.feesMinor)}
              ratio={deltaRatio(-current.feesMinor, -previous.feesMinor)}
              invert
              detail={`${percent(Number(-current.feesMinor) / Math.max(1, Number(current.grossMinor)))} of gross receipts`}
              spark={series.map((month) => toUsd(-month.feesMinor))}
              color="#f0a43a"
            />
            <KpiCard
              icon={<PiggyBank size={16} />}
              label="Tax set-aside"
              value={money(tax)}
              detail={`${state.taxRatePercent}% of profit · edit in Security`}
              spark={series.map((month) => toUsd(month.profitMinor) * (state.taxRatePercent / 100))}
              color="#9a6bf2"
            />
          </div>
          <CashFlowCard />
          <div className="split-row">
            <RateTrendCard rates={rates} />
            <ClientMixCard />
          </div>
          <InvoicesCard />
        </div>

        <div className="dashboard-rail">
          <GoalCard />
          <ReviewQueue compact />
          <RecentCard />
          <AskCard />
        </div>
      </div>
    </div>
  );
}

function BalanceCard({ taxMinor }: { taxMinor: bigint }) {
  const { live, syncNow, user } = useWorkspace();
  const balance = balanceSummary();
  return (
    <section className="card balance-card">
      <div className="balance-card__summary">
        <div className="balance-card__top">
          <div>
            <p className="muted-label">Sample balance</p>
            <p className="balance-card__value">
              <span>$</span>
              {money(balance.availableMinor).replace('$', '')}
            </p>
          </div>
          <span className="account-chip">
            <span className="account-chip__logo">P</span>
            {user.mode === 'paypal'
              ? 'Sample figures · PayPal identity verified'
              : 'Fictional sample'}{' '}
            · USD
          </span>
        </div>
        <div className="bubbles" role="list" aria-label="Balance breakdown">
          <div className="bubble" role="listitem">
            <strong>{money(balance.pendingMinor, { cents: false })}</strong>
            <span>Pending</span>
          </div>
          <div className="bubble is-primary" role="listitem">
            <strong>{money(balance.availableMinor, { cents: false })}</strong>
            <span>Available</span>
          </div>
          <div className="bubble" role="listitem">
            <strong>{money(taxMinor, { cents: false })}</strong>
            <span>Tax reserve</span>
          </div>
        </div>
      </div>
      <div className="balance-card__actions">
        <button
          type="button"
          className="fs-button fs-button--primary fs-button--lg"
          onClick={() => void syncNow()}
        >
          <RefreshCw size={16} className={live.status === 'loading' ? 'is-spinning' : undefined} />
          <span>Sync sandbox merchant</span>
        </button>
        <a
          className="fs-button fs-button--quiet fs-button--lg"
          href="https://www.sandbox.paypal.com/"
          target="_blank"
          rel="noreferrer"
        >
          <span>Open PayPal sandbox</span>
          <ExternalLink size={15} />
        </a>
        <LiveSyncNote />
        {balance.heldForReviewMinor ? (
          <Link className="held-note" href="/app/transactions?record=pp-2026-10-correction">
            <BadgeCheck size={14} />
            {money(balance.heldForReviewMinor, { cents: false })} correction held — never counted as
            income
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function LiveSyncNote() {
  const { live } = useWorkspace();
  if (live.status === 'ready') {
    const count = live.result.records.length;
    return (
      <Link className="live-note is-ok" href="/app/transactions?filter=live">
        <span className="live-dot" /> {count} live record{count === 1 ? '' : 's'} from FinSig’s
        configured sandbox merchant · separate from sample analytics
      </Link>
    );
  }
  if (live.status === 'unconfigured') {
    return (
      <p className="live-note">
        Live merchant sync is not configured — analytics use fictional sample history.
      </p>
    );
  }
  if (live.status === 'error') return <p className="live-note is-error">{live.message}</p>;
  return <p className="live-note">Contacting PayPal sandbox…</p>;
}

function KpiCard({
  icon,
  label,
  value,
  ratio = null,
  detail,
  spark,
  color = '#4f5df0',
  invert = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  ratio?: number | null;
  detail: string;
  spark: number[];
  color?: string;
  invert?: boolean;
}) {
  return (
    <article className="card kpi-card">
      <div className="kpi-card__head">
        <span className="kpi-card__icon" style={{ color, background: `${color}18` }}>
          {icon}
        </span>
        <span>{label}</span>
      </div>
      <strong className="kpi-card__value">{value}</strong>
      <div className="kpi-card__foot">
        <div>
          <Delta ratio={ratio} invert={invert} />
          <small>{detail}</small>
        </div>
        <Sparkline values={spark} color={color} width={84} height={30} />
      </div>
    </article>
  );
}

type FlowMetric = 'net' | 'gross' | 'expenses' | 'profit';

function CashFlowCard() {
  const { period, setPeriod } = useWorkspace();
  const [metric, setMetric] = useState<FlowMetric>('net');
  const series = monthlySeries();
  const pick = (month: (typeof series)[number]) =>
    metric === 'net'
      ? month.netMinor
      : metric === 'gross'
        ? month.grossMinor
        : metric === 'expenses'
          ? -month.expensesMinor
          : month.profitMinor;
  const selected = series.find((month) => month.month === period) ?? series[series.length - 1]!;
  const total = series.reduce((sum, month) => sum + pick(month), 0n);
  const labels: Record<FlowMetric, string> = {
    net: 'Net income',
    gross: 'Gross',
    expenses: 'Expenses',
    profit: 'Profit',
  };
  return (
    <section className="card cashflow-card">
      <CardHeader
        title="Cash flow"
        eyebrow="Last 12 months"
        action={
          <div className="segmented" role="tablist" aria-label="Cash flow measure">
            {(Object.keys(labels) as FlowMetric[]).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={metric === key}
                className={metric === key ? 'is-active' : ''}
                onClick={() => setMetric(key)}
              >
                {labels[key]}
              </button>
            ))}
          </div>
        }
      />
      <div className="cashflow-card__figures">
        <div>
          <strong>{money(pick(selected))}</strong>
          <span>
            {labels[metric]} in {monthName(selected.month)}
          </span>
        </div>
        <div>
          <strong className="is-quiet">{money(total, { cents: false })}</strong>
          <span>12-month total</span>
        </div>
      </div>
      <BarChart
        ariaLabel={`${labels[metric]} by month. Select a month to update the dashboard.`}
        data={series.map((month) => ({
          key: month.month,
          label: monthShort(month.month),
          value: toUsd(pick(month)),
        }))}
        selectedKey={period}
        onSelect={(key) => setPeriod(key as Period)}
        formatValue={usd2}
        height={250}
      />
      <p className="card-footnote">Click any month to re-run every widget for that period.</p>
    </section>
  );
}

function RateTrendCard({ rates }: { rates: number[] }) {
  const { period, state } = useWorkspace();
  const rate = effectiveHourlyRate(period, state)?.toNumber() ?? 0;
  const average = rates.reduce((sum, value) => sum + value, 0) / Math.max(1, rates.length);
  return (
    <section className="card trend-card">
      <div className="trend-card__head">
        <div>
          <p>Effective hourly rate</p>
          <strong>{usd0(rate)}/h</strong>
          <span>
            {rate >= average ? 'Above' : 'Below'} your 12-month average of {usd0(average)}/h
          </span>
        </div>
        <span className="trend-card__icon">
          <TrendingUp size={16} />
        </span>
      </div>
      <AreaChart
        tone="onBrand"
        ariaLabel="Effective hourly rate by month"
        data={PERIODS.map((month, index) => ({
          key: month,
          label: monthShort(month),
          value: rates[index] ?? 0,
        }))}
        formatValue={(value) => `${usd0(value)}/h`}
        height={170}
      />
    </section>
  );
}

function ClientMixCard() {
  const { period } = useWorkspace();
  const clients = clientSummaries(period);
  const total = clients.reduce((sum, client) => sum + client.grossMinor, 0n);
  const top = clients[0];
  return (
    <section className="card mix-card">
      <CardHeader
        title="Income by client"
        eyebrow="12-month gross"
        action={
          <Link className="text-link" href="/app/clients">
            Clients <ArrowRight size={13} />
          </Link>
        }
      />
      <div className="mix-card__body">
        <Donut
          segments={clients.map((client) => ({
            key: client.id,
            label: client.name,
            value: toUsd(client.grossMinor),
            color: client.color,
          }))}
          centerValue={money(total, { compact: true })}
          centerLabel="gross receipts"
          formatValue={usd0}
          size={150}
          thickness={16}
        />
        <ul className="legend">
          {clients.slice(0, 5).map((client) => (
            <li key={client.id}>
              <i style={{ background: client.color }} />
              <span>{client.name}</span>
              <strong>{percent(client.share, 0)}</strong>
            </li>
          ))}
        </ul>
      </div>
      {top && top.share > 0.35 ? (
        <p className="callout is-warning">
          {top.name} brings {percent(top.share, 0)} of gross — a concentration risk if it pauses.
        </p>
      ) : null}
    </section>
  );
}

function InvoicesCard() {
  const invoices = invoiceViews();
  const expected = invoices.reduce((sum, invoice) => sum + invoice.amountMinor, 0n);
  return (
    <section className="card invoices-card">
      <CardHeader
        title="Upcoming payments"
        eyebrow="Open PayPal invoices"
        icon={<CalendarClock size={16} />}
        action={<span className="pill is-brand">{money(expected, { cents: false })} expected</span>}
      />
      <ul className="invoice-list">
        {invoices.map((invoice) => (
          <li key={invoice.id}>
            <ClientAvatar clientId={invoice.clientId} />
            <div className="invoice-list__main">
              <strong>{invoice.client.name}</strong>
              <span>
                {invoice.title} · {invoice.id}
              </span>
            </div>
            <span
              className={`pill ${invoice.status === 'overdue' ? 'is-danger' : invoice.status === 'due-soon' ? 'is-warning' : ''}`}
            >
              {invoice.status === 'overdue'
                ? `${Math.abs(invoice.daysUntilDue)} days overdue`
                : invoice.status === 'due-soon'
                  ? `Due in ${invoice.daysUntilDue} days`
                  : `Due ${shortDate(`${invoice.dueOn}T00:00:00Z`)}`}
            </span>
            <strong className="invoice-list__amount">{money(invoice.amountMinor)}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

function GoalCard() {
  const { period, state } = useWorkspace();
  const progress = goalProgress(period, state);
  const current = monthTotals(period);
  const remaining = state.monthlyGoalMinor - current.netMinor;
  const caption = remaining > 0n ? `${money(remaining, { cents: false })} to go` : 'Goal reached';
  const series = monthlySeries();
  const hits = series.filter((month) => month.netMinor >= state.monthlyGoalMinor).length;
  const best = series.reduce(
    (top, month) => (month.netMinor > top.netMinor ? month : top),
    series[0]!,
  );
  return (
    <section className="card goal-card">
      <CardHeader
        title="Monthly income goal"
        eyebrow={monthLong(period)}
        action={
          <Link className="text-link" href="/app/settings#preferences">
            Edit
          </Link>
        }
      />
      <Gauge
        value={progress}
        label={`of ${money(state.monthlyGoalMinor, { cents: false })} net goal`}
        caption={caption}
        size={250}
      />
      <div className="goal-card__stats">
        <div>
          <strong>
            {hits}/{series.length}
          </strong>
          <span>months on goal</span>
        </div>
        <div>
          <strong>{money(best.netMinor, { compact: true })}</strong>
          <span>best · {monthShort(best.month)}</span>
        </div>
        <div>
          <strong>{current.salesCount}</strong>
          <span>payments</span>
        </div>
      </div>
    </section>
  );
}

function RecentCard() {
  const records = recentActivity(7);
  return (
    <section className="card recent-card">
      <CardHeader
        title="Transactions"
        eyebrow="Fictional sample history"
        action={
          <Link className="fs-button fs-button--primary fs-button--sm" href="/app/transactions">
            View all
          </Link>
        }
      />
      <ul className="recent-list">
        {records.map((record) => {
          const net = recordNetMinor(record);
          const direction = net >= 0n ? 'is-in' : 'is-out';
          return (
            <li key={record.id}>
              <Link href={`/app/transactions?record=${record.id}`}>
                <RecordIcon record={record} />
                <div className="recent-list__main">
                  <strong>{record.counterparty}</strong>
                  <span>{shortDate(record.initiatedAt)}</span>
                </div>
                <StatusPill record={record} short />
                <strong className={`recent-list__amount ${direction}`}>
                  {record.kind === 'review'
                    ? money(record.amountMinor)
                    : money(net, { signed: true })}
                </strong>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function AskCard() {
  const router = useRouter();
  const [question, setQuestion] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    if (question.trim().length >= 3)
      router.push(`/app/insights?q=${encodeURIComponent(question.trim())}`);
  }
  return (
    <section className="card ask-card">
      <div className="ask-card__head">
        <span className="ai-badge">
          <Bot size={15} />
        </span>
        <div>
          <h2>Ask FinSig</h2>
          <p>Answers cite sample records. Code calculates every amount.</p>
        </div>
      </div>
      <div className="chip-list">
        {suggestedQuestions.slice(0, 3).map((item) => (
          <Link key={item} className="chip" href={`/app/insights?q=${encodeURIComponent(item)}`}>
            {item}
          </Link>
        ))}
      </div>
      <form className="ask-input" onSubmit={submit}>
        <input
          aria-label="Ask a question about your income"
          placeholder="Ask about your income…"
          value={question}
          maxLength={240}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <button
          type="submit"
          className="fs-button fs-button--primary fs-button--sm"
          aria-label="Ask"
        >
          <ArrowRight size={15} />
        </button>
      </form>
      <p className="ask-card__foot">
        <Landmark size={12} /> Read-only: FinSig can never move your money.
      </p>
    </section>
  );
}
