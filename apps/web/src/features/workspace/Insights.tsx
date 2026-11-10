'use client';

import { Waterfall } from '@finsig/ui';
import { ArrowRight, BadgeCheck, Bot, CalendarClock, HeartPulse, Send, Timer } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  activityRows,
  bridgeReconciles,
  effectiveHourlyRate,
  forecast30Days,
  hoursFor,
  incomeHealth,
  money,
  monthLong,
  monthName,
  monthTotals,
  netChangeBridge,
  previousPeriod,
  taxSetAside,
  totalHours,
  type ActivityId,
} from '../../domain/workspace';
import { askFinSig, suggestedQuestions, type Answer } from './ai';
import { CardHeader } from './parts';
import { useWorkspace } from './WorkspaceProvider';

interface Turn {
  id: number;
  question: string;
  period: string;
  status: 'loading' | 'done' | 'error';
  answer?: Answer;
  error?: string;
}

export function Insights({ initialQuestion }: { initialQuestion: string | null }) {
  return (
    <div className="page insights-page">
      <section className="page-intro">
        <div>
          <h1>AI Insights</h1>
          <p>
            Ask about the fictional sample history and your planning inputs. Claude chooses
            evidence; FinSig verifies every citation and renders every number from code.
          </p>
        </div>
      </section>
      <AskPanel initialQuestion={initialQuestion} />
      <div className="insights-grid">
        <BridgeCard />
        <HealthCard />
      </div>
      <div className="insights-grid is-reverse">
        <ProfitabilityCard />
        <ForecastCard />
      </div>
    </div>
  );
}

