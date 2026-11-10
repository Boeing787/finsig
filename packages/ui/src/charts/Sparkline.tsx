'use client';

import { smoothPath, useChartId } from './utils';

export interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  ariaLabel?: string;
}

export function Sparkline({
  values,
  width = 96,
  height = 34,
  color = '#4f5df0',
  ariaLabel,
}: SparklineProps) {
  const id = useChartId('spark');
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => ({
    x: 2 + ((width - 4) * index) / (values.length - 1),
    y: 3 + (height - 6) * (1 - (value - min) / span),
  }));
  const line = smoothPath(points);
  const last = points[points.length - 1]!;
  return (
    <svg
      width={width}
      height={height}
      className="fs-sparkline"
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${line} L${last.x},${height} L${points[0]!.x},${height} Z`}
        fill={`url(#${id}-fill)`}
      />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx={last.x} cy={last.y} r="3" fill="#fff" stroke={color} strokeWidth="2" />
    </svg>
  );
}
