'use client';

import {
  AgStudioAiModule,
  AgStudioLicenseManager,
  createAiHarness,
  type AgDataSourcesDefinition,
  type AgDrillThroughOptions,
  type AgFieldDefinition,
  type AgStudioApi,
} from 'ag-studio';
import { AgStudio } from 'ag-studio-react';
import { BadgeCheck, Check, PencilRuler, RotateCcw, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  buildAnalyticsBridge,
  buildAnalyticsSummary,
  type AnalyticsBridgeItem,
  type AnalyticsRecord,
} from '../../domain/analytics';
import { monthLong, monthName, previousPeriod } from '../../domain/workspace';
import { askFinSig, type Answer } from '../workspace/ai';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { finSigLlmAdapter } from './adapter';
import { finSigInitialReport, investigationBreakpoints } from './report';
import { createEvidenceStore, type EvidenceSelection, type EvidenceStore } from './selection';
import { finSigStudioTheme } from './theme';
import type { FinSigStudioContext, FinSigStudioRegistry } from './types';
import { finSigWidgets } from './widgets';
import './studio.css';

const storageKey = 'finsig:studio:investigation:v1';
const FEE_FACTOR = 'fee_delta';

const licenseKey = process.env.NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY;
if (licenseKey) AgStudioLicenseManager.setLicenseKey(licenseKey);

const usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usd = (value: number, signed = false) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(value);
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
  usdField('amount_usd', 'Amount (USD)'),
  usdField('net_usd', 'Net (USD)'),
  usdField('gross_usd', 'Gross (USD)'),
  usdField('fees_usd', 'PayPal fee (USD)'),
  usdField('refund_usd', 'Refunds (USD)'),
  usdField('expense_usd', 'Expenses (USD)'),
  // AG Studio types a field list over the union of every format, which collapses per-field
  // accessor types; each entry above is checked against its own format first.
] as unknown as AgFieldDefinition<FinSigStudioRegistry>[];

type Facts = Omit<FinSigStudioContext, 'evidence'> & {
  question: string;
  headline: { verb: string; amount: string };
};

/** Everything the investigation states, computed by FinSig's domain code for one month. */
function investigationFacts(period: string): Facts {
  const summary = buildAnalyticsSummary(period);
  const raw = buildAnalyticsBridge(period);
  const factors = raw
    .filter((item) => item.id !== FEE_FACTOR)
    .sort((a, b) => Math.abs(b.value_usd) - Math.abs(a.value_usd));
  const bridge = [...factors, ...raw.filter((item) => item.id === FEE_FACTOR)];
  const changed = [...new Set((factors.length ? factors : raw).flatMap((item) => item.record_ids))];
  const verb = summary.delta_usd < 0 ? 'fall' : 'rise';
  const amount = usd(Math.abs(summary.delta_usd));
  return {
    bridge,
    changedRecordIds: changed,
    currentNetUsd: summary.current_net_usd,
    deltaUsd: summary.delta_usd,
    previousNetUsd: summary.previous_net_usd,
    periodLabel: monthName(period),
    previousLabel: monthName(previousPeriod(period)),
    question: `Why did ${monthLong(period)} net income ${verb} by ${amount} compared with ${monthLong(previousPeriod(period))}?`,
    headline: { verb, amount },
  };
}

function savedReport() {
  if (typeof window === 'undefined') return finSigInitialReport;
  try {
    const saved = window.localStorage.getItem(storageKey);
    return saved ? (JSON.parse(saved) as typeof finSigInitialReport) : finSigInitialReport;
  } catch {
    return finSigInitialReport;
  }
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

export function IncomeInvestigation({ records }: { records: AnalyticsRecord[] }) {
  const { period } = useWorkspace();
  // A new month is a new investigation: selection, explanation and Studio context all reset.
  return <InvestigationView key={period} period={period} records={records} />;
}

type Explanation =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; answer: Answer }
  | { status: 'error'; message: string };

