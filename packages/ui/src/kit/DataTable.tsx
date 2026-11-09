'use client';

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { Columns3, Search } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Input } from '../generic/Input';
import { cx } from '../utils/cx';

type PersistedTableState = {
  columnSizing: ColumnSizingState;
  columnVisibility: VisibilityState;
  sorting: SortingState;
};

export interface DataTableProps<T extends object> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  tableKey: string;
  getRowId: (row: T) => string;
  emptyState?: ReactNode;
  searchPlaceholder?: string;
  stickyFirstColumn?: boolean;
  toolbar?: ReactNode;
  onRowClick?: (row: T) => void;
}

function readPersistedState(key: string): PersistedTableState | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as PersistedTableState) : null;
  } catch {
    return null;
  }
}

export function DataTable<T extends object>({
  columns,
  data,
  tableKey,
  getRowId,
  emptyState = 'No records match the current filters.',
  searchPlaceholder = 'Search records',
  stickyFirstColumn = true,
  toolbar,
  onRowClick,
}: DataTableProps<T>) {
  const storageKey = `finsig:table:${tableKey}`;
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const persisted = readPersistedState(storageKey);
    if (persisted) {
      setSorting(persisted.sorting);
      setColumnVisibility(persisted.columnVisibility);
      setColumnSizing(persisted.columnSizing);
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ sorting, columnVisibility, columnSizing } satisfies PersistedTableState),
    );
  }, [columnSizing, columnVisibility, hydrated, sorting, storageKey]);

  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: { globalFilter, sorting, columnVisibility, columnSizing },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
  });

  const visibleLeafColumns = table.getVisibleLeafColumns();
  const firstColumnId = visibleLeafColumns[0]?.id;
  const settings = useMemo(
    () => table.getAllLeafColumns().filter((column) => column.getCanHide()),
    [table],
  );

  return (
    <div className="fs-data-table">
      <div className="fs-data-table__toolbar">
        <div className="fs-data-table__search">
          <Search aria-hidden="true" size={16} />
          <Input
            aria-label={searchPlaceholder}
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder={searchPlaceholder}
          />
        </div>
        <div className="fs-data-table__tools">
          {toolbar}
          <details className="fs-column-menu">
            <summary className="fs-button fs-button--quiet fs-button--sm">
              <Columns3 aria-hidden="true" size={15} />
              <span>Columns</span>
            </summary>
            <div className="fs-column-menu__popover">
              <strong>Visible columns</strong>
              {settings.map((column) => (
                <label key={column.id}>
                  <input
                    checked={column.getIsVisible()}
                    onChange={column.getToggleVisibilityHandler()}
                    type="checkbox"
                  />
                  {typeof column.columnDef.header === 'string'
                    ? column.columnDef.header
                    : column.id}
                </label>
              ))}
            </div>
          </details>
        </div>
      </div>
      <div className="fs-data-table__viewport">
        <table style={{ width: table.getCenterTotalSize() }}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sticky = stickyFirstColumn && header.column.id === firstColumnId;
                  return (
                    <th
                      className={cx(sticky && 'is-sticky')}
                      key={header.id}
                      style={{ width: header.getSize() }}
                    >
                      <button
                        className={cx('fs-table-sort', header.column.getIsSorted() && 'is-sorted')}
                        disabled={!header.column.getCanSort()}
                        onClick={header.column.getToggleSortingHandler()}
                        type="button"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted() as 'asc' | 'desc'] ??
                          null}
                      </button>
                      {header.column.getCanResize() ? (
                        <button
                          aria-label={`Resize ${header.column.id} column`}
                          className={cx(
                            'fs-column-resizer',
                            header.column.getIsResizing() && 'is-resizing',
                          )}
                          onDoubleClick={() => header.column.resetSize()}
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          type="button"
                        />
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                className={cx(onRowClick && 'is-clickable')}
                key={row.id}
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => {
                  const sticky = stickyFirstColumn && cell.column.id === firstColumnId;
                  return (
                    <td
                      className={cx(sticky && 'is-sticky')}
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {table.getRowModel().rows.length === 0 ? (
          <div className="fs-data-table__empty">{emptyState}</div>
        ) : null}
      </div>
    </div>
  );
}

export type { ColumnDef } from '@tanstack/react-table';
