'use client';

import type { CustomCellRendererProps } from 'ag-grid-react';
import { AgGridReact } from 'ag-grid-react';
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type RowClickedEvent,
} from 'ag-grid-community';
import { Download, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  activityName,
  kindLabels,
  longDate,
  money,
  recordById,
  recordNetMinor,
  resolvedActivity,
  workspaceRecords,
  type WorkspaceRecord,
} from '../../domain/workspace';
import { ClientAvatar, eventCodeMeaning, RecordIcon } from './parts';
import { Scrim, useOverlay } from './overlay';
import { ReviewQueue } from './ReviewQueue';
import { useWorkspace, type LiveState } from './WorkspaceProvider';

ModuleRegistry.registerModules([AllCommunityModule]);

const gridTheme = themeQuartz.withParams({
  accentColor: '#4f5df0',
  backgroundColor: '#ffffff',
  borderColor: '#edf0f7',
  browserColorScheme: 'light',
  fontFamily: 'DM Sans, system-ui, sans-serif',
  fontSize: 13,
  foregroundColor: '#2b3047',
  headerBackgroundColor: '#f6f7fc',
  headerFontWeight: 700,
  headerTextColor: '#6b7290',
  rowHoverColor: '#f3f4ff',
  selectedRowBackgroundColor: '#e8ebff',
  wrapperBorderRadius: 20,
  wrapperBorder: false,
  rowHeight: 58,
  headerHeight: 44,
  spacing: 7,
});

export type Filter = 'all' | 'income' | 'refunds' | 'expenses' | 'transfers' | 'review' | 'live';

const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'income', label: 'Income' },
  { id: 'refunds', label: 'Refunds' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'transfers', label: 'Transfers' },
  { id: 'review', label: 'Needs review' },
  { id: 'live', label: 'Live sandbox' },
];

interface Row {
  id: string;
  date: string;
  counterparty: string;
  subject: string;
  activity: string;
  needsReview: boolean;
  kind: WorkspaceRecord['kind'];
  type: string;
  status: 'Completed' | 'Pending' | 'In review';
  amount: number;
  fee: number | null;
  net: number;
  eventCode: string;
  live: boolean;
  record: WorkspaceRecord | null;
}

const usd = (value: number, signed = false) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(value);

function sampleRows(state: ReturnType<typeof useWorkspace>['state']): Row[] {
  return workspaceRecords.map((record) => {
    const activity = resolvedActivity(record, state);
    const needsReview = record.kind === 'sale' && !activity;
    return {
      id: record.id,
      date: record.initiatedAt,
      counterparty: record.counterparty,
      subject: record.subject,
      activity:
        record.kind === 'sale' || record.kind === 'refund'
          ? activityName(activity)
          : record.kind === 'expense'
            ? 'Overhead'
            : '—',
      needsReview,
      kind: record.kind,
      type: kindLabels[record.kind],
      status:
        record.kind === 'review' ? 'In review' : record.status === 'P' ? 'Pending' : 'Completed',
      amount: Number(record.amountMinor) / 100,
      fee: record.feeMinor === null ? null : Number(record.feeMinor) / 100,
      net: Number(recordNetMinor(record)) / 100,
      eventCode: record.paypalEventCode,
      live: false,
      record,
    };
  });
}

function liveRows(live: LiveState): Row[] {
  if (live.status !== 'ready') return [];
  return live.result.records.map((record) => {
    const amount = Number(record.amountMinor) / 100;
    const fee = record.feeMinor === null ? null : Number(record.feeMinor) / 100;
    return {
      id: `live-${record.id}`,
      date: record.initiatedAt,
      counterparty: 'PayPal sandbox buyer',
      subject: record.subject ?? 'Sandbox transaction',
      activity: '—',
      needsReview: false,
      kind: record.kind,
      type:
        record.kind === 'sale'
          ? 'Payment received'
          : record.kind === 'refund'
            ? 'Refund'
            : 'In review',
      status:
        record.kind === 'review' ? 'In review' : record.status === 'P' ? 'Pending' : 'Completed',
      amount,
      fee,
      net: amount + (fee ?? 0),
      eventCode: record.eventCode,
      live: true,
      record: null,
    };
  });
}