function AskPanel({ initialQuestion }: { initialQuestion: string | null }) {
  const { period, state } = useWorkspace();
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const counter = useRef(0);
  const asked = useRef(false);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 3) return;
    counter.current += 1;
    const id = counter.current;
    setTurns((previous) => [{ id, question: trimmed, period, status: 'loading' }, ...previous]);
    setQuestion('');
    try {
      const answer = await askFinSig(trimmed, period, state);
      setTurns((previous) =>
        previous.map((turn) => (turn.id === id ? { ...turn, status: 'done', answer } : turn)),
      );
    } catch (error) {
      setTurns((previous) =>
        previous.map((turn) =>
          turn.id === id
            ? {
                ...turn,
                status: 'error',
                error: error instanceof Error ? error.message : 'AI request failed.',
              }
            : turn,
        ),
      );
    }
  }

  useEffect(() => {
    if (!initialQuestion || asked.current) return;
    const task = window.setTimeout(() => {
      asked.current = true;
      void ask(initialQuestion);
    }, 0);
    return () => window.clearTimeout(task);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  return (
    <section className="card ask-panel">
      <div className="ask-panel__head">
        <span className="ai-badge">
          <Bot size={16} />
        </span>
        <div>
          <h2>Ask FinSig</h2>
          <p>Answering for {monthLong(period)} · change the month in the top bar</p>
        </div>
        <span className="pill is-ai">Claude · grounded</span>
      </div>
      <form className="ask-panel__form" onSubmit={submit}>
        <input
          aria-label="Your question"
          placeholder="e.g. Why did my income drop, and what should I do next?"
          value={question}
          maxLength={240}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <button
          type="submit"
          className="fs-button fs-button--primary"
          disabled={question.trim().length < 3}
        >
          <Send size={15} /> Ask
        </button>
      </form>
      <div className="chip-list">
        {suggestedQuestions.map((item) => (
          <button key={item} type="button" className="chip" onClick={() => void ask(item)}>
            {item}
          </button>
        ))}
      </div>
      {turns.length ? (
        <div className="answers">
          {turns.map((turn) => (
            <AnswerCard key={turn.id} turn={turn} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function AnswerCard({ turn }: { turn: Turn }) {
  return (
    <article className="answer">
      <p className="answer__question">
        <span>You asked</span> {turn.question}
        <small> · {monthName(turn.period)}</small>
      </p>
      {turn.status === 'loading' ? (
        <div className="answer__loading">
          <span className="fs-spinner" /> Reading verified metrics and source records…
        </div>
      ) : null}
      {turn.status === 'error' ? <p className="callout is-error">{turn.error}</p> : null}
      {turn.answer?.unsupported ? (
        <p className="callout">
          FinSig can only answer from this demo’s sample data and your work inputs. Try one of the
          suggested questions.
        </p>
      ) : null}
      {turn.answer && !turn.answer.unsupported ? (
        <>
          <ol className="claims">
            {turn.answer.claims.map((claim, index) => (
              <li key={index}>
                <p>{claim.text}</p>
                <div className="claims__metrics">
                  {claim.metrics.map((metric) => (
                    <span key={metric.id} className="metric-chip">
                      {metric.label}
                      <strong>{metric.value}</strong>
                    </span>
                  ))}
                </div>
                {claim.recordIds.length ? (
                  <div className="claims__sources">
                    Sources:
                    {claim.recordIds.map((id) => (
                      <Link key={id} href={`/app/transactions?record=${encodeURIComponent(id)}`}>
                        {id}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
          <p className="answer__foot">
            <BadgeCheck size={13} /> Verified: every metric and record ID checked by code · no
            model-written numbers · {turn.answer.model}
          </p>
        </>
      ) : null}
    </article>
  );
}

function BridgeCard() {
  const { period } = useWorkspace();
  const previous = previousPeriod(period);
  const drivers = netChangeBridge(period);
  const before = monthTotals(previous);
  const after = monthTotals(period);
  const toUsd = (minor: bigint) => Number(minor) / 100;
  const usd = (value: number, signed = false) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      signDisplay: signed ? 'exceptZero' : 'auto',
    }).format(value);
  return (
    <section className="card bridge-card">
      <CardHeader
        title="Why net income changed"
        eyebrow={`${monthName(previous)} → ${monthName(period)} · exact bridge`}
        action={
          bridgeReconciles(period) ? (
            <span className="pill is-success">
              <BadgeCheck size={12} /> Reconciled to the cent
            </span>
          ) : null
        }
      />
      <Waterfall
        start={{ label: `${monthName(previous)} net`, value: toUsd(before.netMinor) }}
        steps={drivers.map((driver) => ({
          key: driver.id,
          label: driver.label,
          value: toUsd(driver.valueMinor),
          detail: `${driver.recordIds.length} source records`,
        }))}
        end={{ label: `${monthName(period)} net`, value: toUsd(after.netMinor) }}
        formatValue={usd}
      />
      <p className="card-footnote">
        Gross changes by client, then refunds, then PayPal fees. The account correction in review is
        excluded.
      </p>
    </section>
  );
}

function HealthCard() {
  const { period } = useWorkspace();
  const health = incomeHealth(period);
  return (
    <section className="card health-card">
      <CardHeader
        title="Income health"
        eyebrow="Four equal, explainable parts"
        icon={<HeartPulse size={16} />}
      />
      <div className="health-card__score">
        <div className="health-ring" style={{ ['--score' as string]: health.score }}>
          <strong>{health.score}</strong>
          <span>/ 100</span>
        </div>
        <div>
          <h3>{health.label}</h3>
          <p>Calculated from the sample history — no model involved. Ask FinSig how to raise it.</p>
        </div>
      </div>
      <ul className="health-card__parts">
        {health.components.map((component) => (
          <li key={component.id}>
            <div>
              <strong>{component.label}</strong>
              <span>
                {component.score}/{component.max}
              </span>
            </div>
            <div className="meter">
              <i style={{ width: `${(component.score / component.max) * 100}%` }} />
            </div>
            <small>{component.detail}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProfitabilityCard() {
  const { period, state, setHours } = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  const rows = activityRows(period, state);
  const hours = hoursFor(period, state);
  const rate = effectiveHourlyRate(period, state);
  const best = [...rows]
    .filter((row) => row.perHour)
    .sort((a, b) => Number(b.perHour) - Number(a.perHour))[0];
  function update(activity: ActivityId, value: string) {
    setError(setHours(period, activity, value));
  }
  const maxRate = Math.max(...rows.map((row) => Number(row.perHour ?? 0)), 1);
  return (
    <section className="card profit-card">
      <CardHeader
        title="What each kind of work earns"
        eyebrow={`${monthLong(period)} · net per hour`}
        icon={<Timer size={16} />}
        action={
          <span className="pill is-brand">
            Overall {rate ? `$${rate.toFixed(2)}/h` : '—'} · {totalHours(period, state).toFixed(1)}{' '}
            h
          </span>
        }
      />
      <div className="rate-bars">
        {rows.map((row) => (
          <div key={row.id} className="rate-bars__item">
            <span className="rate-bars__value">
              {row.perHour ? `$${Number(row.perHour).toFixed(0)}` : '—'}
            </span>
            <div className="rate-bars__column">
              <i
                style={{
                  height: `${Math.max(6, (Number(row.perHour ?? 0) / maxRate) * 100)}%`,
                  background: row.id === best?.id ? 'var(--fs-gradient-brand)' : `${row.color}55`,
                }}
              />
            </div>
            <span className="rate-bars__label">{row.name}</span>
          </div>
        ))}
      </div>
      <div className="profit-table" role="table" aria-label="Activity profitability">
        <div className="profit-table__head" role="row">
          <span role="columnheader">Activity</span>
          <span role="columnheader">Net income</span>
          <span role="columnheader">Hours (edit)</span>
          <span role="columnheader">Net / hour</span>
        </div>
        {rows.map((row) => (
          <div className="profit-table__row" role="row" key={row.id}>
            <span role="cell" className="profit-table__name">
              <i style={{ background: row.color }} />
              {row.name}
              <small>{row.recordIds.length} records</small>
            </span>
            <strong role="cell">{row.recordIds.length ? money(row.netMinor) : '—'}</strong>
            <span role="cell">
              <input
                aria-label={`${row.name} hours in ${monthLong(period)}`}
                inputMode="decimal"
                defaultValue={hours[row.id]}
                key={`${period}-${row.id}-${hours[row.id]}`}
                onBlur={(event) => update(row.id, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
              />
            </span>
            <strong role="cell" className={row.id === best?.id ? 'is-best' : ''}>
              {row.perHour ? `$${row.perHour}` : '—'}
            </strong>
          </div>
        ))}
      </div>
      {error ? (
        <p className="callout is-error" role="alert">
          {error}
        </p>
      ) : null}
      <p className="card-footnote">
        Hours are your input, not PayPal data. Unconfirmed payments stay out of activity totals
        until you confirm them.
      </p>
    </section>
  );
}

function ForecastCard() {
  const { period, state } = useWorkspace();
  const forecast = forecast30Days(period);
  const tax = taxSetAside(period, state);
  const hasOverdue = forecast.overdueMinor > 0n;
  const max =
    Number(
      forecast.invoicedMinor > forecast.runRateMinor
        ? forecast.invoicedMinor
        : forecast.runRateMinor,
    ) || 1;
  return (
    <section className="card forecast-card">
      <CardHeader
        title="Next 30 days"
        eyebrow="Plan from verified cash"
        icon={<CalendarClock size={16} />}
      />
      <div className="forecast-bars">
        <div>
          <span>3-month run rate</span>
          <div className="meter is-large">
            <i style={{ width: `${(Number(forecast.runRateMinor) / max) * 100}%` }} />
          </div>
          <strong>{money(forecast.runRateMinor)}</strong>
          <small>Average net of {forecast.basisMonths.map(monthName).join(', ')}</small>
        </div>
        <div>
          <span>Open invoices due</span>
          <div className="meter is-large is-alt">
            <i style={{ width: `${(Number(forecast.invoicedMinor) / max) * 100}%` }} />
          </div>
          <strong>{money(forecast.invoicedMinor)}</strong>
          <small>{money(forecast.invoicedNetMinor)} after standard PayPal fees</small>
        </div>
      </div>
      {hasOverdue ? (
        <p className="callout is-warning">
          {money(forecast.overdueMinor)} is already overdue. Chasing it first protects next month’s
          cash.
        </p>
      ) : null}
      <div className="forecast-card__tax">
        <div>
          <span>Set aside for taxes ({monthName(period)})</span>
          <strong>{money(tax)}</strong>
        </div>
        <Link className="text-link" href="/app/settings#preferences">
          {state.taxRatePercent}% of profit · change <ArrowRight size={12} />
        </Link>
      </div>
      <p className="card-footnote">
        A planning baseline, not a promise. AI can explain it; it cannot change it.
      </p>
    </section>
  );
}
