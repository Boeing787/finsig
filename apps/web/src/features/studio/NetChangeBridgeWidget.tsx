'use client';

import type { AgWidgetParams } from 'ag-studio';
import type { BridgeWidgetState, FinSigStudioContext } from './types';

const usd = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
});

export function NetChangeBridgeWidget({
  context,
}: AgWidgetParams<BridgeWidgetState, unknown, FinSigStudioContext>) {
  const maxMagnitude = Math.max(...context.bridge.map((item) => Math.abs(item.value_usd)), 1);

  return (
    <section className="fs-bridge-widget" aria-label="Net income change reconciliation">
      <header>
        <div>
          <p>Verified bridge</p>
          <h3>Why net income changed</h3>
        </div>
        <strong>{usd.format(context.deltaUsd)}</strong>
      </header>
      <div className="fs-bridge-widget__range">
        <span>{usd.format(context.previousNetUsd)}</span>
        <div aria-hidden="true">
          <i />
        </div>
        <span>{usd.format(context.currentNetUsd)}</span>
      </div>
      <div className="fs-bridge-widget__factors">
        {context.bridge.map((item) => (
          <article key={item.id}>
            <div>
              <span>{item.label}</span>
              <strong className={item.value_usd < 0 ? 'is-negative' : 'is-positive'}>
                {usd.format(item.value_usd)}
              </strong>
            </div>
            <div className="fs-bridge-widget__bar" aria-hidden="true">
              <i
                className={item.value_usd < 0 ? 'is-negative' : 'is-positive'}
                style={{
                  width: `${Math.max(8, (Math.abs(item.value_usd) / maxMagnitude) * 100)}%`,
                }}
              />
            </div>
            <small>{item.record_ids.length} linked source records</small>
          </article>
        ))}
      </div>
      <footer>
        <span>Code-calculated</span>
        <span>Source-linked</span>
        <span>Reconciles exactly</span>
      </footer>
    </section>
  );
}