function matches(row: Row, filter: Filter): boolean {
  switch (filter) {
    case 'income':
      return row.kind === 'sale';
    case 'refunds':
      return row.kind === 'refund';
    case 'expenses':
      return row.kind === 'expense';
    case 'transfers':
      return row.kind === 'withdrawal';
    case 'review':
      return row.needsReview || row.kind === 'review';
    case 'live':
      return row.live;
    default:
      return true;
  }
}

function CounterpartyCell({ data }: CustomCellRendererProps<Row>) {
  if (!data) return null;
  return (
    <div className="grid-party">
      {data.record ? (
        data.record.clientId && data.kind === 'sale' ? (
          <ClientAvatar clientId={data.record.clientId} size={32} />
        ) : (
          <RecordIcon record={data.record} />
        )
      ) : (
        <span className="record-icon is-live">P</span>
      )}
      <div>
        <strong>{data.counterparty}</strong>
        <span>{data.subject}</span>
      </div>
    </div>
  );
}

function ActivityCell({ data }: CustomCellRendererProps<Row>) {
  if (!data) return null;
  if (data.needsReview) return <span className="pill is-ai">Needs review</span>;
  if (data.activity === '—') return <span className="grid-muted">—</span>;
  return <span className="pill">{data.activity}</span>;
}

function StatusCell({ data }: CustomCellRendererProps<Row>) {
  if (!data) return null;
  return (
    <span className="grid-status">
      {data.live ? <span className="pill is-live">Live</span> : null}
      <span
        className={`pill ${data.status === 'Pending' ? 'is-brand' : data.status === 'In review' ? 'is-warning' : data.kind === 'refund' ? 'is-danger' : 'is-success'}`}
      >
        {data.status}
      </span>
    </span>
  );
}

function AmountCell({ value }: CustomCellRendererProps<Row, number>) {
  if (value === null || value === undefined) return <span className="grid-muted">—</span>;
  return (
    <span className={`grid-amount ${value > 0 ? 'is-in' : value < 0 ? 'is-out' : ''}`}>
      {usd(value, true)}
    </span>
  );
}

