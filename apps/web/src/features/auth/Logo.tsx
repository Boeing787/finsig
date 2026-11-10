export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 34 34" aria-hidden="true">
      <defs>
        <linearGradient id="finsig-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9aa5ff" />
          <stop offset="100%" stopColor="#3f4be0" />
        </linearGradient>
      </defs>
      <rect width="34" height="34" rx="11" fill="url(#finsig-mark)" />
      <rect x="8.5" y="17" width="4.4" height="9" rx="2.2" fill="#fff" opacity="0.7" />
      <rect x="14.8" y="12.5" width="4.4" height="13.5" rx="2.2" fill="#fff" opacity="0.85" />
      <rect x="21.1" y="8" width="4.4" height="18" rx="2.2" fill="#fff" />
    </svg>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className={`logo ${light ? 'is-light' : ''}`}>
      <BrandMark />
      FinSig
    </span>
  );
}
