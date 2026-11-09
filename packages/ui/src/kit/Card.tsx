import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../utils/cx';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  eyebrow?: string;
  title?: string;
  action?: ReactNode;
  as?: 'article' | 'section' | 'div';
}

export function Card({
  children,
  className,
  eyebrow,
  title,
  action,
  as: Element = 'section',
  ...props
}: CardProps) {
  return (
    <Element className={cx('fs-card', className)} {...props}>
      {eyebrow || title || action ? (
        <header className="fs-card__header">
          <div>
            {eyebrow ? <p className="fs-eyebrow">{eyebrow}</p> : null}
            {title ? <h2 className="fs-card__title">{title}</h2> : null}
          </div>
          {action}
        </header>
      ) : null}
      {children}
    </Element>
  );
}
