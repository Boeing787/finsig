'use client';

import { Badge, Button } from '@finsig/ui';
import {
  AgStudioAiModule,
  AgStudioLicenseManager,
  createAiHarness,
  type AgDataSourcesDefinition,
  type AgStudioApi,
} from 'ag-studio';
import { AgStudio } from 'ag-studio-react';
import { Bot, PencilRuler, RotateCcw, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { AnalyticsBridgeItem, AnalyticsRecord } from '../../../src/domain/analytics';
import { finSigLlmAdapter } from '../../../src/features/studio/adapter';
import { finSigInitialReport } from '../../../src/features/studio/report';
import { finSigStudioTheme } from '../../../src/features/studio/theme';
import type { FinSigStudioContext, FinSigStudioRegistry } from '../../../src/features/studio/types';
import { finSigWidgets } from '../../../src/features/studio/widgets';
import './studio.css';

type StudioClientProps = {
  bridge: AnalyticsBridgeItem[];
  records: AnalyticsRecord[];
  summary: {
    current_net_usd: number;
    delta_usd: number;
    previous_net_usd: number;
  };
};

const storageKey = 'finsig:studio:report:v1';
const licenseKey = process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY;
if (licenseKey) AgStudioLicenseManager.setLicenseKey(licenseKey);

function getSavedReport() {
  if (typeof window === 'undefined') return finSigInitialReport;
  const saved = window.localStorage.getItem(storageKey);
  if (!saved) return finSigInitialReport;
  try {
    return JSON.parse(saved) as typeof finSigInitialReport;
  } catch {
    return finSigInitialReport;
  }
}

export function StudioClient({ bridge, records, summary }: StudioClientProps) {
  const studioRef = useRef<AgStudio<FinSigStudioRegistry>>(null);
  const [mode, setMode] = useState<'edit' | 'view'>('view');
  const [initialState] = useState(getSavedReport);
  const [ready, setReady] = useState(false);

  const context = useMemo<FinSigStudioContext>(
    () => ({
      bridge,
      currentNetUsd: summary.current_net_usd,
      deltaUsd: summary.delta_usd,
      previousNetUsd: summary.previous_net_usd,
    }),
    [bridge, summary],
  );
  const data = useMemo<AgDataSourcesDefinition<FinSigStudioRegistry>>(
    () => ({
      description:
        'PayPal commercial activity projected from cent-based source records. Review rows are excluded from financial KPIs. Use record_id and source to cite evidence.',
      sources: [
        {
          id: 'transactions',
          name: 'PayPal source ledger',
          description:
            'Synthetic hackathon demonstration records with exact September and October reconciliation.',
          primaryKeyField: 'record_id',
          data: records,
        },
      ],
    }),
    [records],
  );

  const reset = useCallback(() => {
    window.localStorage.removeItem(storageKey);
    studioRef.current?.api.setState(structuredClone(finSigInitialReport), {
      historyLabel: 'Reset FinSig demo',
      source: { type: 'api' },
    });
    studioRef.current?.api.clearHistory();
  }, []);

  return (
    <main className="fs-studio-shell">
      <header className="fs-studio-header">
        <div className="fs-studio-brand">
          <Link href="/demo" aria-label="Return to FinSig overview">
            FS
          </Link>
          <div>
            <p>FinSig / AG Studio</p>
            <h1>Income control room</h1>
          </div>
        </div>
        <div className="fs-studio-header__status">
          <Badge tone="success">
            <ShieldCheck size={13} /> Source reconciled
          </Badge>
          <Badge tone="brand">
            <Bot size={13} /> Agent Framework
          </Badge>
          {!licenseKey ? <Badge tone="warning">License key pending</Badge> : null}
        </div>
        <div className="fs-studio-actions">
          <Button onClick={reset} size="sm" variant="quiet" disabled={!ready}>
            <RotateCcw size={14} /> Reset demo
          </Button>
          <Button
            onClick={() => setMode((value) => (value === 'view' ? 'edit' : 'view'))}
            size="sm"
            variant={mode === 'edit' ? 'secondary' : 'primary'}
          >
            <PencilRuler size={14} /> {mode === 'edit' ? 'Done editing' : 'Edit report'}
          </Button>
        </div>
      </header>
      <aside className="fs-studio-proof">
        <span>
          <strong>$4,600</strong> September net
        </span>
        <span>
          <strong>$3,400</strong> October net
        </span>
        <span className="is-negative">
          <strong>−$1,200</strong> exact change
        </span>
        <p>Ask the built-in assistant: “Explain the decline and show the source records.”</p>
      </aside>
      <section className="fs-studio-host" aria-label="Interactive FinSig report builder">
        <AgStudio<FinSigStudioRegistry>
          ref={studioRef}
          ai={({ api }) =>
            createAiHarness(api as unknown as AgStudioApi, {
              adapter: finSigLlmAdapter,
              primary: 'lead',
              promptStarters: [
                {
                  label: 'Explain the decline',
                  prompt:
                    'Explain why October net income declined versus September. Verify the arithmetic and cite the source records.',
                },
                {
                  label: 'Build an evidence view',
                  prompt:
                    'Add or configure a source grid that lets me inspect date, counterparty, activity, event code, net amount, and source link.',
                },
              ],
            })
          }
          context={context}
          data={data}
          enableFilterEditingInViewMode
          initialState={initialState}
          mode={mode}
          modules={[AgStudioAiModule]}
          onStateUpdated={() => {
            const state = studioRef.current?.api.getState();
            if (state) window.localStorage.setItem(storageKey, JSON.stringify(state));
          }}
          onStudioReady={() => setReady(true)}
          studioId="finsig-income-control-room"
          style={{ height: '100%', width: '100%' }}
          theme={finSigStudioTheme}
          widgets={finSigWidgets}
        />
      </section>
    </main>
  );
}
