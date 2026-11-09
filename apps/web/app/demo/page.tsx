'use client';

import { Badge, Button, StatCard } from '@finsig/ui';
import { Bot, ChartNoAxesCombined, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import {
  activityRows,
  buildBridge,
  demoActivities,
  demoRecords,
  forecast30Days,
  initialDemoState,
  money,
  periodTotals,
  resolvedActivity,
  type ActivityId,
  type DemoState,
} from '../../src/domain/demo';
import { toMinor } from '../../src/domain/money';

type View = 'Overview' | 'Activities' | 'Manager' | 'Sources';

const classificationResponse = z.object({
  record_id: z.string(),
  activity_id: z.enum(['design', 'consulting', 'support']).nullable(),
  evidence: z.array(z.object({ field: z.string(), value: z.string() })),
  question: z.string(),
  model: z.string(),
});

const explanationResponse = z.object({
  model: z.string(),
  claims: z.array(
    z.object({
      text: z.string(),
      metrics: z.array(z.object({ id: z.string(), label: z.string(), value: z.string() })),
      recordIds: z.array(z.string()),
    }),
  ),
});

type Classification = z.infer<typeof classificationResponse>;
type Explanation = z.infer<typeof explanationResponse>;

const storedStateSchema = z.object({
  confirmedActivityIds: z.record(z.string(), z.enum(['design', 'consulting', 'support'])),
  work: z.record(
    z.enum(['design', 'consulting', 'support']),
    z.object({ hours: z.string(), directCostMinor: z.string() }),
  ),
});

function restoreState(): DemoState {
  try {
    const raw = localStorage.getItem('finsig-demo-v1');
    if (!raw) return initialDemoState;
    const saved = storedStateSchema.parse(JSON.parse(raw));
    return {
      confirmedActivityIds: saved.confirmedActivityIds,
      work: {
        design: {
          hours: saved.work.design.hours,
          directCostMinor: BigInt(saved.work.design.directCostMinor),
        },
        consulting: {
          hours: saved.work.consulting.hours,
          directCostMinor: BigInt(saved.work.consulting.directCostMinor),
        },
        support: {
          hours: saved.work.support.hours,
          directCostMinor: BigInt(saved.work.support.directCostMinor),
        },
      },
    };
  } catch {
    return initialDemoState;
  }
}

function saveState(state: DemoState): void {
  localStorage.setItem(
    'finsig-demo-v1',
    JSON.stringify({
      confirmedActivityIds: state.confirmedActivityIds,
      work: Object.fromEntries(
        Object.entries(state.work).map(([id, work]) => [
          id,
          { hours: work.hours, directCostMinor: work.directCostMinor.toString() },
        ]),
      ),
    }),
  );
}

async function callAI(body: unknown): Promise<unknown> {
  const response = await fetch('/api/demo/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json: unknown = await response.json();
  if (!response.ok) {
    const error = z.object({ error: z.string() }).safeParse(json);
    throw new Error(error.success ? error.data.error : 'AI request failed.');
  }
  return json;
}

function validateHours(value: string): string {
  const parsed = z.coerce.number().finite().min(0).max(10_000).parse(value);
  if (!Number.isInteger(parsed * 100)) throw new Error('Hours need at most two decimal places.');
  return parsed.toFixed(2);
}

function validateCost(value: string): bigint {
  const minor = toMinor(value, 'USD');
  if (minor < 0n) throw new Error('Cost must be nonnegative.');
  return minor;
}

export default function DemoPage() {
  const [view, setView] = useState<View>('Overview');
  const [state, setState] = useState<DemoState>(initialDemoState);
  const [ready, setReady] = useState(false);
  const [classification, setClassification] = useState<Classification | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [aiBusy, setAiBusy] = useState<'classify' | 'explain' | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    const task = window.setTimeout(() => {
      setState(restoreState());
      setReady(true);
    }, 0);
    return () => window.clearTimeout(task);
  }, []);

  useEffect(() => {
    if (ready) saveState(state);
  }, [ready, state]);

  const rows = useMemo(() => activityRows(state), [state]);
  const previous = periodTotals('2026-09');
  const current = periodTotals('2026-10');
  const delta = current.netMinor - previous.netMinor;
  const bridge = buildBridge();
  const forecast = forecast30Days(state);
  const knownCostsMinor = Object.values(state.work).reduce(
    (sum, input) => sum + input.directCostMinor,
    0n,
  );
  const pending = demoRecords.find((record) => record.id === 'pp-oct-consulting')!;
  const pendingResolved = resolvedActivity(pending, state);
  const unassigned = demoRecords.filter(
    (record) =>
      record.initiatedAt.startsWith('2026-10') &&
      record.kind !== 'review' &&
      !resolvedActivity(record, state),
  );

  async function runAI(task: 'classify' | 'explain') {
    setAiBusy(task);
    setAiError(null);
    try {
      if (task === 'classify') {
        setClassification(
          classificationResponse.parse(await callAI({ task, recordId: pending.id })),
        );
      } else {
        setExplanation(explanationResponse.parse(await callAI({ task })));
      }
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'AI request failed.');
    } finally {
      setAiBusy(null);
    }
  }

  function confirmActivity(activityId: ActivityId) {
    setState((previousState) => ({
      ...previousState,
      confirmedActivityIds: { ...previousState.confirmedActivityIds, [pending.id]: activityId },
    }));
    setClassification(null);
  }

  function updateWork(activityId: ActivityId, field: 'hours' | 'cost', value: string) {
    try {
      const currentWork = state.work[activityId];
      const nextWork =
        field === 'hours'
          ? { ...currentWork, hours: validateHours(value) }
          : { ...currentWork, directCostMinor: validateCost(value) };
      setState((previousState) => ({
        ...previousState,
        work: { ...previousState.work, [activityId]: nextWork },
      }));
      setEditError(null);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Invalid work input.');
    }
  }

  function resetDemo() {
    setState(initialDemoState);
    setClassification(null);
    setExplanation(null);
    setAiError(null);
    localStorage.removeItem('finsig-demo-v1');
    setView('Overview');
  }

  function openSource(recordId: string) {
    setView('Sources');
    setTimeout(() => document.getElementById(recordId)?.scrollIntoView({ behavior: 'smooth' }), 0);
  }

  return (
    <div className="demo-shell">
      <aside className="sidebar">
        <Link href="/" className="sidebar-brand">
          <span className="brand-mark">F</span> FinSig
        </Link>
        <div className="sidebar-section-label">WORKSPACE</div>
        <nav aria-label="Demo sections">
          {(['Overview', 'Activities', 'Manager', 'Sources'] as View[]).map((item) => (
            <button
              className={`nav-link ${view === item ? 'active' : ''}`}
              onClick={() => setView(item)}
              key={item}
              type="button"
            >
              <span className="nav-icon">
                {
                  (
                    { Overview: '◫', Activities: '▤', Manager: '✧', Sources: '⌁' } as Record<
                      View,
                      string
                    >
                  )[item]
                }
              </span>
              {item}
            </button>
          ))}
          <Link className="nav-link studio-nav-link" href="/demo/studio">
            <span className="nav-icon">
              <ChartNoAxesCombined size={17} />
            </span>
            AG Studio
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <span className="demo-avatar">DE</span>
          <div>
            <strong>Demo workspace</strong>
            <small>Synthetic sample data</small>
          </div>
        </div>
      </aside>

      <div className="demo-main">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>{view}</strong>
          </div>
          <div className="topbar-actions">
            <span className="period-pill">● &nbsp; Oct 2026</span>
            <Button
              leadingIcon={<RotateCcw size={13} />}
              onClick={resetDemo}
              size="sm"
              variant="quiet"
            >
              Reset demo
            </Button>
          </div>
        </header>
        <main className="content">
          <div className="demo-notice">
            <div>
              <strong>Interactive sample.</strong> The workspace uses fictional records.
              FinSig&apos;s PayPal Transaction Search importer was separately verified in sandbox.{' '}
              <a
                href="https://github.com/dmrvcodes/finsig/blob/main/docs/reporting-gate.md"
                target="_blank"
                rel="noreferrer"
              >
                See evidence ↗
              </a>
            </div>
            <Link className="studio-cta" href="/demo/studio">
              <Bot size={14} /> Open AI report builder
            </Link>
          </div>

          {view === 'Overview' && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">YOUR FINANCIAL PICTURE</p>
                  <h1>Overview</h1>
                  <p>See what changed, and trace every number back to a record.</p>
                </div>
                <span className="page-tag">USD · UTC</span>
              </div>
              <div className="stat-grid">
                <StatCard
                  label="October net receipts"
                  value={money(current.netMinor)}
                  detail="Gross − refunds − PayPal fees"
                  featured
                />
                <StatCard
                  label="September net receipts"
                  value={money(previous.netMinor)}
                  detail="Previous full month"
                />
                <StatCard
                  label="Month-over-month"
                  value={money(delta, true)}
                  detail="Calculated from source records"
                  trend={delta < 0n ? 'down' : 'up'}
                />
              </div>
              <div className="panel-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">THE EXACT BRIDGE</p>
                      <h2>Why net receipts changed</h2>
                    </div>
                    <Badge tone="success">✓ Reconciled</Badge>
                  </div>
                  <div className="bridge-start">
                    <span>September net</span>
                    <strong>{money(previous.netMinor)}</strong>
                  </div>
                  {bridge.map((metric) => (
                    <div className="bridge-row" key={metric.id}>
                      <div>
                        <span
                          className={`bridge-dot ${metric.valueMinor >= 0n ? 'positive' : 'negative'}`}
                        />
                        {metric.label}
                      </div>
                      <strong className={metric.valueMinor < 0n ? 'down' : 'up'}>
                        {money(metric.valueMinor, true)}
                      </strong>
                    </div>
                  ))}
                  <div className="bridge-end">
                    <span>October net</span>
                    <strong>{money(current.netMinor)}</strong>
                  </div>
                  <p className="panel-caption">
                    An account correction is in review and never counted as revenue.
                  </p>
                </section>
                <section className="panel panel-ai">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">FINANCIAL EXPLANATION</p>
                      <h2>AI, grounded in evidence</h2>
                    </div>
                    <span className="ai-spark">✧</span>
                  </div>
                  <p className="panel-copy">
                    Claude chooses useful observations. FinSig verifies every metric and record
                    reference, then renders amounts from code.
                  </p>
                  {!explanation && (
                    <Button
                      onClick={() => runAI('explain')}
                      isLoading={aiBusy === 'explain'}
                      disabled={aiBusy !== null}
                      trailingIcon={<Bot size={14} />}
                    >
                      Generate explanation
                    </Button>
                  )}
                  {explanation && (
                    <div className="claims">
                      {explanation.claims.map((claim, index) => (
                        <div className="claim" key={index}>
                          <p>{claim.text}</p>
                          <div className="claim-metrics">
                            {claim.metrics.map((metric) => (
                              <span key={metric.id}>
                                {metric.label}: <strong>{metric.value}</strong>
                              </span>
                            ))}
                          </div>
                          <div className="source-links">
                            Sources:{' '}
                            {claim.recordIds.map((id) => (
                              <button key={id} type="button" onClick={() => openSource(id)}>
                                {id} ↗
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      <small>Verified output · {explanation.model}</small>
                    </div>
                  )}
                  {aiError && (
                    <p className="error-message" role="alert">
                      {aiError}
                    </p>
                  )}
                </section>
              </div>
            </>
          )}

          {view === 'Activities' && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">MAKE THE CONNECTION</p>
                  <h1>Activities</h1>
                  <p>Confirm where payments belong. Your work inputs stay editable.</p>
                </div>
                <span className="page-tag">{unassigned.length} need review</span>
              </div>
              {!pendingResolved && (
                <section className="panel classify-panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">UNASSIGNED PAYPAL RECEIPT</p>
                      <h2>Which work earned this payment?</h2>
                    </div>
                    <span className="pending-tag">Needs your confirmation</span>
                  </div>
                  <div className="record-preview">
                    <div>
                      <strong>{pending.counterparty}</strong>
                      <span>{pending.subject}</span>
                      <small>
                        {pending.itemName} · {pending.paypalEventCode}
                      </small>
                    </div>
                    <strong>{money(pending.amountMinor)}</strong>
                  </div>
                  <div className="classify-actions">
                    <button
                      className="button button-primary"
                      type="button"
                      disabled={aiBusy !== null}
                      onClick={() => runAI('classify')}
                    >
                      {aiBusy === 'classify' ? 'Reading evidence…' : 'Ask AI to suggest ✧'}
                    </button>
                    <span>AI proposes. You decide.</span>
                  </div>
                  {classification && (
                    <div className="suggestion">
                      <div>
                        <span className="suggestion-label">
                          AI SUGGESTION · {classification.model}
                        </span>
                        <h3>
                          {classification.activity_id
                            ? demoActivities.find((item) => item.id === classification.activity_id)
                                ?.name
                            : 'Needs clarification'}
                        </h3>
                        {classification.evidence.map((item) => (
                          <p key={item.field}>
                            <strong>{item.field.replaceAll('_', ' ')}</strong> “{item.value}”
                          </p>
                        ))}
                        {classification.question && <p>{classification.question}</p>}
                      </div>
                      {classification.activity_id && (
                        <button
                          type="button"
                          className="button button-dark"
                          onClick={() => confirmActivity(classification.activity_id!)}
                        >
                          Confirm{' '}
                          {
                            demoActivities.find((item) => item.id === classification.activity_id)
                              ?.name
                          }
                        </button>
                      )}
                    </div>
                  )}
                  {aiError && (
                    <p className="error-message" role="alert">
                      {aiError}
                    </p>
                  )}
                  <div className="manual-confirm">
                    Or classify manually:{' '}
                    {demoActivities.map((item) => (
                      <button type="button" key={item.id} onClick={() => confirmActivity(item.id)}>
                        {item.name}
                      </button>
                    ))}
                  </div>
                </section>
              )}
              {pendingResolved && (
                <div className="success-banner">
                  ✓ Payment and linked refund assigned to{' '}
                  {demoActivities.find((item) => item.id === pendingResolved)?.name}. The overall
                  cash total did not change.
                </div>
              )}
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">OCTOBER 2026</p>
                    <h2>Contribution by activity</h2>
                  </div>
                  <span className="subtle">Net receipts − known direct costs</span>
                </div>
                <div className="activity-table">
                  <div className="table-head">
                    <span>Activity</span>
                    <span>Net</span>
                    <span>Hours</span>
                    <span>Known costs</span>
                    <span>Contribution / hr</span>
                  </div>
                  {rows.map((row) => (
                    <div className="table-row" key={row.id}>
                      <div className="activity-name">
                        <span className="activity-color" style={{ background: row.color }} />
                        <div>
                          <strong>{row.name}</strong>
                          <small>{row.recordIds.length} linked records</small>
                        </div>
                      </div>
                      <strong>{row.recordIds.length ? money(row.netMinor) : '—'}</strong>
                      <input
                        aria-label={`${row.name} hours`}
                        type="number"
                        min="0"
                        step="0.25"
                        defaultValue={row.hours}
                        key={`${row.id}-hours-${row.hours}`}
                        onBlur={(event) => updateWork(row.id, 'hours', event.target.value)}
                      />
                      <input
                        aria-label={`${row.name} known costs in USD`}
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={Number(row.costMinor) / 100}
                        key={`${row.id}-cost-${row.costMinor}`}
                        onBlur={(event) => updateWork(row.id, 'cost', event.target.value)}
                      />
                      <strong>
                        {row.contributionPerHour ? `$${row.contributionPerHour}` : '—'}
                      </strong>
                    </div>
                  ))}
                </div>
                {editError && (
                  <p className="error-message" role="alert">
                    {editError}
                  </p>
                )}
                <p className="panel-caption">
                  Hours and costs are user inputs, not PayPal facts. Missing assignments do not
                  become activity revenue.
                </p>
              </section>
            </>
          )}

          {view === 'Manager' && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">NEXT MOVES</p>
                  <h1>Manager</h1>
                  <p>
                    A planning baseline derived from verified cash, with uncertainty in plain sight.
                  </p>
                </div>
                <span className="page-tag">30-day view</span>
              </div>
              <div className="stat-grid">
                <StatCard
                  label="30-day receipt baseline"
                  value={money(forecast.receiptsMinor)}
                  detail="October daily average × 30"
                  featured
                />
                <StatCard
                  label="After known direct costs"
                  value={money(forecast.contributionMinor)}
                  detail="Assumes the same cost run rate"
                />
                <StatCard
                  label="Classification queue"
                  value={`${unassigned.length} records`}
                  detail="Resolve before activity decisions"
                  trend={unassigned.length > 0 ? 'down' : 'neutral'}
                />
              </div>
              <div className="panel-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">ATTENTION NEEDED</p>
                      <h2>Cash trend changed</h2>
                    </div>
                    <span className="alert-dot">!</span>
                  </div>
                  <p className="panel-copy">
                    October net receipts were below September. The exact bridge shows lower gross
                    receipts and a partial refund; lower PayPal fees offset part of the decline.
                  </p>
                  <div className="manager-action">
                    <span>Suggested next step</span>
                    <strong>Confirm the open activity, then compare contribution per hour.</strong>
                  </div>
                  <button
                    type="button"
                    className="button button-quiet"
                    onClick={() => setView('Activities')}
                  >
                    Review activity →
                  </button>
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">MODEL BOUNDARY</p>
                      <h2>What the forecast means</h2>
                    </div>
                  </div>
                  <p className="panel-copy">
                    This is a run-rate scenario, not a promise. It uses the complete October net
                    total and known costs, assumes the same pace, and applies a 30/31 time factor.
                    AI can explain the inputs; it cannot edit the calculation.
                  </p>
                  <div className="formula-box">
                    ({money(current.netMinor)} − {money(knownCostsMinor)}) × 30 / 31 ={' '}
                    <strong>{money(forecast.contributionMinor)}</strong>
                  </div>
                  <button
                    type="button"
                    className="button button-quiet"
                    onClick={() => setView('Overview')}
                  >
                    Inspect source bridge →
                  </button>
                </section>
              </div>
            </>
          )}

          {view === 'Sources' && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">SHOW YOUR WORK</p>
                  <h1>Sources</h1>
                  <p>
                    Every amount comes from a normalized source record or a labelled user input.
                  </p>
                </div>
                <span className="page-tag">{demoRecords.length} demo records</span>
              </div>
              <section className="panel sources-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">SANITIZED DEMO FIXTURE</p>
                    <h2>PayPal-style reporting records</h2>
                  </div>
                  <Badge tone="success">No live buyer data</Badge>
                </div>
                <div className="source-list">
                  {[...demoRecords].reverse().map((record) => (
                    <div className="source-card" id={record.id} key={record.id}>
                      <div className="source-card-main">
                        <div>
                          <span className={`kind-tag ${record.kind}`}>
                            {record.kind === 'review' ? 'IN REVIEW' : record.paypalEventCode}
                          </span>
                          <strong>{record.subject}</strong>
                          <small>
                            {record.counterparty} ·{' '}
                            {new Date(record.initiatedAt).toLocaleDateString('en-US', {
                              timeZone: 'UTC',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}{' '}
                            UTC · {record.id}
                          </small>
                        </div>
                        <div className="source-amount">
                          <strong>{money(record.amountMinor, true)}</strong>
                          <span>
                            Fee{' '}
                            {record.feeMinor === null
                              ? 'not returned'
                              : money(record.feeMinor, true)}
                          </span>
                        </div>
                      </div>
                      <div className="source-card-bottom">
                        <span>
                          {record.kind === 'review'
                            ? 'Excluded from revenue'
                            : resolvedActivity(record, state)
                              ? `Assigned to ${demoActivities.find((item) => item.id === resolvedActivity(record, state))?.name}`
                              : 'Unassigned'}
                        </span>
                        {record.referenceId && <span>References {record.referenceId}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              <div className="source-disclosure">
                <strong>What is real?</strong> These six records are a fictional, reproducible
                walkthrough for judges. The repository also includes a real PayPal sandbox
                Transaction Search importer and a sanitized{' '}
                <a
                  href="https://github.com/dmrvcodes/finsig/blob/main/docs/reporting-gate.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  capture/refund verification log ↗
                </a>
                . FinSig does not claim access to another merchant&apos;s history.
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
