'use client';

import { useState, type KeyboardEvent } from 'react';
import { cx } from '../utils/cx';
import { compactNumber, niceTicks, useChartId, useElementWidth } from './utils';

export interface BarDatum {
  key: string;
  label: string;
  value: number;
}

export interface BarChartProps {
  data: BarDatum[];
  selectedKey?: string;
  onSelect?: (key: string) => void;
  height?: number;
  formatValue?: (value: number) => string;
  formatTick?: (value: number) => string;
  ariaLabel: string;
  className?: string;
}

/** Column chart with an emphasised selected bar, hover preview and a floating value pill. */
export function BarChart({
  data,
  selectedKey,
  onSelect,
  height = 240,
  formatValue = (value) => value.toLocaleString('en-US'),
  formatTick = (value) => `$${compactNumber(value)}`,
  ariaLabel,
  className,
}: BarChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hovered, setHovered] = useState<string | null>(null);
  const id = useChartId('bar');
  const margin = { top: 44, right: 4, bottom: 30, left: 44 };
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;
  const ticks = niceTicks(Math.max(...data.map((datum) => datum.value), 1));
  const max = ticks[ticks.length - 1] ?? 1;
  const band = data.length ? innerWidth / data.length : 0;
  const barWidth = Math.min(46, band * 0.62);
  const activeKey = hovered ?? selectedKey;
  const active = data.find((datum) => datum.key === activeKey);
  const y = (value: number) => margin.top + innerHeight - (Math.max(0, value) / max) * innerHeight;

  function onKey(event: KeyboardEvent<SVGGElement>, key: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect?.(key);
    }
  }

  return (
    <div ref={ref} className={cx('fs-chart fs-bar-chart', className)} style={{ height }}>
      {width > 0 ? (
        <svg width={width} height={height} role="group" aria-label={ariaLabel}>
          <defs>
            <linearGradient id={`${id}-active`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#97a3ff" />
              <stop offset="100%" stopColor="#4652ea" />
            </linearGradient>
            <linearGradient id={`${id}-idle`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#e4e8f7" />
              <stop offset="100%" stopColor="#f1f3fa" />
            </linearGradient>
            <filter id={`${id}-glow`} x="-50%" y="-20%" width="200%" height="160%">
              <feDropShadow
                dx="0"
                dy="10"
                stdDeviation="9"
                floodColor="#4f5df0"
                floodOpacity="0.32"
              />
            </filter>
          </defs>
          {ticks.map((tick) => (
            <g key={tick} className="fs-chart__tick">
              <line x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} />
              <text x={margin.left - 10} y={y(tick)} dy="0.32em" textAnchor="end">
                {formatTick(tick)}
              </text>
            </g>
          ))}
          {data.map((datum, index) => {
            const x = margin.left + band * index + (band - barWidth) / 2;
            const top = y(datum.value);
            const barHeight = Math.max(6, margin.top + innerHeight - top);
            const isActive = datum.key === activeKey;
            const isSelected = datum.key === selectedKey;
            return (
              <g
                key={datum.key}
                className={cx('fs-bar', isActive && 'is-active', isSelected && 'is-selected')}
                role={onSelect ? 'button' : 'img'}
                tabIndex={onSelect ? 0 : undefined}
                aria-pressed={onSelect ? isSelected : undefined}
                aria-label={`${datum.label}: ${formatValue(datum.value)}`}
                onMouseEnter={() => setHovered(datum.key)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(datum.key)}
                onBlur={() => setHovered(null)}
                onClick={() => onSelect?.(datum.key)}
                onKeyDown={(event) => onKey(event, datum.key)}
              >
                <rect
                  className="fs-bar__hit"
                  x={margin.left + band * index}
                  y={margin.top}
                  width={band}
                  height={innerHeight}
                />
                <rect
                  x={x}
                  y={margin.top + innerHeight - barHeight}
                  width={barWidth}
                  height={barHeight}
                  rx={Math.min(12, barWidth / 2)}
                  fill={isSelected ? `url(#${id}-active)` : `url(#${id}-idle)`}
                  filter={isSelected ? `url(#${id}-glow)` : undefined}
                  className="fs-bar__rect"
                />
                <text
                  className="fs-chart__label"
                  x={x + barWidth / 2}
                  y={height - 8}
                  textAnchor="middle"
                >
                  {datum.label}
                </text>
              </g>
            );
          })}
          {active ? (
            <BarTooltip
              x={margin.left + band * data.indexOf(active) + band / 2}
              y={y(active.value) - 12}
              text={formatValue(active.value)}
              width={width}
            />
          ) : null}
        </svg>
      ) : null}
    </div>
  );
}

function BarTooltip({ x, y, text, width }: { x: number; y: number; text: string; width: number }) {
  const pillWidth = Math.max(64, text.length * 7.4 + 22);
  const left = Math.min(Math.max(x - pillWidth / 2, 2), width - pillWidth - 2);
  return (
    <g className="fs-chart__tooltip" pointerEvents="none">
      <rect x={left} y={y - 28} width={pillWidth} height={26} rx={13} />
      <path d={`M${x - 5},${y - 2.5} L${x},${y + 3} L${x + 5},${y - 2.5} Z`} />
      <text x={left + pillWidth / 2} y={y - 15} dy="0.34em" textAnchor="middle">
        {text}
      </text>
    </g>
  );
}
