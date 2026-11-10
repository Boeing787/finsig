'use client';

import { Bot, Check, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import {
  activities,
  activityName,
  money,
  recordById,
  resolvedActivity,
  shortDate,
  unassignedSales,
  type ActivityId,
} from '../../domain/workspace';
import { requestClassification, type Classification } from './ai';
import { ClientAvatar } from './parts';
import { useWorkspace } from './WorkspaceProvider';

const fieldLabels: Record<string, string> = {
  transaction_subject: 'Subject',
  item_name: 'Item',
  counterparty: 'Counterparty',
};

/** Human-in-the-loop queue: AI proposes an activity with quoted evidence; the person confirms. */
export function ReviewQueue({
  compact = false,
  recordIds,
}: {
  compact?: boolean;
  recordIds?: string[];
}) {
  const { state, confirmActivity } = useWorkspace();
  const [suggestions, setSuggestions] = useState<Record<string, Classification>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justConfirmed, setJustConfirmed] = useState<{ id: string; activity: ActivityId } | null>(
    null,
  );
  const queue = unassignedSales(state).filter(
    (record) => !recordIds || recordIds.includes(record.id),
  );

  async function suggest(recordId: string) {
    setBusy(recordId);
    setError(null);
    try {
      const result = await requestClassification(recordId);
      setSuggestions((previous) => ({ ...previous, [recordId]: result }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'AI request failed.');
    } finally {
      setBusy(null);
    }
  }

  function confirm(recordId: string, activityId: ActivityId) {
    confirmActivity(recordId, activityId);
    setJustConfirmed({ id: recordId, activity: activityId });
  }

  return (
    <section className={`card review-card ${compact ? 'is-compact' : ''}`}>
      <header className="review-card__head">
        <span className="ai-badge">
          <Bot size={15} />
        </span>
        <div>
          <h2>
            {queue.length
              ? `${queue.length} payment${queue.length > 1 ? 's need' : ' needs'} a category`
              : 'Everything is categorised'}
          </h2>
          <p>AI proposes from the PayPal fields. You decide.</p>
        </div>
      </header>
      {justConfirmed ? (
        <p className="callout is-success">
          <Check size={14} /> {recordById.get(justConfirmed.id)?.counterparty} assigned to{' '}
          {activityName(justConfirmed.activity)}
          {recordById.get(`${justConfirmed.id}-refund`) &&
          resolvedActivity(recordById.get(`${justConfirmed.id}-refund`)!, state)
            ? ' — its linked refund followed.'
            : '.'}{' '}
          Totals did not change; per-hour figures did.
        </p>
      ) : null}
      {queue.map((record) => {
        const suggestion = suggestions[record.id];
        return (
          <article key={record.id} className="review-item">
            <div className="review-item__record">
              {record.clientId ? <ClientAvatar clientId={record.clientId} size={34} /> : null}
              <div>
                <strong>{record.counterparty}</strong>
                <span>
                  {record.subject} · {shortDate(record.initiatedAt)}
                </span>
              </div>
              <strong className="review-item__amount">{money(record.amountMinor)}</strong>
            </div>
            {suggestion ? (
              <div className="suggestion">
                <p className="suggestion__label">AI suggestion · {suggestion.model}</p>
                <h3>
                  {suggestion.activity_id
                    ? activityName(suggestion.activity_id)
                    : 'Needs clarification'}
                </h3>
                <ul>
                  {suggestion.evidence.map((item) => (
                    <li key={item.field}>
                      <span>{fieldLabels[item.field] ?? item.field}</span> “{item.value}”
                    </li>
                  ))}
                </ul>
                {suggestion.question ? (
                  <p className="suggestion__question">{suggestion.question}</p>
                ) : null}
                <div className="suggestion__actions">
                  {suggestion.activity_id ? (
                    <button
                      type="button"
                      className="fs-button fs-button--primary fs-button--sm"
                      onClick={() => confirm(record.id, suggestion.activity_id!)}
                    >
                      <Check size={14} /> Confirm {activityName(suggestion.activity_id)}
                    </button>
                  ) : null}
                  {activities
                    .filter((activity) => activity.id !== suggestion.activity_id)
                    .map((activity) => (
                      <button
                        key={activity.id}
                        type="button"
                        className="chip"
                        onClick={() => confirm(record.id, activity.id)}
                      >
                        {activity.name}
                      </button>
                    ))}
                </div>
              </div>
            ) : (
              <div className="review-item__actions">
                <button
                  type="button"
                  className="fs-button fs-button--secondary fs-button--sm"
                  onClick={() => void suggest(record.id)}
                  disabled={busy !== null}
                >
                  {busy === record.id ? <span className="fs-spinner" /> : <Bot size={14} />}
                  {busy === record.id ? 'Reading evidence…' : 'Suggest with AI'}
                </button>
                {!compact
                  ? activities.map((activity) => (
                      <button
                        key={activity.id}
                        type="button"
                        className="chip"
                        onClick={() => confirm(record.id, activity.id)}
                      >
                        {activity.name}
                      </button>
                    ))
                  : null}
              </div>
            )}
          </article>
        );
      })}
      {error ? (
        <p className="callout is-error" role="alert">
          {error}
        </p>
      ) : null}
      <p className="review-card__foot">
        <ShieldCheck size={12} /> Classification never changes a PayPal amount.
      </p>
    </section>
  );
}
