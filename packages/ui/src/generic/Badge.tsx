import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../utils/cx';

type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  icon?: ReactNode;
}

export function Badge({ children, className, tone = 'neutral', icon, ...props }: BadgeProps) {
  return (
    <span className={cx('fs-badge', `fs-badge--${tone}`, className)} {...props}>
      {icon}
      {children}
    </span>
  );
}