export function Transactions({
  initialQuery,
  initialFilter,
  initialRecordId,
}: {
  initialQuery: string;
  initialFilter: Filter;
  initialRecordId: string | null;
}) {
  const { state, live, syncNow } = useWorkspace();
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [query, setQuery] = useState(initialQuery);
  const [selectedId, setSelectedId] = useState<string | null>(initialRecordId);
  const { active, open, close } = useOverlay();
  const drawerOpen = selectedId !== null && active === 'record';
  // A record linked from elsewhere (notification, AI citation, Studio) opens its drawer on arrival.
  useEffect(() => {
    if (!initialRecordId) return;
    const task = window.setTimeout(() => open('record'), 0);
    return () => window.clearTimeout(task);
  }, [initialRecordId, open]);

  function openRecord(id: string | null) {
    setSelectedId(id);
    if (id) open('record');
  }

  function closeRecord() {
    close('record');
    setSelectedId(null);
  }
  const allRows = useMemo(() => [...liveRows(live), ...sampleRows(state)], [live, state]);
  const rows = useMemo(() => allRows.filter((row) => matches(row, filter)), [allRows, filter]);
  const selected = allRows.find((row) => row.id === selectedId) ?? null;
  const counts = useMemo(
    () =>
      Object.fromEntries(
        filters.map((item) => [item.id, allRows.filter((row) => matches(row, item.id)).length]),
      ),
    [allRows],
  ) as Record<Filter, number>;

  const totals = useMemo(() => {
    const visible = rows.filter(
      (row) =>
        row.status === 'Completed' &&
        (!query ||
          `${row.counterparty} ${row.subject} ${row.id}`
            .toLowerCase()
            .includes(query.toLowerCase())),
    );
    return {
      count: visible.length,
      inflow: visible
        .filter((row) => row.kind === 'sale')
        .reduce((sum, row) => sum + row.amount, 0),
      fees: visible.reduce(
        (sum, row) => sum + (row.kind === 'sale' || row.kind === 'refund' ? (row.fee ?? 0) : 0),
        0,
      ),
      outflow: visible
        .filter((row) => row.kind === 'expense' || row.kind === 'refund')
        .reduce((sum, row) => sum + row.amount, 0),
    };
  }, [rows, query]);

  const columns = useMemo<ColDef<Row>[]>(
    () => [
      {
        field: 'date',
        headerName: 'Date',
        width: 118,
        sort: 'desc',
        valueFormatter: ({ value }) => (value ? longDate(value as string) : ''),
      },
      {
        field: 'counterparty',
        headerName: 'Counterparty',
        flex: 2,
        minWidth: 260,
        cellRenderer: CounterpartyCell,
      },
      { field: 'activity', headerName: 'Activity', width: 140, cellRenderer: ActivityCell },
      { field: 'type', headerName: 'Type', width: 150 },
      { field: 'status', headerName: 'Status', width: 160, cellRenderer: StatusCell },
      {
        field: 'amount',
        headerName: 'Amount',
        width: 130,
        type: 'rightAligned',
        cellRenderer: AmountCell,
      },
      {
        field: 'fee',
        headerName: 'PayPal fee',
        width: 116,
        type: 'rightAligned',
        cellRenderer: AmountCell,
      },
      {
        field: 'net',
        headerName: 'Net',
        width: 130,
        type: 'rightAligned',
        cellRenderer: AmountCell,
      },
      {
        field: 'eventCode',
        headerName: 'Event',
        width: 96,
        cellRenderer: ({ value }: CustomCellRendererProps<Row, string>) => (
          <code className="grid-code">{value}</code>
        ),
        headerTooltip: 'PayPal Transaction Search event code',
      },
    ],
    [],
  );

  function exportCsv() {
    const header = [
      'record_id',
      'date',
      'counterparty',
      'subject',
      'activity',
      'type',
      'status',
      'amount',
      'fee',
      'net',
      'event_code',
    ];
    const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const lines = rows.map((row) =>
      [
        row.id,
        row.date,
        row.counterparty,
        row.subject,
        row.activity,
        row.type,
        row.status,
        row.amount,
        row.fee ?? '',
        row.net,
        row.eventCode,
      ]
        .map(escape)
        .join(','),
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `finsig-transactions-${filter}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page transactions-page">
      <section className="page-intro">
        <div>
          <h1>Transactions</h1>
          <p>
            Every PayPal record FinSig reads, normalised and traceable. Click a row to inspect its
            source.
          </p>
        </div>
        <div className="page-intro__actions">
          <button type="button" className="fs-button fs-button--quiet" onClick={exportCsv}>
            <Download size={15} /> Export CSV
          </button>
          <button
            type="button"
            className="fs-button fs-button--primary"
            onClick={() => void syncNow()}
          >
            <RefreshCw
              size={15}
              className={live.status === 'loading' ? 'is-spinning' : undefined}
            />{' '}
            Sync now
          </button>
        </div>
      </section>

      <div className="tx-summary">
        <div className="card">
          <span>Completed records</span>
          <strong>{totals.count}</strong>
        </div>
        <div className="card">
          <span>Payments received</span>
          <strong className="is-in">{usd(totals.inflow)}</strong>
        </div>
        <div className="card">
          <span>PayPal fees</span>
          <strong>{usd(totals.fees)}</strong>
        </div>
        <div className="card">
          <span>Refunds & expenses</span>
          <strong>{usd(totals.outflow)}</strong>
        </div>
      </div>

      {filter === 'live' ? <LiveBanner live={live} /> : null}

      <section className="card tx-card">
        <div className="tx-toolbar">
          <div className="chip-list" role="tablist" aria-label="Record type">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={filter === item.id}
                className={`chip ${filter === item.id ? 'is-active' : ''}`}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
                <span className="chip__count">{counts[item.id]}</span>
              </button>
            ))}
          </div>
          <label className="tx-search">
            <Search size={15} />
            <input
              aria-label="Filter transactions"
              placeholder="Filter by client, subject or ID"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        <div className="tx-grid">
          <AgGridReact<Row>
            theme={gridTheme}
            rowData={rows}
            columnDefs={columns}
            quickFilterText={query}
            getRowId={({ data }) => data.id}
            onRowClicked={(event: RowClickedEvent<Row>) => openRecord(event.data?.id ?? null)}
            rowClass="tx-row"
            animateRows
            suppressCellFocus
            pagination
            paginationPageSize={20}
            paginationPageSizeSelector={false}
            defaultColDef={{ sortable: true, resizable: true, suppressMovable: true }}
            overlayNoRowsTemplate="No records match this filter."
          />
        </div>
      </section>

      {selected && drawerOpen ? (
        <>
          <Scrim onClose={closeRecord} />
          <RecordDrawer row={selected} onClose={closeRecord} />
        </>
      ) : null}
    </div>
  );
}

function LiveBanner({ live }: { live: LiveState }) {
  if (live.status === 'ready') {
    const { totals, refreshedAt, windowStart, windowEnd, records } = live.result;
    return (
      <div className="live-banner">
        <span className="live-dot" />
        <div>
          <strong>
            {records.length} live record{records.length === 1 ? '' : 's'} from PayPal Transaction
            Search (sandbox)
          </strong>
          <span>
            Window {longDate(windowStart)} – {longDate(windowEnd)} · PayPal refreshed{' '}
            {refreshedAt
              ? new Date(refreshedAt).toLocaleString('en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })
              : 'n/a'}{' '}
            · net {money(BigInt(totals.netMinor))}
          </span>
        </div>
        <small>Buyer names, emails and raw transaction IDs never leave the server.</small>
      </div>
    );
  }
  if (live.status === 'unconfigured') {
    return (
      <p className="callout">
        Live PayPal sync is not configured on this deployment. The sample history below uses the
        same pipeline.
      </p>
    );
  }
  if (live.status === 'error') return <p className="callout is-error">{live.message}</p>;
  return <p className="callout">Contacting PayPal sandbox…</p>;
}

function treatment(row: Row): string {
  if (row.live) {
    return 'Read live from the PayPal sandbox through Transaction Search and normalised by the same code as the sample history.';
  }
  const record = row.record!;
  switch (record.kind) {
    case 'sale':
      return record.status === 'P'
        ? 'Pending sample record: excluded from sample balance and income until PayPal completes it.'
        : 'Sample gross income. The PayPal fee is subtracted to get sample net income.';
    case 'refund':
      return `Reduces income exactly once. Linked to ${record.referenceId}, so it follows that payment's activity.`;
    case 'expense':
      return 'Business expense paid through PayPal. Reduces profit and your effective hourly rate, not income.';
    case 'withdrawal':
      return 'Moves money to your bank account. Neither income nor an expense.';
    case 'review':
      return 'Account correction held for review. FinSig never counts it as income.';
  }
}

function RecordDrawer({ row, onClose }: { row: Row; onClose: () => void }) {
  const record = row.record;
  const reference = record?.referenceId ? recordById.get(record.referenceId) : null;
  const fields: [string, string][] = [
    ['Record ID', row.id],
    ['PayPal event', `${row.eventCode} · ${eventCodeMeaning[row.eventCode] ?? 'Other event'}`],
    ['Initiated (UTC)', new Date(row.date).toISOString().replace('T', ' ').slice(0, 16)],
    ['Status', `${row.status}${row.live ? ' (live sandbox)' : ''}`],
    ['Amount', usd(row.amount, true)],
    ['PayPal fee', row.fee === null ? 'Not returned' : usd(row.fee, true)],
    ['Net effect', usd(row.net, true)],
    ['Activity', row.needsReview ? 'Needs your confirmation' : row.activity],
  ];
  if (reference) fields.push(['References', `${reference.id} · ${reference.subject}`]);
  return (
    <div className="drawer" role="dialog" aria-modal="true" aria-label={`Record ${row.id}`}>
      <div className="drawer__head">
        <div>
          <p className="muted-label">{row.type}</p>
          <h2>{row.counterparty}</h2>
          <span>{row.subject}</span>
        </div>
        <button type="button" className="drawer__close" onClick={onClose} aria-label="Close record">
          <X size={16} />
        </button>
      </div>
      <strong className={`drawer__amount ${row.kind !== 'review' && row.net >= 0 ? 'is-in' : ''}`}>
        {usd(row.amount, true)}
      </strong>
      <p className="callout">
        <ShieldCheck size={14} /> {treatment(row)}
      </p>
      <dl className="drawer__fields">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {record && row.needsReview ? <ReviewQueue recordIds={[record.id]} /> : null}
    </div>
  );
}
