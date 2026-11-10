'use client';

import { cx } from '../utils/cx';

export interface WaterfallStep {
  key: string;
  label: string;
  value: number;
  detail?: string;
  onSelect?: () => void;
}

export interface WaterfallProps {
  start: { label: string; value: number };
  steps: WaterfallStep[];
  end: { label: string; value: number };
  formatValue: (value: number, signed?: boolean) => string;
  className?: string;
}

/** Horizontal bridge: every step floats from the running total, so the chart reconciles visually. */
export function Waterfall({ start, steps, end, formatValue, className }: WaterfallProps) {
  const spans = steps.map((step, index) => {
    const from = steps.slice(0, index).reduce((sum, previous) => sum + previous.value, start.value);
    return { ...step, from, to: from + step.value };
  });
  const extent = Math.max(
    start.value,
    end.value,
    ...spans.map((span) => Math.max(span.from, span.to)),
    1,
  );
  const pct = (value: number) => `${(Math.max(0, value) / extent) * 100}%`;
  return (
    <div className={cx('fs-waterfall', className)}>
      <div className="fs-waterfall__row is-total">
        <span className="fs-waterfall__label">{start.label}</span>
        <div className="fs-waterfall__track">
          <i className="is-total" style={{ left: 0, width: pct(start.value) }} />
        </div>
        <strong>{formatValue(start.value)}</strong>
      </div>
      {spans.map((span) => {
        const left = Math.min(span.from, span.to);
        const width = Math.abs(span.to - span.from);
        const Row = span.onSelect ? 'button' : 'div';
        return (
          <Row
            key={span.key}
            className={cx('fs-waterfall__row', span.onSelect && 'is-interactive')}
            onClick={span.onSelect}
            type={span.onSelect ? 'button' : undefined}
          >
            <span className="fs-waterfall__label">
              {span.label}
              {span.detail ? <small>{span.detail}</small> : null}
            </span>
            <div className="fs-waterfall__track">
              <i
                className={span.value < 0 ? 'is-negative' : 'is-positive'}
                style={{ left: pct(left), width: `max(4px, ${pct(width)})` }}
              />
            </div>
            <strong className={span.value < 0 ? 'is-negative' : 'is-positive'}>
              {formatValue(span.value, true)}
            </strong>
          </Row>
        );
      })}
      <div className="fs-waterfall__row is-total is-end">
        <span className="fs-waterfall__label">{end.label}</span>
        <div className="fs-waterfall__track">
          <i className="is-total is-brand" style={{ left: 0, width: pct(end.value) }} />
        </div>
        <strong>{formatValue(end.value)}</strong>
      </div>
    </div>
  );
}
