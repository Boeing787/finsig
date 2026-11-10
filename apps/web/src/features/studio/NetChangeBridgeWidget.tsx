'use client';

import type { AgWidgetParams } from 'ag-studio';
import { BadgeCheck } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import type { BridgeWidgetState, FinSigStudioContext } from './types';

const usd = (value: number, signed = false) =>
  new Intl.NumberFormat('en-US', {
    currency: 'USD',
    style: 'currency',
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(value);

const cents = (value: number) => Math.round(value * 100);

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * The verified bridge: previous net, one floating bar per factor from the running total, current
 * net. Every amount is computed by FinSig's domain code and passed in through Studio's context;
 * selecting a factor narrows the evidence ledger to the PayPal records behind it.
 */
export function NetChangeBridgeWidget({
  context,
}: AgWidgetParams<BridgeWidgetState, unknown, FinSigStudioContext>) {
  const { bridge, evidence, previousNetUsd, currentNetUsd, deltaUsd } = context;
  const selected = useSyncExternalStore(evidence.subscribe, evidence.get, () => null);

  const steps = bridge.reduce<{ from: number; to: number; item: (typeof bridge)[number] }[]>(
    (rows, item) => {
      const from = rows.length ? rows[rows.length - 1]!.to : previousNetUsd;
      return [...rows, { from, to: from + item.value_usd, item }];
    },
    [],
  );
  const values = [0, previousNetUsd, currentNetUsd, ...steps.flatMap((s) => [s.from, s.to])];
  const low = Math.min(...values);
  const high = Math.max(...values);
  const position = (value: number) => ((value - low) / (high - low || 1)) * 100;
  const span = (a: number, b: number) => ({
    left: `${position(Math.min(a, b))}%`,
    width: `max(3px, ${position(Math.max(a, b)) - position(Math.min(a, b))}%)`,
  });
  const reconciles =
    bridge.reduce((sum, item) => sum + cents(item.value_usd), 0) === cents(deltaUsd) &&
    cents(previousNetUsd) + cents(deltaUsd) === cents(currentNetUsd);

  return (
    <section className="fs-bridge" aria-label="Verified net income bridge">
      <header className="fs-bridge__head">
        <div>
          <p>Verified bridge</p>
          <h3>What changed, factor by factor</h3>
        </div>
      </header>

      <ol className="fs-bridge__rows">
        <li className="fs-bridge__row is-total">
          <div className="fs-bridge__line">
            <span>{context.previousLabel} net income</span>
            <strong>{usd(previousNetUsd)}</strong>
          </div>
          <div className="fs-bridge__track" aria-hidden="true">
            <i className="is-base" style={span(0, previousNetUsd)} />
          </div>
        </li>
        {steps.map(({ from, to, item }) => {
          const isSelected = selected?.id === item.id;
          const tone = item.value_usd < 0 ? 'is-down' : 'is-up';
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`fs-bridge__row is-factor ${tone} ${isSelected ? 'is-selected' : ''} ${
                  selected && !isSelected ? 'is-dimmed' : ''
                }`}
                aria-pressed={isSelected}
                onClick={() =>
                  evidence.set(
                    isSelected
                      ? null
                      : { id: item.id, label: item.label, recordIds: item.record_ids },
                  )
                }
              >
                <span className="fs-bridge__line">
                  <span>
                    {item.label.replace(/ payments$/u, '')}
                    <small>{plural(item.record_ids.length, 'record')}</small>
                  </span>
                  <strong>{usd(item.value_usd, true)}</strong>
                </span>
                <span className="fs-bridge__track" aria-hidden="true">
                  <i className={tone} style={span(from, to)} />
                </span>
              </button>
            </li>
          );
        })}
        <li className="fs-bridge__row is-total is-end">
          <div className="fs-bridge__line">
            <span>{context.periodLabel} net income</span>
            <strong>{usd(currentNetUsd)}</strong>
          </div>
          <div className="fs-bridge__track" aria-hidden="true">
            <i className="is-current" style={span(0, currentNetUsd)} />
          </div>
        </li>
      </ol>

      <footer className="fs-bridge__foot">
        <div>
          <span>
            Verified net change
            {reconciles ? (
              <span className="fs-bridge__check">
                <BadgeCheck size={13} /> Adds up exactly
              </span>
            ) : null}
          </span>
          <strong className={deltaUsd < 0 ? 'is-down' : 'is-up'}>{usd(deltaUsd, true)}</strong>
        </div>
        <p>
          {selected ? (
            <>
              Evidence ledger: {plural(selected.recordIds.length, 'record')} for {selected.label}.{' '}
              <button type="button" onClick={() => evidence.set(null)}>
                Show all changes
              </button>
            </>
          ) : (
            <>
              Evidence ledger: the {plural(context.changedRecordIds.length, 'PayPal record')} behind
              this change. Select a factor to narrow it.
            </>
          )}
        </p>
      </footer>
    </section>
  );
}