function InvestigationView({ period, records }: { period: string; records: AnalyticsRecord[] }) {
  const { state } = useWorkspace();
  const facts = useMemo(() => investigationFacts(period), [period]);
  const [evidence] = useState(createEvidenceStore);
  const selected = useSyncExternalStore(evidence.subscribe, evidence.get, () => null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [scoped, setScoped] = useState(true);
  const [explanation, setExplanation] = useState<Explanation>({ status: 'idle' });
  const [initialState] = useState(savedReport);
  // Starts at the default so the server render matches; Studio reports the saved count when ready.
  const [widgetCount, setWidgetCount] = useState(defaultWidgetCount);
  const studioRef = useRef<AgStudio<FinSigStudioRegistry>>(null);

  const context = useMemo<FinSigStudioContext>(() => ({ ...facts, evidence }), [facts, evidence]);
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

  // The investigation reaches Studio as a drill-through: every widget sees only these records.
  const drillThrough = useMemo<AgDrillThroughOptions<FinSigStudioRegistry> | undefined>(() => {
    if (mode === 'edit' && !scoped) return undefined;
    return {
      filter: {
        field: { id: 'transactions.record_id' },
        operator: 'isIn',
        value: selected?.recordIds ?? facts.changedRecordIds,
      },
    };
  }, [mode, scoped, selected, facts.changedRecordIds]);

  // Studio builds the editor's panels the first time edit mode opens, after the saved panel state
  // was read, so they start at their defaults. Re-apply the stored layout once they exist.
  useEffect(() => {
    if (mode !== 'edit') return;
    const task = window.setTimeout(() => {
      const api = studioRef.current?.api;
      if (!api) return;
      const current = api.getState();
      api.setState(
        { ...current, panels: { ...(current.panels ?? finSigInitialReport.panels) } },
        { source: { type: 'api' } },
      );
    }, 0);
    return () => window.clearTimeout(task);
  }, [mode]);

  async function investigate() {
    setExplanation({ status: 'loading' });
    try {
      const answer = await askFinSig(facts.question, period, state);
      setExplanation({ status: 'ready', answer });
      const cited = answer.claims
        .flatMap((claim) => claim.metrics)
        .map((metric) => facts.bridge.find((item) => item.id === metric.id))
        .find((item): item is AnalyticsBridgeItem => Boolean(item));
      if (cited) evidence.set(factorSelection(cited));
    } catch (error) {
      setExplanation({
        status: 'error',
        message: error instanceof Error ? error.message : 'FinSig could not answer right now.',
      });
    }
  }

  function reset() {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Storage can be unavailable; the reset still applies to this page.
    }
    studioRef.current?.api.setState(structuredClone(finSigInitialReport), {
      historyLabel: 'Reset to the income investigation',
      source: { type: 'api' },
    });
    studioRef.current?.api.clearHistory();
  }

  const editing = mode === 'edit';
  const evidenceLabel = selected
    ? `${plural(selected.recordIds.length, 'record')} · ${selected.label}`
    : `${plural(facts.changedRecordIds.length, 'record')} behind the change`;

  return (
    <div
      className={`investigation ${editing ? 'is-editing' : ''} ${
        widgetCount !== defaultWidgetCount ? 'is-customized' : ''
      }`}
    >
      <header className="investigation__head">
        <div>
          <p className="investigation__eyebrow">
            Income investigation · {facts.previousLabel} → {facts.periodLabel}
          </p>
          <h1>
            Why did {facts.periodLabel} net income {facts.headline.verb} by{' '}
            <span className={facts.deltaUsd < 0 ? 'is-down' : 'is-up'}>
              {facts.headline.amount}
            </span>
            ?
          </h1>
          <p className="investigation__sub">
            {facts.previousLabel} {usd(facts.previousNetUsd)} → {facts.periodLabel}{' '}
            {usd(facts.currentNetUsd)}. Every factor below is calculated from your PayPal records
            and adds up to the cent.
          </p>
        </div>
        <div className="investigation__actions">
          <button
            type="button"
            className="fs-button fs-button--primary"
            onClick={() => void investigate()}
            disabled={explanation.status === 'loading'}
          >
            {explanation.status === 'loading' ? (
              <span className="fs-spinner" aria-hidden="true" />
            ) : (
              <Sparkles size={15} />
            )}
            Ask FinSig to investigate
          </button>
          <button
            type="button"
            className={`fs-button ${editing ? 'fs-button--secondary' : 'fs-button--quiet'}`}
            onClick={() => setMode(editing ? 'view' : 'edit')}
          >
            {editing ? <Check size={15} /> : <PencilRuler size={15} />}
            {editing ? 'Back to investigation' : 'Customize analysis'}
          </button>
        </div>
      </header>

      {explanation.status !== 'idle' ? (
        <ExplanationCard
          explanation={explanation}
          facts={facts}
          evidence={evidence}
          selected={selected}
          onClose={() => setExplanation({ status: 'idle' })}
        />
      ) : null}

      {editing ? (
        <div className="investigation__customize" role="region" aria-label="Customize analysis">
          <p>
            <strong>Customizing the analysis.</strong> Add or rearrange widgets, edit filters or ask
            FinSig’s agent to change the report. Your layout is saved in this browser.
          </p>
          <label>
            <input
              type="checkbox"
              checked={scoped}
              onChange={(event) => setScoped(event.target.checked)}
            />
            Only {evidenceLabel}
          </label>
          <button
            type="button"
            className="fs-button fs-button--quiet fs-button--sm"
            onClick={reset}
          >
            <RotateCcw size={14} /> Reset to investigation
          </button>
        </div>
      ) : null}

      <section className="investigation__canvas" aria-label="Income investigation report">
        <AgStudio<FinSigStudioRegistry>
          ref={studioRef}
          ai={({ api }) =>
            createAiHarness(api as unknown as AgStudioApi, {
              adapter: finSigLlmAdapter,
              primary: 'lead',
              promptStarters: [
                {
                  label: 'Explain this change',
                  prompt: `${facts.question} Use the verified bridge, verify the arithmetic and cite the source records.`,
                },
                {
                  label: 'Compare clients by month',
                  prompt:
                    'Add a grouped column chart of Amount (USD) by client, grouped by month, so the two months sit side by side.',
                },
                {
                  label: 'Pivot the evidence',
                  prompt:
                    'Add a pivot table of Amount (USD) with clients as rows and months as columns below the bridge.',
                },
              ],
            })
          }
          context={context}
          data={data}
          drillThrough={drillThrough}
          initialState={initialState}
          localeText={{ panelTitleAi: 'Ask FinSig' }}
          mode={mode}
          modules={[AgStudioAiModule]}
          panels={{ view: { right: [] }, edit: { right: ['ai', 'edit', 'data', 'filters'] } }}
          responsiveLayoutBreakpoints={investigationBreakpoints}
          onStateUpdated={() => {
            const current = studioRef.current?.api.getState();
            if (current) setWidgetCount(countWidgets(current));
            try {
              if (current) window.localStorage.setItem(storageKey, JSON.stringify(current));
            } catch {
              // Storage can be unavailable; the report still works for this visit.
            }
          }}
          onStudioReady={() => {
            const current = studioRef.current?.api.getState();
            if (current) setWidgetCount(countWidgets(current));
          }}
          studioId="finsig-income-investigation"
          style={{ height: '100%', width: '100%' }}
          theme={finSigStudioTheme}
          widgets={finSigWidgets}
        />
      </section>
      {!licenseKey ? (
        <p className="investigation__note">AG Studio is running without a license key.</p>
      ) : null}
    </div>
  );
}

