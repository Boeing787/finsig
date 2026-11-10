'use client';

import { cx } from '../utils/cx';
import { useChartId } from './utils';

export interface GaugeProps {
  value: number;
  label: string;
  caption?: string;
  ticks?: number[];
  size?: number;
  className?: string;
}

/** Semicircular progress gauge; `value` is a ratio (1 = 100%) and may exceed 1. */
export function Gauge({
  value,
  label,
  caption,
  ticks = [0, 25, 50, 75, 100],
  size = 240,
  className,
}: GaugeProps) {
  const id = useChartId('gauge');
  const stroke = size * 0.075;
  const radius = size / 2 - stroke - 16;
  const cx0 = size / 2;
  const cy0 = size / 2 + 4;
  const clamped = Math.min(1, Math.max(0, value));
  const angle = Math.PI * (1 - clamped);
  const point = (theta: number, r = radius) => ({
    x: cx0 + r * Math.cos(theta),
    y: cy0 - r * Math.sin(theta),
  });
  const start = point(Math.PI);
  const end = point(0);
  const knob = point(angle);
  const track = `M${start.x},${start.y} A${radius},${radius} 0 0 1 ${end.x},${end.y}`;
  const length = Math.PI * radius;
  return (
    <div className={cx('fs-gauge', className)} style={{ width: size }}>
      <svg
        width={size}
        height={size / 2 + stroke + 14}
        role="img"
        aria-label={`${label}: ${Math.round(value * 100)}%`}
      >
        <defs>
          <linearGradient id={`${id}-grad`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#a5aeff" />
            <stop offset="100%" stopColor="#4652ea" />
          </linearGradient>
        </defs>
        <path d={track} className="fs-gauge__track" strokeWidth={stroke} />
        <path
          d={track}
          className="fs-gauge__value"
          stroke={`url(#${id}-grad)`}
          strokeWidth={stroke}
          strokeDasharray={`${length * clamped} ${length}`}
        />
        {ticks.map((tick) => {
          const t = point(Math.PI * (1 - tick / 100), radius + stroke / 2 + 12);
          return (
            <text
              key={tick}
              x={t.x}
              y={t.y}
              textAnchor="middle"
              dy="0.32em"
              className="fs-gauge__tick"
            >
              {tick}
            </text>
          );
        })}
        <circle cx={knob.x} cy={knob.y} r={stroke * 0.62} className="fs-gauge__knob" />
      </svg>
      <div className="fs-gauge__center">
        <strong>{Math.round(value * 100)}%</strong>
        <span>{label}</span>
        {caption ? <small>{caption}</small> : null}
      </div>
    </div>
  );
}
