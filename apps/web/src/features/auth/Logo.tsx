import {
  LOGO_ASPECT,
  LOGO_VIEWBOX,
  MARK_ASPECT,
  MARK_PATH,
  MARK_VIEWBOX,
  WORDMARK_PATH,
} from './brandPaths';

/** The FinSig swoosh on its own, for the icon rail and the mobile top bar. `size` is its width. */
export function BrandMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      className={`brand-mark ${className}`}
      width={size}
      height={Math.round(size / MARK_ASPECT)}
      viewBox={MARK_VIEWBOX}
      aria-hidden="true"
      focusable="false"
    >
      <path d={MARK_PATH} />
    </svg>
  );
}

/**
 * Full lockup: the swoosh and the "finsig" wordmark. `light` is the all-white version for the
 * brand gradient panels. Colours come from `--fs-logo-mark` and `--fs-logo-ink`.
 */
export function Logo({ light = false, height = 28 }: { light?: boolean; height?: number }) {
  return (
    <svg
      className={`logo ${light ? 'is-light' : ''}`}
      width={Math.round(height * LOGO_ASPECT)}
      height={height}
      viewBox={LOGO_VIEWBOX}
      role="img"
      aria-label="FinSig"
      focusable="false"
    >
      <path className="logo__mark" d={MARK_PATH} />
      <path className="logo__word" d={WORDMARK_PATH} />
    </svg>
  );
}
