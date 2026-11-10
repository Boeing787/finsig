'use client';

import { usePathname } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * One overlay at a time. Opening the notifications panel, a record drawer or the mobile menu
 * closes whichever overlay was open; Escape closes the active one; navigation closes menus.
 */
export type OverlayId = 'notifications' | 'record' | 'nav';

interface OverlayContextValue {
  active: OverlayId | null;
  open: (id: OverlayId) => void;
  close: (id?: OverlayId) => void;
  toggle: (id: OverlayId) => void;
}

const OverlayContext = createContext<OverlayContextValue | null>(null);

export function OverlayProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<OverlayId | null>(null);
  const pathname = usePathname();

  const close = useCallback(
    (id?: OverlayId) => setActive((current) => (!id || current === id ? null : current)),
    [],
  );

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActive(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  // A route change dismisses menus; a record drawer opened by the destination page stays open.
  useEffect(() => {
    const task = window.setTimeout(
      () => setActive((current) => (current === 'record' ? current : null)),
      0,
    );
    return () => window.clearTimeout(task);
  }, [pathname]);

  const value = useMemo<OverlayContextValue>(
    () => ({
      active,
      open: setActive,
      close,
      toggle: (id) => setActive((current) => (current === id ? null : id)),
    }),
    [active, close],
  );

  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>;
}

export function useOverlay(): OverlayContextValue {
  const context = useContext(OverlayContext);
  if (!context) throw new Error('useOverlay must be used inside OverlayProvider.');
  return context;
}

/** Click-to-dismiss backdrop shared by every overlay. */
export function Scrim({ onClose, className = '' }: { onClose: () => void; className?: string }) {
  return <div className={`overlay-scrim ${className}`} aria-hidden="true" onClick={onClose} />;
}
