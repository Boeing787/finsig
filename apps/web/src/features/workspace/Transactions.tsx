'use client';

import type { CustomCellRendererProps } from 'ag-grid-react';
import { AgGridReact } from 'ag-grid-react';
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type GridApi,
  type GridSizeChangedEvent,
  type RowClickedEvent,
} from 'ag-grid-community';
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Download,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  activityName,
  clientName,
  kindLabels,
  longDate,
  money,
  monthLong,
  monthTotals,
  recordById,
  recordNetMinor,
  resolvedActivity,
  shortDate,
  workspaceRecords,
  type WorkspaceRecord,
} from '../../domain/workspace';
import { ClientAvatar, eventCodeMeaning, RecordIcon } from './parts';
import { Scrim, useOverlay } from './overlay';
import { ReviewQueue } from './ReviewQueue';
import { useWorkspace, type LiveState } from './WorkspaceProvider';

ModuleRegistry.registerModules([AllCommunityModule]);

/**
 * AG Grid on the FinSig token contract (`@finsig/ui/styles.css`). The data area is transparent so
 * the frosted card shows through; headers sit on the tint surface; hover, selection and focus use
 * the brand indigo. Popups keep the raised white surface.
 */
const gridTheme = themeQuartz.withParams({
  accentColor: 'var(--fs-brand)',
  backgroundColor: 'var(--fs-surface-raised)',
  wrapperBackgroundColor: 'transparent',
  dataBackgroundColor: 'transparent',
  chromeBackgroundColor: 'transparent',
  headerBackgroundColor: 'color-mix(in srgb, var(--fs-surface-tint) 80%, transparent)',
  foregroundColor: 'var(--fs-ink)',
  textColor: 'var(--fs-ink)',
  subtleTextColor: 'var(--fs-ink-muted)',
  headerTextColor: 'var(--fs-ink-muted)',
  iconColor: 'var(--fs-ink-faint)',
  borderColor: 'var(--fs-border)',
  rowBorder: { color: 'var(--fs-border)' },
  headerRowBorder: { color: 'var(--fs-border)' },
  columnBorder: false,
  headerColumnBorder: false,
  wrapperBorder: false,
  wrapperBorderRadius: 0,
  borderRadius: 10,
  rowHoverColor: 'color-mix(in srgb, var(--fs-brand) 5%, transparent)',
  selectedRowBackgroundColor: 'color-mix(in srgb, var(--fs-brand) 11%, transparent)',
  rangeSelectionBorderColor: 'var(--fs-brand)',
  focusShadow: '0 0 0 3px color-mix(in srgb, var(--fs-focus) 28%, transparent)',
  fontFamily: 'var(--fs-font-body)',
  headerFontFamily: 'var(--fs-font-body)',
  fontSize: 13,
  headerFontSize: 11,
  headerFontWeight: 700,
  rowHeight: 56,
  headerHeight: 40,
  spacing: 6,
  cellHorizontalPadding: 14,
  iconSize: 14,
  paginationPanelHeight: 52,
  browserColorScheme: 'light',
  tooltipBackgroundColor: 'var(--fs-ink-strong)',
  tooltipTextColor: '#ffffff',
  tooltipBorder: false,
});

const PAGE_SIZE = 20;

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

type Status = 'Completed' | 'Pending' | 'In review';

interface Row {
  id: string;
  date: string;
  counterparty: string;
  subject: string;
  activity: string;
  needsReview: boolean;
  kind: WorkspaceRecord['kind'];
  type: string;
  status: Status;
  /** Completed and not held for review: the amount is part of FinSig's totals. */
  counted: boolean;
  amount: number;
  fee: number | null;
  net: number;
  eventCode: string;
  live: boolean;
  record: WorkspaceRecord | null;
}

interface GridContext {
  openRecord: (id: string) => void;
}

const usd = (value: number, signed = false) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(value);

