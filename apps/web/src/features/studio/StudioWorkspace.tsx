'use client';

import { Badge, Button } from '@finsig/ui';
import {
  AgStudioAiModule,
  AgStudioLicenseManager,
  createAiHarness,
  type AgDataSourcesDefinition,
  type AgFieldDefinition,
  type AgStudioApi,
} from 'ag-studio';
import { AgStudio } from 'ag-studio-react';
import { Bot, PencilRuler, RotateCcw, ShieldCheck } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { AnalyticsBridgeItem, AnalyticsRecord } from '../../domain/analytics';
import { finSigLlmAdapter } from './adapter';
import { finSigInitialReport } from './report';
import { finSigStudioTheme } from './theme';
import type { FinSigStudioContext, FinSigStudioRegistry } from './types';
import { finSigWidgets } from './widgets';
import './studio.css';

type StudioWorkspaceProps = {
  bridge: AnalyticsBridgeItem[];
  records: AnalyticsRecord[];
  summary: {
    current_net_usd: number;
    delta_usd: number;
    previous_net_usd: number;
    delta_percent: number;
  };
  periodLabel: string;
  previousLabel: string;
};

const storageKey = 'finsig:studio:report:v2';

const usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
type Field<TFormat extends 'textFormat' | 'currencyFormat' | 'dateFormat'> = AgFieldDefinition<
  FinSigStudioRegistry,
  AnalyticsRecord,
  TFormat
>;
const text = (id: keyof AnalyticsRecord, name: string): Field<'textFormat'> => ({
  id,
  name,
  format: 'textFormat',
});
const usdField = (id: keyof AnalyticsRecord, name: string): Field<'currencyFormat'> => ({
  id,
  name,
  format: 'currencyFormat',
  createValueFormatter: () => (value) => usdFormatter.format(value),
});
const dateField: Field<'dateFormat'> = {
  id: 'date',
  name: 'Date',
  format: 'dateFormat',
  accessor: (row) => new Date(`${row.date}T00:00:00Z`),
  createValueFormatter: () => (value) => dateFormatter.format(value),
};

/** Explicit field formats keep amounts in USD and dates locale-independent for every viewer. */
const ledgerFields = [
  text('record_id', 'Record ID'),
  dateField,
  text('month', 'Month'),
  text('client', 'Client'),
  text('counterparty', 'Counterparty'),
  text('activity', 'Activity'),
  text('type', 'Type'),
  text('kind', 'Kind'),
  text('status', 'Status'),
  text('event_code', 'PayPal event code'),
  text('subject', 'Subject'),
  text('source', 'Source'),
  usdField('net_usd', 'Net (USD)'),
  usdField('gross_usd', 'Gross (USD)'),
  usdField('fees_usd', 'PayPal fees (USD)'),
  usdField('refund_usd', 'Refunds (USD)'),
  usdField('expense_usd', 'Expenses (USD)'),
  // AG Studio types a field list over the union of every format, which collapses per-field
  // accessor types; each entry above is checked against its own format first.
] as unknown as AgFieldDefinition<FinSigStudioRegistry>[];
const licenseKey = process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY;
if (licenseKey) AgStudioLicenseManager.setLicenseKey(licenseKey);

const usd = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    signDisplay: 'auto',
  }).format(value);

function getSavedReport() {
  if (typeof window === 'undefined') return finSigInitialReport;
  try {
    const saved = window.localStorage.getItem(storageKey);
    return saved ? (JSON.parse(saved) as typeof finSigInitialReport) : finSigInitialReport;
  } catch {
    return finSigInitialReport;
  }
}

export function StudioWorkspace({
  bridge,
  records,
  summary,
  periodLabel,
  previousLabel,
}: StudioWorkspaceProps) {
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
      periodLabel,
      previousLabel,
    }),
    [bridge, summary, periodLabel, previousLabel],
  );
  const data = useMemo<AgDataSourcesDefinition<FinSigStudioRegistry>>(
    () => ({
      description:
        'Fictional freelancer history projected from cent-based sample records. Review rows and pending payments carry zero net. Use record_id and source to cite evidence.',
      sources: [
        {
          id: 'transactions',
          name: 'PayPal source ledger',
          description:
            'Twelve months of fictional freelancer records (sales, refunds, fees, business expenses) with exact month-over-month reconciliation.',
          primaryKeyField: 'record_id',
          data: records,
          fields: ledgerFields,
        },
      ],
    }),
    [records],
  );

  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    studioRef.current?.api.setState(structuredClone(finSigInitialReport), {
      historyLabel: 'Reset FinSig report',
      source: { type: 'api' },
    });
    studioRef.current?.api.clearHistory();
  }, []);

  return (
    <div className="studio-page">
      <header className="studio-page__head">
        <div>
          <h1>Analytics studio</h1>
          <p>
            Build your own report on the PayPal ledger. Ask the agent to rearrange it — the math
            stays verified.
          </p>
        </div>
        <div className="studio-page__badges">
          <Badge tone="success" icon={<ShieldCheck size={13} />}>
            Source reconciled
          </Badge>
          <Badge tone="brand" icon={<Bot size={13} />}>
            AG Studio agent · Claude
          </Badge>
          {!licenseKey ? <Badge tone="warning">License key pending</Badge> : null}
        </div>
        <div className="studio-page__actions">
          <Button
            onClick={reset}
            size="sm"
            variant="quiet"
            disabled={!ready}
            leadingIcon={<RotateCcw size={14} />}
          >
            Reset report
          </Button>
          <Button
            onClick={() => setMode((value) => (value === 'view' ? 'edit' : 'view'))}
            size="sm"
            variant={mode === 'edit' ? 'secondary' : 'primary'}
            leadingIcon={<PencilRuler size={14} />}
          >
            {mode === 'edit' ? 'Done editing' : 'Edit report'}
          </Button>
        </div>
      </header>
      <div className="studio-page__proof">
        <span>
          <strong>{usd(summary.previous_net_usd)}</strong> {previousLabel} net
        </span>
        <span>
          <strong>{usd(summary.current_net_usd)}</strong> {periodLabel} net
        </span>
        <span className={summary.delta_usd < 0 ? 'is-negative' : 'is-positive'}>
          <strong>{usd(summary.delta_usd)}</strong> exact change ({summary.delta_percent}%)
        </span>
        <p>Try the agent: “Explain the decline and show the source records.”</p>
      </div>
      <section className="studio-page__host" aria-label="Interactive FinSig report builder">
        <AgStudio<FinSigStudioRegistry>
          ref={studioRef}
          ai={({ api }) =>
            createAiHarness(api as unknown as AgStudioApi, {
              adapter: finSigLlmAdapter,
              primary: 'lead',
              promptStarters: [
                {
                  label: 'Explain the decline',
                  prompt: `Explain why ${periodLabel} net income declined versus ${previousLabel}. Verify the arithmetic and cite the source records.`,
                },
                {
                  label: 'Who pays best?',
                  prompt:
                    'Add a chart of net income by client and highlight the client with the highest total.',
                },
                {
                  label: 'Build an evidence view',
                  prompt:
                    'Configure the source grid to show date, client, activity, type, status, net amount and source link, sorted by date descending.',
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
            try {
              if (state) window.localStorage.setItem(storageKey, JSON.stringify(state));
            } catch {
              // ignore
            }
          }}
          onStudioReady={() => setReady(true)}
          studioId="finsig-income-studio"
          style={{ height: '100%', width: '100%' }}
          theme={finSigStudioTheme}
          widgets={finSigWidgets}
        />
      </section>
    </div>
  );
}
