import { forwardRef, type InputHTMLAttributes } from 'react';
import { cx } from '../utils/cx';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, hint, error, id, ...props },
  ref,
) {
  const inputId = id ?? props.name;
  const descriptionId = inputId ? `${inputId}-description` : undefined;
  return (
    <label className="fs-field" htmlFor={inputId}>
      {label ? <span className="fs-field__label">{label}</span> : null}
      <input
        ref={ref}
        id={inputId}
        className={cx('fs-input', error && 'fs-input--error', className)}
        aria-invalid={Boolean(error)}
        aria-describedby={hint || error ? descriptionId : undefined}
        {...props}
      />
      {hint || error ? (
        <span id={descriptionId} className={cx('fs-field__hint', error && 'fs-field__error')}>
          {error ?? hint}
        </span>
      ) : null}
    </label>
  );
});
