'use client';

import { useState, type PointerEvent } from 'react';
import { cx } from '../utils/cx';
import { smoothPath, useChartId, useElementWidth } from './utils';

export interface AreaDatum {
  key: string;
  label: string;
  value: number;
}

export interface AreaChartProps {
  data: AreaDatum[];
  height?: number;
  tone?: 'light' | 'onBrand';
  formatValue?: (value: number) => string;
  ariaLabel: string;
  showAxis?: boolean;
  className?: string;
}

/** Smooth trend line with gradient fill, end-point marker and a hover readout. */
export function AreaChart({
  data,
  height = 180,
  tone = 'light',
  formatValue = (value) => value.toLocaleString('en-US'),
  ariaLabel,
  showAxis = true,
  className,
}: AreaChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const id = useChartId('area');
  const margin = { top: 34, right: 18, bottom: showAxis ? 26 : 8, left: 18 };
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = height - margin.top - margin.bottom;
  const values = data.map((datum) => datum.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.18 || 1;
  const lo = min - pad;
  const hi = max + pad;
  const points = data.map((datum, index) => ({
    x: margin.left + (data.length > 1 ? (innerWidth * index) / (data.length - 1) : innerWidth / 2),
    y: margin.top + innerHeight - ((datum.value - lo) / (hi - lo)) * innerHeight,
  }));
  const line = smoothPath(points);
  const area = points.length
    ? `${line} L${points[points.length - 1]!.x},${margin.top + innerHeight} L${points[0]!.x},${margin.top + innerHeight} Z`
    : '';
  const focusIndex = hover ?? data.length - 1;
  const focus = points[focusIndex];
  const focusDatum = data[focusIndex];

  function onMove(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    let nearest = 0;
    points.forEach((point, index) => {
      if (Math.abs(point.x - x) < Math.abs(points[nearest]!.x - x)) nearest = index;
    });
    setHover(nearest);
  }

  return (
    <div
      ref={ref}
      className={cx('fs-chart fs-area-chart', `fs-area-chart--${tone}`, className)}
      style={{ height }}
    >
      {width > 0 && points.length ? (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
              <stop
                offset="0%"
                stopColor={tone === 'onBrand' ? '#ffffff' : '#6170f6'}
                stopOpacity={tone === 'onBrand' ? 0.34 : 0.24}
              />
              <stop
                offset="100%"
                stopColor={tone === 'onBrand' ? '#ffffff' : '#6170f6'}
                stopOpacity="0"
              />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${id}-fill)`} />
          <path d={line} className="fs-area-chart__line" />
          {focus ? (
            <g className="fs-area-chart__focus" pointerEvents="none">
              <line x1={focus.x} x2={focus.x} y1={focus.y} y2={margin.top + innerHeight} />
              <circle cx={focus.x} cy={focus.y} r={9} className="fs-area-chart__halo" />
              <circle cx={focus.x} cy={focus.y} r={4.5} className="fs-area-chart__dot" />
              {focusDatum ? (
                <text
                  x={Math.min(Math.max(focus.x, margin.left + 30), width - margin.right - 30)}
                  y={focus.y - 16}
                  textAnchor="middle"
                  className="fs-area-chart__value"
                >
                  {formatValue(focusDatum.value)}
                </text>
              ) : null}
            </g>
          ) : null}
          {showAxis
            ? data.map((datum, index) =>
                index % Math.ceil(data.length / 6) === 0 || index === data.length - 1 ? (
                  <text
                    key={datum.key}
                    x={points[index]!.x}
                    y={height - 6}
                    textAnchor="middle"
                    className="fs-chart__label"
                  >
                    {datum.label}
                  </text>
                ) : null,
              )
            : null}
        </svg>
      ) : null}
    </div>
  );
}