function statusOf(kind: Row['kind'], status: string): Status {
  if (kind === 'review') return 'In review';
  return status === 'P' ? 'Pending' : 'Completed';
}

function sampleRows(state: ReturnType<typeof useWorkspace>['state']): Row[] {
  return workspaceRecords.map((record) => {
    const activity = resolvedActivity(record, state);
    const status = statusOf(record.kind, record.status);
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
      needsReview: record.kind === 'sale' && !activity,
      kind: record.kind,
      type: kindLabels[record.kind],
      status,
      counted: status === 'Completed',
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
    const status = statusOf(record.kind, record.status);
    return {
      id: `live-${record.id}`,
      date: record.initiatedAt,
      counterparty: 'PayPal sandbox buyer',
      subject: record.subject ?? 'Sandbox transaction',
      activity: '—',
      needsReview: false,
      kind: record.kind,
      type: kindLabels[record.kind],
      status,
      counted: status === 'Completed',
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

/** The same text the grid's quick filter searches, so the summary cards agree with the grid. */
const searchText = (row: Row) => `${row.counterparty} ${row.subject} ${row.id}`;

// Cells --------------------------------------------------------------------------------------

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
        <span>
          <em className="grid-party__date">{shortDate(data.date)} · </em>
          {data.subject}
        </span>
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

const statusTone: Record<Status, string> = {
  Completed: 'is-success',
  Pending: 'is-brand',
  'In review': 'is-warning',
};

function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`grid-state ${statusTone[status]}`}>
      <i aria-hidden="true" />
      {status}
    </span>
  );
}

function StatusCell({ data }: CustomCellRendererProps<Row>) {
  return data ? <StatusBadge status={data.status} /> : null;
}

function uncountedReason(row: Row): string {
  return row.status === 'Pending'
    ? 'Pending: not counted until PayPal completes it'
    : 'Held for review: never counted as income';
}

function GrossCell({ data }: CustomCellRendererProps<Row>) {
  if (!data) return null;
  return (
    <span className={`grid-money ${data.counted ? '' : 'is-uncounted'}`}>
      {usd(data.amount, true)}
    </span>
  );
}

function FeeCell({ data }: CustomCellRendererProps<Row>) {
  if (!data) return null;
  if (!data.fee) return <span className="grid-muted">—</span>;
  return (
    <span className={`grid-money is-fee ${data.counted ? '' : 'is-uncounted'}`}>
      {usd(data.fee, true)}
    </span>
  );
}

function netTone(row: Row): string {
  if (!row.counted) return 'is-uncounted';
  if (row.kind === 'refund') return 'is-refund';
  return row.net > 0 ? 'is-in' : 'is-out';
}

function NetCell({ data }: CustomCellRendererProps<Row>) {
  if (!data) return null;
  return (
    <span
      className={`grid-money is-net ${netTone(data)}`}
      title={data.counted ? undefined : uncountedReason(data)}
    >
      {usd(data.net, true)}
    </span>
  );
}

function SourceCell({ data }: CustomCellRendererProps<Row>) {
  if (!data) return null;
  return (
    <div
      className="grid-source"
      title={`${data.eventCode} · ${eventCodeMeaning[data.eventCode] ?? 'Other PayPal event'}`}
    >
      <strong>{data.type}</strong>
      <span>
        <code className="grid-code">{data.eventCode}</code>
        {data.live ? (
          <span className="grid-source__live">
            <i aria-hidden="true" /> Live
          </span>
        ) : (
          'Sample'
        )}
      </span>
    </div>
  );
}

function OpenCell({ data, context }: CustomCellRendererProps<Row, unknown, GridContext>) {
  if (!data) return null;
  return (
    <button
      type="button"
      className="grid-open"
      aria-label={`Open evidence for ${data.counterparty}, ${longDate(data.date)}`}
      onClick={(event) => {
        event.stopPropagation();
        context.openRecord(data.id);
      }}
    >
      <ChevronRight size={16} />
    </button>
  );
}

/**
 * Narrow grids drop columns in this order (fee first) so the ledger never scrolls sideways; the
 * evidence drawer still shows every field. Each step is the width the remaining columns need with
 * a 200px counterparty column. Below the last step the date moves under the counterparty.
 */
const COMPACT_BELOW = 592;
const columnDropOrder: [string[], number][] = [
  [['fee'], 1072],
  [['amount'], 976],
  [['source'], 866],
  [['activity'], 716],
  [['date', 'status'], COMPACT_BELOW],
];

function fitColumns(api: GridApi<Row>, width: number): boolean {
  for (const [ids, minWidth] of columnDropOrder) api.setColumnsVisible(ids, width >= minWidth);
  return width < COMPACT_BELOW;
}

// Page ---------------------------------------------------------------------------------------

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
  const [order, setOrder] = useState<string[]>([]);
  // Where the open record sat in the ledger, so Previous/Next keep working after it leaves the
  // current filter (for example once its activity is confirmed under "Needs review").
  const [anchor, setAnchor] = useState(-1);
  const orderRef = useRef<string[]>([]);
  const [compact, setCompact] = useState(false);
  const gridApi = useRef<GridApi<Row> | null>(null);
  const gridBox = useRef<HTMLDivElement>(null);
  const { active, open, close } = useOverlay();
  const drawerOpen = selectedId !== null && active === 'record';

  // A record linked from elsewhere (notification, AI citation, Studio) opens its drawer on arrival.
  useEffect(() => {
    if (!initialRecordId) return;
    const task = window.setTimeout(() => open('record'), 0);
    return () => window.clearTimeout(task);
  }, [initialRecordId, open]);

  const openRecord = useCallback(
    (id: string) => {
      setSelectedId(id);
      setAnchor(orderRef.current.indexOf(id));
      open('record');
    },
    [open],
  );

  function closeRecord() {
    close('record');
    setSelectedId(null);
  }

  const gridContext = useMemo<GridContext>(() => ({ openRecord }), [openRecord]);

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
    const needle = query.trim().toLowerCase();
    const visible = rows.filter(
      (row) => row.counted && (!needle || searchText(row).toLowerCase().includes(needle)),
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

  /** Highlight the open record in the ledger and bring its page and row into view. */
  const revealSelection = useCallback(() => {
    const api = gridApi.current;
    if (!api) return;
    const node = drawerOpen && selectedId ? api.getRowNode(selectedId) : undefined;
    if (!node || node.rowIndex === null || node.rowIndex === undefined) {
      api.deselectAll();
      return;
    }
    node.setSelected(true, true);
    const page = Math.floor(node.rowIndex / PAGE_SIZE);
    if (page !== api.paginationGetCurrentPage()) api.paginationGoToPage(page);
    window.requestAnimationFrame(() => {
      gridBox.current
        ?.querySelector(`[row-id="${CSS.escape(node.id ?? '')}"]`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }, [drawerOpen, selectedId]);

  useEffect(() => {
    revealSelection();
  }, [revealSelection, rows]);

  function captureOrder(api: GridApi<Row>) {
    const ids: string[] = [];
    api.forEachNodeAfterFilterAndSort((node) => {
      if (node.data) ids.push(node.data.id);
    });
    orderRef.current = ids;
    setOrder((current) => (current.join('|') === ids.join('|') ? current : ids));
  }

  const columns = useMemo<ColDef<Row>[]>(
    () => [
      {
        field: 'date',
        headerName: 'Date',
        width: 108,
        sort: 'desc',
        valueFormatter: ({ value }) => (value ? longDate(value as string) : ''),
        cellClass: 'grid-date',
      },
      {
        field: 'counterparty',
        headerName: 'Counterparty',
        flex: 1,
        minWidth: 150,
        cellRenderer: CounterpartyCell,
        getQuickFilterText: ({ data }) => (data ? searchText(data) : ''),
      },
      { field: 'activity', headerName: 'Activity', width: 124, cellRenderer: ActivityCell },
      { field: 'status', headerName: 'Status', width: 118, cellRenderer: StatusCell },
      {
        field: 'amount',
        headerName: 'Gross',
        width: 108,
        type: 'rightAligned',
        cellRenderer: GrossCell,
      },
      {
        field: 'fee',
        headerName: 'Fee',
        width: 96,
        type: 'rightAligned',
        cellRenderer: FeeCell,
        headerTooltip: 'PayPal fee charged on the payment',
      },
      {
        field: 'net',
        headerName: 'Net',
        width: 112,
        type: 'rightAligned',
        cellRenderer: NetCell,
        headerTooltip: 'Gross minus the PayPal fee',
      },
      {
        colId: 'source',
        field: 'type',
        headerName: 'Source',
        width: 150,
        cellRenderer: SourceCell,
        headerTooltip: 'Record type, PayPal Transaction Search event code and origin',
      },
      {
        colId: 'open',
        headerName: '',
        width: 48,
        sortable: false,
        resizable: false,
        cellRenderer: OpenCell,
        cellClass: 'grid-open-cell',
      },
    ],
    [],
  );

  function exportCsv() {
    const visible: Row[] = [];
    if (gridApi.current) {
      gridApi.current.forEachNodeAfterFilterAndSort((node) => {
        if (node.data) visible.push(node.data);
      });
    } else {
      visible.push(...rows);
    }
    const header = [
      'record_id',
      'date',
      'counterparty',
      'subject',
      'activity',
      'type',
      'status',
      'gross',
      'fee',
      'net',
      'event_code',
      'source',
    ];
    const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const lines = visible.map((row) =>
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
        row.live ? 'paypal_sandbox_live' : 'sample',
      ]
        .map(escape)
        .join(','),
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `finsig-transactions-${filter}${query.trim() ? '-search' : ''}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page transactions-page">
      <section className="page-intro">
        <div>
          <h1>Transactions</h1>
          <p>
            Every PayPal record FinSig reads, normalised and traceable. Open a row to see the source
            and how it adds up.
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
                className={`chip ${filter === item.id ? 'is-active' : ''} ${
                  item.id === 'review' && counts.review > 0 ? 'is-attention' : ''
                }`}
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
              placeholder="Client, subject or record ID"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        <div ref={gridBox} className={`tx-grid ${compact ? 'is-compact' : ''}`}>
          <AgGridReact<Row>
            theme={gridTheme}
            rowData={rows}
            columnDefs={columns}
            context={gridContext}
            quickFilterText={query}
            getRowId={({ data }) => data.id}
            onGridReady={({ api }) => {
              gridApi.current = api;
              setCompact(fitColumns(api, gridBox.current?.clientWidth ?? 1200));
            }}
            onGridSizeChanged={({ api, clientWidth }: GridSizeChangedEvent<Row>) =>
              setCompact(fitColumns(api, clientWidth))
            }
            onFirstDataRendered={revealSelection}
            onModelUpdated={({ api }) => captureOrder(api)}
            onRowClicked={(event: RowClickedEvent<Row>) => {
              if (event.data) openRecord(event.data.id);
            }}
            rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: false }}
            rowClass="tx-row"
            domLayout="autoHeight"
            animateRows
            suppressCellFocus
            pagination
            paginationPageSize={PAGE_SIZE}
            paginationPageSizeSelector={false}
            defaultColDef={{ sortable: true, resizable: true, suppressMovable: true }}
            overlayNoRowsTemplate="No records match this filter."
          />
        </div>
      </section>

      {selected && drawerOpen ? (
        <>
          <Scrim onClose={closeRecord} className="is-record" />
          <RecordDrawer
            row={selected}
            order={order}
            anchor={anchor}
            onNavigate={openRecord}
            onClose={closeRecord}
          />
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

// Evidence drawer ----------------------------------------------------------------------------

function treatment(row: Row): string {
  if (row.live) {
    return 'Read live from the PayPal sandbox through Transaction Search and normalised by the same code as the sample history. It stays out of the sample analytics.';
  }
  const record = row.record!;
  switch (record.kind) {
    case 'sale':
      return record.status === 'P'
        ? 'Pending: excluded from balance and income until PayPal completes it.'
        : 'Counted as gross income. The PayPal fee is subtracted to get net income.';
    case 'refund':
      return 'Reduces income exactly once, under the activity of the payment it refunds.';
    case 'expense':
      return 'Business expense paid through PayPal. Reduces profit and your effective hourly rate, not income.';
    case 'withdrawal':
      return 'Moves money to your bank account. Neither income nor an expense.';
    case 'review':
      return 'Account correction held for review. FinSig never counts it as income.';
  }
}

const grossLabel: Record<Row['kind'], string> = {
  sale: 'Gross received',
  refund: 'Refunded to client',
  expense: 'Paid',
  withdrawal: 'Transferred out',
  review: 'Held amount',
};

interface Contribution {
  label: string;
  value?: string;
  href?: string;
}

/** The FinSig totals this record is part of: the reverse of an AI citation. */
function contributions(row: Row): Contribution[] {
  const record = row.record;
  if (!record || !row.counted) return [];
  const month = record.initiatedAt.slice(0, 7);
  const name = monthLong(month);
  const totals = monthTotals(month);
  if (record.kind === 'sale' || record.kind === 'refund') {
    const items: Contribution[] = [{ label: `${name} net income`, value: money(totals.netMinor) }];
    if (record.kind === 'refund') {
      items.push({ label: `${name} refunds`, value: money(totals.refundsMinor) });
    }
    items.push({ label: `${name} PayPal fees`, value: money(totals.feesMinor) });
    if (record.clientId) {
      items.push({
        label: `${clientName(record.clientId)} client history`,
        href: `/app/clients?focus=${record.clientId}`,
      });
    }
    return items;
  }
  if (record.kind === 'expense') {
    return [
      { label: `${name} business expenses`, value: money(totals.expensesMinor) },
      { label: `${name} profit after expenses`, value: money(totals.profitMinor) },
    ];
  }
  return [];
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

function RecordDrawer({
  row,
  order,
  anchor,
  onNavigate,
  onClose,
}: {
  row: Row;
  order: string[];
  anchor: number;
  onNavigate: (id: string) => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const record = row.record;
  const reference = record?.referenceId ? recordById.get(record.referenceId) : null;
  const feeds = contributions(row);
  const position = order.indexOf(row.id);
  const base = position >= 0 ? position : anchor;
  const previousId = base > 0 ? order[base - 1] : undefined;
  // A record that left the view was replaced at its index by the one that followed it.
  const nextId = position >= 0 ? order[position + 1] : base >= 0 ? order[base] : undefined;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      const target =
        event.key === 'ArrowDown' || event.key === 'j'
          ? nextId
          : event.key === 'ArrowUp' || event.key === 'k'
            ? previousId
            : undefined;
      if (!target) return;
      event.preventDefault();
      onNavigate(target);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nextId, previousId, onNavigate]);

  function copyId() {
    void navigator.clipboard?.writeText(row.id).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div
      className="drawer evidence"
      role="dialog"
      aria-modal="true"
      aria-labelledby="evidence-title"
    >
      <div className="drawer__head">
        <div className="evidence__who">
          {record ? (
            record.clientId && record.kind === 'sale' ? (
              <ClientAvatar clientId={record.clientId} size={40} />
            ) : (
              <RecordIcon record={record} />
            )
          ) : (
            <span className="record-icon is-live">P</span>
          )}
          <div>
            <p className="muted-label">{row.type}</p>
            <h2 id="evidence-title">{row.counterparty}</h2>
            <span>{row.subject}</span>
          </div>
        </div>
        <button type="button" className="drawer__close" onClick={onClose} aria-label="Close record">
          <X size={16} />
        </button>
      </div>

      <section className="evidence__amount" aria-label="Amount">
        <div className="evidence__amount-top">
          <span>
            {row.counted
              ? 'Net effect'
              : row.status === 'Pending'
                ? 'Pending · not counted yet'
                : 'Held · not counted'}
          </span>
          <StatusBadge status={row.status} />
        </div>
        <strong className={`drawer__amount ${netTone(row)}`}>{usd(row.net, true)}</strong>
        <dl className="evidence__math">
          <div>
            <dt>{grossLabel[row.kind]}</dt>
            <dd>{usd(row.amount, true)}</dd>
          </div>
          <div>
            <dt>PayPal fee</dt>
            <dd>{row.fee ? usd(row.fee, true) : 'None'}</dd>
          </div>
          <div className="is-total">
            <dt>{row.counted ? 'Net effect' : 'Counted by FinSig'}</dt>
            <dd>{row.counted ? usd(row.net, true) : usd(0)}</dd>
          </div>
        </dl>
      </section>

      <p className="callout">
        <ShieldCheck size={14} /> {treatment(row)}
      </p>

      <section className="evidence__section">
        <h3>PayPal source</h3>
        <dl className="drawer__fields">
          <div>
            <dt>Origin</dt>
            <dd>
              {row.live
                ? 'Live · PayPal sandbox Transaction Search'
                : 'Sample · fictional freelancer workspace'}
            </dd>
          </div>
          <div>
            <dt>Event</dt>
            <dd>
              <code className="grid-code">{row.eventCode}</code>{' '}
              {eventCodeMeaning[row.eventCode] ?? 'Other PayPal event'}
            </dd>
          </div>
          <div>
            <dt>Record ID</dt>
            <dd className="evidence__id">
              <span>{row.id}</span>
              <button
                type="button"
                className="icon-button"
                onClick={copyId}
                aria-label={copied ? 'Record ID copied' : 'Copy record ID'}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </dd>
          </div>
          <div>
            <dt>Initiated</dt>
            <dd>{new Date(row.date).toISOString().replace('T', ' ').slice(0, 16)} UTC</dd>
          </div>
          <div>
            <dt>Activity</dt>
            <dd>{row.needsReview ? 'Needs your confirmation' : row.activity}</dd>
          </div>
          {reference ? (
            <div>
              <dt>{row.kind === 'refund' ? 'Original payment' : 'References'}</dt>
              <dd>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => onNavigate(reference.id)}
                >
                  {reference.subject} · {longDate(reference.initiatedAt)}
                  <ArrowUpRight size={13} />
                </button>
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      {feeds.length ? (
        <section className="evidence__section">
          <h3>Counted in</h3>
          <ul className="evidence__feeds">
            {feeds.map((item) => (
              <li key={item.label}>
                <span>{item.label}</span>
                {item.href ? (
                  <Link className="text-link" href={item.href} onClick={onClose}>
                    Open client <ArrowUpRight size={13} />
                  </Link>
                ) : (
                  <strong>{item.value}</strong>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {record && row.needsReview ? <ReviewQueue recordIds={[record.id]} /> : null}

      <footer className="drawer__nav">
        <button
          type="button"
          className="fs-button fs-button--quiet fs-button--sm"
          disabled={!previousId}
          onClick={() => previousId && onNavigate(previousId)}
        >
          <ChevronUp size={14} /> Previous
        </button>
        <span>{position >= 0 ? `${position + 1} of ${order.length}` : 'Outside this filter'}</span>
        <button
          type="button"
          className="fs-button fs-button--quiet fs-button--sm"
          disabled={!nextId}
          onClick={() => nextId && onNavigate(nextId)}
        >
          Next <ChevronDown size={14} />
        </button>
      </footer>
    </div>
  );
}
