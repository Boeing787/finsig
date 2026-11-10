'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { z } from 'zod';
import {
  DEFAULT_PERIOD,
  initialWorkspaceState,
  PERIODS,
  type ActivityId,
  type Period,
  type WorkspaceState,
} from '../../domain/workspace';
import type { LiveSyncResult } from '../../paypal/live-sync';

export interface SessionUser {
  mode: 'demo' | 'paypal';
  name: string;
  email: string | null;
  payerId: string | null;
  expiresAt: number;
}

export type LiveState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; result: Extract<LiveSyncResult, { ok: true }> }
  | { status: 'unconfigured' }
  | { status: 'error'; message: string };

interface WorkspaceContextValue {
  user: SessionUser;
  state: WorkspaceState;
  ready: boolean;
  period: Period;
  setPeriod: (period: Period) => void;
  confirmActivity: (recordId: string, activityId: ActivityId) => void;
  setHours: (month: string, activityId: ActivityId, value: string) => string | null;
  setTaxRate: (value: string) => string | null;
  setGoal: (value: string) => string | null;
  reset: () => void;
  live: LiveState;
  syncNow: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const storageKey = 'finsig-workspace-v2';

const storedSchema = z.object({
  confirmedActivityIds: z.record(z.string(), z.enum(['design', 'consulting', 'support'])),
  hours: z.record(z.string(), z.record(z.string(), z.string())),
  taxRatePercent: z.number().min(0).max(60),
  monthlyGoalMinor: z.string().regex(/^\d{1,9}$/u),
  period: z.enum(PERIODS).optional(),
});

function restore(): { state: WorkspaceState; period: Period } {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return { state: initialWorkspaceState, period: DEFAULT_PERIOD };
    const saved = storedSchema.parse(JSON.parse(raw));
    return {
      state: {
        confirmedActivityIds: saved.confirmedActivityIds,
        hours: saved.hours as WorkspaceState['hours'],
        taxRatePercent: saved.taxRatePercent,
        monthlyGoalMinor: BigInt(saved.monthlyGoalMinor),
      },
      period: saved.period ?? DEFAULT_PERIOD,
    };
  } catch {
    return { state: initialWorkspaceState, period: DEFAULT_PERIOD };
  }
}

function persist(state: WorkspaceState, period: Period) {
  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        confirmedActivityIds: state.confirmedActivityIds,
        hours: state.hours,
        taxRatePercent: state.taxRatePercent,
        monthlyGoalMinor: state.monthlyGoalMinor.toString(),
        period,
      }),
    );
  } catch {
    // Storage can be unavailable (private mode); the workspace still works for this visit.
  }
}

const liveResponse = z.union([
  z.object({ configured: z.literal(false) }),
  z.object({
    configured: z.literal(true),
    ok: z.literal(false),
    error: z.string(),
    fetchedAt: z.string(),
  }),
  z.object({
    configured: z.literal(true),
    ok: z.literal(true),
    fetchedAt: z.string(),
    refreshedAt: z.string().nullable(),
    windowStart: z.string(),
    windowEnd: z.string(),
    records: z.array(
      z.object({
        id: z.string(),
        eventCode: z.string(),
        initiatedAt: z.string(),
        status: z.string(),
        kind: z.enum(['sale', 'refund', 'review']),
        amountMinor: z.string(),
        feeMinor: z.string().nullable(),
        currency: z.string(),
        subject: z.string().nullable(),
        referencesRecord: z.string().nullable(),
      }),
    ),
    totals: z.object({
      grossMinor: z.string(),
      refundsMinor: z.string(),
      feesMinor: z.string(),
      netMinor: z.string(),
    }),
  }),
]);

export function WorkspaceProvider({ user, children }: { user: SessionUser; children: ReactNode }) {
  const [state, setState] = useState<WorkspaceState>(initialWorkspaceState);
  const [period, setPeriodState] = useState<Period>(DEFAULT_PERIOD);
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState<LiveState>({ status: 'idle' });

  useEffect(() => {
    const task = window.setTimeout(() => {
      const restored = restore();
      setState(restored.state);
      setPeriodState(restored.period);
      setReady(true);
    }, 0);
    return () => window.clearTimeout(task);
  }, []);

  useEffect(() => {
    if (ready) persist(state, period);
  }, [ready, state, period]);

  const syncNow = useCallback(async () => {
    setLive({ status: 'loading' });
    try {
      const response = await fetch('/api/paypal/sync', { cache: 'no-store' });
      const parsed = liveResponse.parse(await response.json());
      if (!parsed.configured) setLive({ status: 'unconfigured' });
      else if (!parsed.ok) setLive({ status: 'error', message: parsed.error });
      else setLive({ status: 'ready', result: parsed });
    } catch {
      setLive({ status: 'error', message: 'Could not reach the PayPal sync service.' });
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void syncNow(), 0);
    return () => window.clearTimeout(task);
  }, [syncNow]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      user,
      state,
      ready,
      period,
      setPeriod: setPeriodState,
      live,
      syncNow,
      confirmActivity: (recordId, activityId) =>
        setState((previous) => ({
          ...previous,
          confirmedActivityIds: { ...previous.confirmedActivityIds, [recordId]: activityId },
        })),
      setHours: (month, activityId, raw) => {
        const trimmed = raw.trim();
        if (!/^\d{1,3}(\.\d{1,2})?$/u.test(trimmed) || Number(trimmed) > 744) {
          return 'Hours must be 0–744 with at most two decimals.';
        }
        const parsed = Number(trimmed);
        setState((previous) => ({
          ...previous,
          hours: {
            ...previous.hours,
            [month]: { ...previous.hours[month], [activityId]: parsed.toFixed(2) },
          },
        }));
        return null;
      },
      setTaxRate: (raw) => {
        const parsed = Number(raw);
        if (!Number.isInteger(parsed) || parsed < 0 || parsed > 60) {
          return 'Use a whole percentage between 0 and 60.';
        }
        setState((previous) => ({ ...previous, taxRatePercent: parsed }));
        return null;
      },
      setGoal: (raw) => {
        const parsed = Number(raw);
        if (!Number.isInteger(parsed) || parsed < 100 || parsed > 1_000_000) {
          return 'Use a whole-dollar goal between $100 and $1,000,000.';
        }
        setState((previous) => ({ ...previous, monthlyGoalMinor: BigInt(parsed) * 100n }));
        return null;
      },
      reset: () => {
        setState(initialWorkspaceState);
        setPeriodState(DEFAULT_PERIOD);
        try {
          window.localStorage.removeItem(storageKey);
        } catch {
          // ignore
        }
      },
    }),
    [user, state, ready, period, live, syncNow],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used inside WorkspaceProvider.');
  return context;
}
