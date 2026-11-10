import type { AgReportState } from 'ag-studio';
import type { FinSigStudioRegistry } from './types';

export const finSigInitialReport: AgReportState<FinSigStudioRegistry> = {
  selectedPageId: 'income-studio',
  pages: [
    {
      id: 'income-studio',
      layout: {
        type: 'widget',
        columns: 24,
        rowHeight: 18,
        minWidth: 760,
        maxWidth: undefined,
        height: undefined,
        pagePadding: 16,
        backgroundColor: '#eef1f8',
        widgetPadding: 16,
        widgetBackgroundColor: '#ffffff',
        widgetBorderEnabled: true,
        widgetBorderRadius: 20,
        widgetBorderColor: '#e3e7f3',
        widgetBorderWidth: 1,
      },
      widgets: {
        'net-total': {
          type: 'value',
          dataMapping: { value: [{ id: 'transactions.net_usd', aggregation: 'sum' }] },
          format: {
            title: { enabled: true, text: 'Net income' },
            subtitle: { enabled: true, text: 'Fictional sample history after PayPal fees' },
          },
        },
        'client-chart': {
          type: 'column-chart-grouped',
          dataMapping: {
            categoryKey: [{ id: 'transactions.client' }],
            valueKey: [{ id: 'transactions.net_usd', aggregation: 'sum' }],
          },
          format: {
            title: { enabled: true, text: 'Net by client' },
            subtitle: { enabled: true, text: 'Click a bar to cross-filter the ledger' },
            triggerCrossFilter: true,
          },
        },
        'net-bridge': {
          type: 'finsig-net-change-bridge',
          dataMapping: {},
        },
        'monthly-trend': {
          type: 'line-chart',
          dataMapping: {
            categoryKey: [{ id: 'transactions.month' }],
            valueKey: [{ id: 'transactions.net_usd', aggregation: 'sum' }],
          },
          format: {
            title: { enabled: true, text: 'Net income by month' },
            subtitle: { enabled: true, text: 'Twelve complete months plus November to date' },
          },
        },
        'source-grid': {
          type: 'grid',
          dataMapping: {
            cols: [
              { id: 'transactions.date' },
              { id: 'transactions.client' },
              { id: 'transactions.activity' },
              { id: 'transactions.type' },
              { id: 'transactions.status' },
              { id: 'transactions.net_usd' },
              { id: 'transactions.source' },
            ],
          },
          format: {
            title: { enabled: true, text: 'Source ledger' },
            subtitle: { enabled: true, text: 'Every number remains traceable to a PayPal record' },
          },
        },
      },
      widgetLayout: {
        'net-total': { xTrack: 0, yTrack: 0, xSpan: 6, ySpan: 9 },
        'client-chart': { xTrack: 0, yTrack: 9, xSpan: 6, ySpan: 14 },
        'net-bridge': { xTrack: 6, yTrack: 0, xSpan: 9, ySpan: 23 },
        'monthly-trend': { xTrack: 15, yTrack: 0, xSpan: 9, ySpan: 23 },
        'source-grid': { xTrack: 0, yTrack: 23, xSpan: 24, ySpan: 24 },
      },
    },
  ],
};
