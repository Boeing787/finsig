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
import { PLAN_HORIZON_DAYS } from '../../domain/cashplan';
import {
  AS_OF,
  DEFAULT_PERIOD,
  initialWorkspaceState,
  PERIODS,
  type ActivityId,
  type ExpectationInput,
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
  /** Count a detected candidate or overdue invoice in the 30-day plan. */
  confirmExpectation: (id: string) => void;
  /** Remove an event from the plan: an entry you added, or a detected one that stopped. */
  removeExpectation: (id: string) => void;
  addExpectation: (input: {
    direction: 'in' | 'out';
    label: string;
    amount: string;
    date: string;
  }) => string | null;
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
  expectations: z
    .object({
      confirmed: z.array(z.string().max(80)).max(50),
      dismissed: z.array(z.string().max(80)).max(50),
      added: z
        .array(
          z.object({
            id: z.string().regex(/^user-[a-z0-9-]{1,48}$/u),
            direction: z.enum(['in', 'out']),
            label: z.string().min(1).max(60),
            amountMinor: z.string().regex(/^\d{1,10}$/u),
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
          }),
        )
        .max(20),
    })
    .optional(),
});

const DAY = 86_400_000;
const planWindow = () => {
  const start = Date.parse(AS_OF.slice(0, 10));
  return { start, end: start + PLAN_HORIZON_DAYS * DAY };
};

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
        expectations: saved.expectations
          ? {
              confirmed: saved.expectations.confirmed,
              dismissed: saved.expectations.dismissed,
              added: saved.expectations.added.map((entry): ExpectationInput => ({
                ...entry,
                amountMinor: BigInt(entry.amountMinor),
              })),
            }
          : initialWorkspaceState.expectations,
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
        expectations: {
          ...state.expectations,
          added: state.expectations.added.map((entry) => ({
            ...entry,
            amountMinor: entry.amountMinor.toString(),
          })),
        },
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
      confirmExpectation: (id) =>
        setState((previous) => ({
          ...previous,
          expectations: {
            ...previous.expectations,
            confirmed: [...new Set([...previous.expectations.confirmed, id])],
          },
        })),
      removeExpectation: (id) =>
        setState((previous) => {
          const { expectations } = previous;
          const isEntry = expectations.added.some((entry) => entry.id === id);
          return {
            ...previous,
            expectations: isEntry
              ? { ...expectations, added: expectations.added.filter((entry) => entry.id !== id) }
              : {
                  ...expectations,
                  confirmed: expectations.confirmed.filter((item) => item !== id),
                  dismissed: [...new Set([...expectations.dismissed, id])],
                },
          };
        }),
      addExpectation: ({ direction, label, amount, date }) => {
        const name = label.replace(/[\u0000-\u001f\u007f]/gu, '').trim();
        if (name.length < 2 || name.length > 60) return 'Name it in 2–60 characters.';
        const value = amount.trim();
        if (!/^\d{1,7}(\.\d{1,2})?$/u.test(value) || Number(value) <= 0) {
          return 'Enter an amount in dollars, for example 240 or 79.99.';
        }
        const { start, end } = planWindow();
        const day = Date.parse(date);
        if (!/^\d{4}-\d{2}-\d{2}$/u.test(date) || !(day > start && day <= end)) {
          return 'Pick a date within the next 30 days.';
        }
        const [whole, cents = ''] = value.split('.');
        const amountMinor = BigInt(whole!) * 100n + BigInt(cents.padEnd(2, '0') || '0');
        const slug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/gu, '-')
          .replace(/^-|-$/gu, '')
          .slice(0, 30);
        const id = `user-${slug || 'entry'}-${Date.now().toString(36)}`;
        let error: string | null = null;
        setState((previous) => {
          if (previous.expectations.added.length >= 20) {
            error = 'You can keep up to 20 entries in the plan.';
            return previous;
          }
          return {
            ...previous,
            expectations: {
              ...previous.expectations,
              added: [
                ...previous.expectations.added,
                { id, direction, label: name, amountMinor, date },
              ],
            },
          };
        });
        return error;
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
