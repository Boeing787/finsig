'use client';

import { useEffect, useId, useRef, useState } from 'react';

/** Measures an element's content box so charts render at true pixel size (crisp text). */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = (next: number) =>
      setWidth((previous) => (Math.abs(previous - next) > 0.5 ? next : previous));
    // Measure once immediately so charts render even before (or without) a resize callback.
    update(element.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => update(entries[0]?.contentRect.width ?? 0));
    observer.observe(element);
    const onResize = () => update(element.getBoundingClientRect().width);
    window.addEventListener('resize', onResize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, []);
  return [ref, width] as const;
}

export interface Point {
  x: number;
  y: number;
}

/** Monotone cubic interpolation (Fritsch–Carlson): smooth, never overshoots the data. */
export function smoothPath(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M${points[0]!.x},${points[0]!.y}`;
  const n = points.length;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx.push(points[i + 1]!.x - points[i]!.x);
    slope.push((points[i + 1]!.y - points[i]!.y) / dx[i]!);
  }
  const tangent: number[] = [slope[0]!];
  for (let i = 1; i < n - 1; i += 1) {
    const a = slope[i - 1]!;
    const b = slope[i]!;
    tangent.push(
      a * b <= 0
        ? 0
        : (3 * (dx[i - 1]! + dx[i]!)) /
            ((2 * dx[i]! + dx[i - 1]!) / a + (dx[i]! + 2 * dx[i - 1]!) / b),
    );
  }
  tangent.push(slope[n - 2]!);
  let path = `M${points[0]!.x},${points[0]!.y}`;
  for (let i = 0; i < n - 1; i += 1) {
    const p0 = points[i]!;
    const p1 = points[i + 1]!;
    const h = dx[i]! / 3;
    path += ` C${p0.x + h},${p0.y + tangent[i]! * h} ${p1.x - h},${p1.y - tangent[i + 1]! * h} ${p1.x},${p1.y}`;
  }
  return path;
}

/** Rounded tick step (1, 2, 2.5, 5 × 10ⁿ) covering [0, max] in about `count` ticks. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((m) => m >= raw) ?? raw;
  const ticks: number[] = [];
  for (let value = 0; value <= max + step * 0.001; value += step) ticks.push(value);
  if (ticks[ticks.length - 1]! < max) ticks.push(ticks[ticks.length - 1]! + step);
  return ticks;
}

export const compactNumber = (value: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

/** SSR-stable, CSS-safe id for SVG gradients and filters. */
export function useChartId(prefix: string) {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/gu, '')}`;
}
