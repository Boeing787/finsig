import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../utils/cx';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  isLoading?: boolean;
}

export function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  leadingIcon,
  trailingIcon,
  isLoading = false,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      className={cx('fs-button', `fs-button--${variant}`, `fs-button--${size}`, className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      type={type}
      {...props}
    >
      {isLoading ? <span className="fs-spinner" aria-hidden="true" /> : leadingIcon}
      <span>{children}</span>
      {!isLoading && trailingIcon}
    </button>
  );
}
