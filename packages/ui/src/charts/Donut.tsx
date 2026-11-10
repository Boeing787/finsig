'use client';

import { useState } from 'react';
import { cx } from '../utils/cx';

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface DonutProps {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerValue: string;
  centerLabel: string;
  formatValue?: (value: number) => string;
  className?: string;
}

export function Donut({
  segments,
  size = 168,
  thickness = 18,
  centerValue,
  centerLabel,
  formatValue,
  className,
}: DonutProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = segments.length > 1 ? 4 : 0;
  const offsets = segments.map((_, index) =>
    segments
      .slice(0, index)
      .reduce((sum, segment) => sum + (segment.value / total) * circumference, 0),
  );
  const active = segments.find((segment) => segment.key === hovered);
  return (
    <div className={cx('fs-donut', className)} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        role="img"
        aria-label={`${centerLabel}: ${segments.map((s) => `${s.label} ${Math.round((s.value / total) * 100)}%`).join(', ')}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="fs-donut__track"
          strokeWidth={thickness}
        />
        {segments.map((segment, index) => {
          const length = (segment.value / total) * circumference;
          const dash = Math.max(0.1, length - gap);
          return (
            <circle
              key={segment.key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={hovered === segment.key ? thickness + 4 : thickness}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-(offsets[index] ?? 0)}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              className={cx('fs-donut__segment', hovered && hovered !== segment.key && 'is-dimmed')}
              onMouseEnter={() => setHovered(segment.key)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}
      </svg>
      <div className="fs-donut__center">
        <strong>{active ? `${Math.round((active.value / total) * 100)}%` : centerValue}</strong>
        <span>{active ? active.label : centerLabel}</span>
        {active && formatValue ? <small>{formatValue(active.value)}</small> : null}
      </div>
    </div>
  );
}
