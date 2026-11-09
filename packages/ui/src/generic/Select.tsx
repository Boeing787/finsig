import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cx } from '../utils/cx';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { children, className, label, id, ...props },
  ref,
) {
  const selectId = id ?? props.name;
  return (
    <label className="fs-field" htmlFor={selectId}>
      {label ? <span className="fs-field__label">{label}</span> : null}
      <span className="fs-select-wrap">
        <select ref={ref} id={selectId} className={cx('fs-select', className)} {...props}>
          {children}
        </select>
        <ChevronDown aria-hidden="true" size={15} />
      </span>
    </label>
  );
});
