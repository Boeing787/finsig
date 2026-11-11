'use client';

import { CalendarClock, Check, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { cashPlan, type PlanEvent } from '../../domain/cashplan';
import { money, shortDate } from '../../domain/workspace';
import { CardHeader } from './parts';
import { useWorkspace } from './WorkspaceProvider';

const statusView: Record<PlanEvent['status'], { label: string; tone: string }> = {
  invoiced: { label: 'Invoiced', tone: 'is-brand' },
  pending_paypal: { label: 'Pending in PayPal', tone: 'is-brand' },
  observed_pattern: { label: 'Monthly pattern', tone: '' },
  user_entered: { label: 'Added by you', tone: 'is-success' },
  user_confirmed: { label: 'Confirmed by you', tone: 'is-success' },
  needs_confirmation: { label: 'Needs your OK', tone: 'is-warning' },
  overdue: { label: 'Overdue', tone: 'is-danger' },
};

/**
 * The AI manager's 30-day cash plan. Code builds every event and total from invoices, PayPal
 * pending payments, monthly patterns and the person's own entries; the person confirms what
 * a pattern alone cannot prove. Ask FinSig explains the plan but cannot change it.
 */
export function CashPlanCard() {
  const { state, confirmExpectation, removeExpectation, addExpectation } = useWorkspace();
  const plan = cashPlan(state);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    direction: 'out' as 'in' | 'out',
    label: '',
    amount: '',
    date: '',
  });
  const [error, setError] = useState<string | null>(null);
  const counted = plan.events.filter((event) => event.counted);
  const subscriptionsMinor = counted
    .filter((event) => event.status === 'observed_pattern' && event.direction === 'out')
    .reduce((total, event) => total + event.amountMinor, 0n);
  const incomeCount = counted.filter((event) => event.direction === 'in').length;

  function submit(event: FormEvent) {
    event.preventDefault();
    const problem = addExpectation(draft);
    setError(problem);
    if (!problem) {
      setDraft({ direction: draft.direction, label: '', amount: '', date: '' });
      setAdding(false);
    }
  }

  return (
    <section className="card cash-plan" id="cash-plan" aria-labelledby="cash-plan-title">
      <CardHeader
        title={<span id="cash-plan-title">Next 30 days</span>}
        eyebrow={`AI manager · cash plan ${shortDate(plan.asOf)} – ${shortDate(plan.horizonEnd)}`}
        icon={<CalendarClock size={16} />}
        action={
          <Link
            className="text-link"
            href="/app/insights?q=What%20should%20I%20expect%20over%20the%20next%2030%20days%3F"
          >
            Ask FinSig about it
          </Link>
        }
      />

      <div className="cash-plan__totals">
        <div>
          <span>Expected income</span>
          <strong className="is-in">{money(plan.inMinor)}</strong>
          <small>
            {incomeCount} payment{incomeCount === 1 ? '' : 's'} counted
          </small>
        </div>
        <div>
          <span>Est. PayPal fees</span>
          <strong>{money(plan.feesMinor)}</strong>
          <small>3.49% + $0.49 each</small>
        </div>
        <div>
          <span>Expected expenses</span>
          <strong>{money(-plan.outMinor)}</strong>
          <small>incl. {money(subscriptionsMinor)} subscriptions</small>
        </div>
        <div className="is-total">
          <span>Difference</span>
          <strong>{money(plan.differenceMinor)}</strong>
          <small>before other spending · not a balance or profit</small>
        </div>
      </div>

      {plan.awaitingMinor > 0n ? (
        <p className="callout is-warning">
          {money(plan.awaitingMinor)} more could arrive, but it isn’t counted until you confirm it
          below.
        </p>
      ) : null}

      <ol className="cash-plan__events">
        {plan.events.map((event) => {
          const view = statusView[event.status];
          const source = event.sourceRecordIds.at(-1);
          return (
            <li
              key={event.id}
              className={`is-${event.direction} ${event.counted ? '' : 'is-uncounted'}`}
            >
              <time dateTime={event.date}>{shortDate(event.date)}</time>
              <div className="cash-plan__item">
                <strong>{event.label}</strong>
                <span>
                  {event.basis}
                  {source ? (
                    <>
                      {' · '}
                      <Link href={`/app/transactions?record=${encodeURIComponent(source)}`}>
                        source
                      </Link>
                    </>
                  ) : null}
                </span>
              </div>
              <span className={`pill ${view.tone}`}>{view.label}</span>
              <strong className="cash-plan__amount">
                {event.direction === 'in' ? '+' : '−'}
                {money(event.amountMinor)}
              </strong>
              <div className="cash-plan__actions">
                {event.confirmable ? (
                  <button
                    type="button"
                    className="fs-button fs-button--quiet fs-button--sm"
                    onClick={() => confirmExpectation(event.id)}
                  >
                    <Check size={13} /> {event.status === 'overdue' ? 'Still expected' : 'Confirm'}
                  </button>
                ) : null}
                {event.removable ? (
                  <button
                    type="button"
                    className="cash-plan__remove"
                    aria-label={`Remove ${event.label} from the plan`}
                    title="Remove from the plan"
                    onClick={() => removeExpectation(event.id)}
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {adding ? (
        <form className="cash-plan__form" onSubmit={submit}>
          <select
            aria-label="Direction"
            value={draft.direction}
            onChange={(event) =>
              setDraft({ ...draft, direction: event.target.value as 'in' | 'out' })
            }
          >
            <option value="out">Expense</option>
            <option value="in">Payment</option>
          </select>
          <input
            aria-label="What is it"
            placeholder="e.g. Hosting renewal"
            value={draft.label}
            maxLength={60}
            onChange={(event) => setDraft({ ...draft, label: event.target.value })}
          />
          <input
            aria-label="Amount in USD"
            placeholder="Amount, USD"
            inputMode="decimal"
            value={draft.amount}
            onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
          />
          <input
            aria-label="Date"
            type="date"
            min={plan.asOf.slice(0, 10)}
            max={plan.horizonEnd}
            value={draft.date}
            onChange={(event) => setDraft({ ...draft, date: event.target.value })}
          />
          <button type="submit" className="fs-button fs-button--primary fs-button--sm">
            Add to plan
          </button>
          <button
            type="button"
            className="fs-button fs-button--quiet fs-button--sm"
            onClick={() => {
              setAdding(false);
              setError(null);
            }}
          >
            Cancel
          </button>
          {error ? (
            <p className="cash-plan__error" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      ) : (
        <button type="button" className="cash-plan__add" onClick={() => setAdding(true)}>
          <Plus size={14} /> Add an expected payment or expense
        </button>
      )}

      {plan.notForecast.length ? (
        <p className="card-footnote">
          Not forecast: {plan.notForecast.map((item) => item.label).join('; ')}. One payment so far,
          and FinSig doesn’t guess a renewal from one payment.
        </p>
      ) : null}
      <p className="card-footnote">
        Cash basis. Income counts when it’s invoiced, pending in PayPal or confirmed by you; a
        repeating payment alone isn’t a new order. Subscriptions come from three or more monthly
        payments. The AI explains this plan; it cannot change it. Sample data.
      </p>
    </section>
  );
}