const countWidgets = (report: typeof finSigInitialReport) =>
  report.pages.reduce((sum, page) => sum + Object.keys(page.widgets ?? {}).length, 0);
const defaultWidgetCount = countWidgets(finSigInitialReport);

function factorSelection(item: AnalyticsBridgeItem): EvidenceSelection {
  return { id: item.id, label: item.label, recordIds: item.record_ids };
}

function ExplanationCard({
  explanation,
  facts,
  evidence,
  selected,
  onClose,
}: {
  explanation: Exclude<Explanation, { status: 'idle' }>;
  facts: Facts;
  evidence: EvidenceStore;
  selected: EvidenceSelection | null;
  onClose: () => void;
}) {
  return (
    <section className="explanation" aria-live="polite" aria-label="FinSig’s explanation">
      <header>
        <span className="explanation__badge">
          <Sparkles size={13} /> FinSig’s explanation
        </span>
        <button type="button" className="explanation__close" onClick={onClose} aria-label="Close">
          <X size={15} />
        </button>
      </header>
      {explanation.status === 'loading' ? (
        <p className="explanation__loading">
          <span className="fs-spinner" aria-hidden="true" /> Reading the verified bridge and the
          PayPal records behind it…
        </p>
      ) : null}
      {explanation.status === 'error' ? (
        <p className="callout is-error">{explanation.message}</p>
      ) : null}
      {explanation.status === 'ready' && explanation.answer.unsupported ? (
        <p className="callout">FinSig could not answer this from the verified metrics.</p>
      ) : null}
      {explanation.status === 'ready' && !explanation.answer.unsupported ? (
        <>
          <ol className="explanation__claims">
            {explanation.answer.claims.map((claim, index) => {
              const factors = claim.metrics
                .map((metric) => facts.bridge.find((item) => item.id === metric.id))
                .filter((item): item is AnalyticsBridgeItem => Boolean(item));
              const claimId = `claim:${index}`;
              return (
                <li key={index}>
                  <p>{claim.text}</p>
                  <div className="explanation__evidence">
                    {factors.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`explanation__factor ${selected?.id === item.id ? 'is-selected' : ''}`}
                        aria-pressed={selected?.id === item.id}
                        onClick={() =>
                          evidence.set(selected?.id === item.id ? null : factorSelection(item))
                        }
                      >
                        {item.label} <strong>{usd(item.value_usd, true)}</strong>
                      </button>
                    ))}
                    {!factors.length && claim.recordIds.length ? (
                      <button
                        type="button"
                        className={`explanation__factor ${selected?.id === claimId ? 'is-selected' : ''}`}
                        aria-pressed={selected?.id === claimId}
                        onClick={() =>
                          evidence.set(
                            selected?.id === claimId
                              ? null
                              : {
                                  id: claimId,
                                  label: 'the records FinSig cited',
                                  recordIds: claim.recordIds,
                                },
                          )
                        }
                      >
                        Show {plural(claim.recordIds.length, 'cited record')}
                      </button>
                    ) : null}
                    {claim.metrics
                      // The headline already states the total change; repeat only other metrics.
                      .filter(
                        (metric) =>
                          metric.id !== 'net_delta' &&
                          !factors.some((item) => item.id === metric.id),
                      )
                      .map((metric) => (
                        <span key={metric.id} className="explanation__metric">
                          {metric.label} <strong>{metric.value}</strong>
                        </span>
                      ))}
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="explanation__foot">
            <BadgeCheck size={13} /> Checked by code: FinSig may only cite verified metrics and
            their PayPal records, and every number shown comes from those metrics.
          </p>
        </>
      ) : null}
    </section>
  );
}
