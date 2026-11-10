'use client';

import { Check, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import {
  bridgeReconciles,
  initialWorkspaceState,
  PERIODS,
  unassignedSales,
  workspaceRecords,
} from '../../domain/workspace';
import { Logo } from './Logo';

type StepState = 'pending' | 'active' | 'done';

const syncSchema = z.object({
  configured: z.boolean(),
  ok: z.boolean().optional(),
  records: z.array(z.unknown()).optional(),
  refreshedAt: z.string().nullable().optional(),
});

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export function ConnectFlow({
  mode,
  name,
  startDemoSession = false,
}: {
  mode: 'demo' | 'paypal';
  name: string;
  startDemoSession?: boolean;
}) {
  const router = useRouter();
  const started = useRef(false);
  const [states, setStates] = useState<StepState[]>([
    'active',
    'pending',
    'pending',
    'pending',
    'pending',
  ]);
  const [details, setDetails] = useState<string[]>(['', '', '', '', '']);
  const [failed, setFailed] = useState<string | null>(null);
  const done = states.every((state) => state === 'done');

  const titles = [
    mode === 'paypal' ? 'Verifying your PayPal identity' : 'Opening a signed demo session',
    'Checking FinSig’s configured sandbox merchant',
    'Checking sample refunds and account corrections',
    'Preparing sample payments for category review',
    'Reconciling sample-history totals',
  ];

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const set = (index: number, detail: string) => {
      setDetails((previous) => previous.map((value, i) => (i === index ? detail : value)));
      setStates((previous) =>
        previous.map((value, i) => (i === index ? 'done' : i === index + 1 ? 'active' : value)),
      );
    };
    void (async () => {
      try {
        if (startDemoSession) {
          const response = await fetch('/api/auth/demo', { method: 'POST' });
          if (!response.ok) throw new Error('Could not start the demo session.');
        }
        await wait(500);
        set(
          0,
          mode === 'paypal'
            ? `Signed in as ${name} · OpenID Connect`
            : `Session signed for ${name} · 8 hours`,
        );

        const [sync] = await Promise.all([
          fetch('/api/paypal/sync', { cache: 'no-store' })
            .then((response) => response.json())
            .then((json) => syncSchema.safeParse(json))
            .catch(() => null),
          wait(900),
        ]);
        const live =
          sync?.success && sync.data.configured && sync.data.ok
            ? (sync.data.records?.length ?? 0)
            : null;
        set(
          1,
          live !== null
            ? `${live} live record${live === 1 ? '' : 's'} from FinSig’s sandbox merchant · ${workspaceRecords.length} sample records kept separate`
            : `No live merchant records returned · ${workspaceRecords.length} fictional sample records`,
        );

        await wait(650);
        const reviews = workspaceRecords.filter((record) => record.kind === 'review').length;
        const refunds = workspaceRecords.filter((record) => record.kind === 'refund').length;
        set(
          2,
          `${refunds} sample refunds linked to payments · ${reviews} sample correction held out of income`,
        );

        await wait(700);
        const open = unassignedSales(initialWorkspaceState).length;
        set(
          3,
          `${open} sample payment${open === 1 ? '' : 's'} to review · AI suggestions run only when you request one`,
        );

        await wait(650);
        const reconciled = PERIODS.slice(1).filter((period) => bridgeReconciles(period)).length;
        set(4, `${reconciled} sample month-over-month bridges reconcile to the cent`);

        await wait(700);
        router.replace('/app');
      } catch (error) {
        setFailed(error instanceof Error ? error.message : 'Sync failed.');
      }
    })();
  }, [mode, name, router, startDemoSession]);

  const progress = (states.filter((state) => state === 'done').length / states.length) * 100;

  return (
    <div className="connect">
      <div className="connect__card">
        <Logo />
        <h1>{done ? 'Your workspace is ready' : 'Preparing your finance workspace'}</h1>
        <p>
          {mode === 'paypal'
            ? 'PayPal verified your identity. Any live read is from FinSig’s configured sandbox merchant; the analytics below remain sample data.'
            : 'Demo workspace for a fictional freelancer — the same pipeline as a real account.'}
        </p>
        <div className="connect__progress" aria-hidden="true">
          <i style={{ width: `${progress}%` }} />
        </div>
        <ol className="connect__steps">
          {titles.map((title, index) => (
            <li key={title} className={`is-${states[index]}`}>
              <span className="connect__marker">
                {states[index] === 'done' ? (
                  <Check size={14} />
                ) : states[index] === 'active' ? (
                  <span className="fs-spinner" />
                ) : (
                  index + 1
                )}
              </span>
              <div>
                <strong>{title}</strong>
                {details[index] ? <small>{details[index]}</small> : null}
              </div>
            </li>
          ))}
        </ol>
        {failed ? (
          <p className="callout is-error" role="alert">
            {failed} <a href="/login">Back to sign in</a>
          </p>
        ) : (
          <p className="connect__foot">
            <ShieldCheck size={13} /> Amounts are calculated by code from PayPal records — never by
            AI.
          </p>
        )}
      </div>
    </div>
  );
}
