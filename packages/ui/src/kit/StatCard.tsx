import type { HTMLAttributes } from 'react';
import { cx } from '../utils/cx';

export interface StatCardProps extends HTMLAttributes<HTMLElement> {
  label: string;
  value: string;
  detail?: string;
  trend?: 'up' | 'down' | 'neutral';
  featured?: boolean;
}

export function StatCard({
  label,
  value,
  detail,
  trend = 'neutral',
  featured = false,
  className,
  ...props
}: StatCardProps) {
  return (
    <article className={cx('fs-stat', featured && 'fs-stat--featured', className)} {...props}>
      <span className="fs-stat__label">{label}</span>
      <strong className={cx('fs-stat__value', `fs-stat__value--${trend}`)}>{value}</strong>
      {detail ? <small className="fs-stat__detail">{detail}</small> : null}
    </article>
  );
}
