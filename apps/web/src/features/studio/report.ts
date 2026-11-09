import type { AgReportState } from 'ag-studio';
import type { FinSigStudioRegistry } from './types';

export const finSigInitialReport: AgReportState<FinSigStudioRegistry> = {
  selectedPageId: 'control-room',
  pages: [
    {
      id: 'control-room',
      layout: {
        type: 'widget',
        columns: 24,
        rowHeight: 18,
        minWidth: 760,
        maxWidth: undefined,
        height: undefined,
        pagePadding: 16,
        backgroundColor: '#f1f1ee',
        widgetPadding: 16,
        widgetBackgroundColor: '#ffffff',
        widgetBorderEnabled: true,
        widgetBorderRadius: 18,
        widgetBorderColor: '#dedfd6',
        widgetBorderWidth: 1,
      },
      widgets: {
        'net-current': {
          type: 'value',
          dataMapping: { value: [{ id: 'transactions.net_usd', aggregation: 'sum' }] },
          format: {
            title: { enabled: true, text: 'Net cash flow' },
            subtitle: { enabled: true, text: 'Commercial PayPal activity' },
          },
        },
        'net-bridge': {
          type: 'finsig-net-change-bridge',
          dataMapping: {},
        },
        'activity-chart': {
          type: 'column-chart-grouped',
          dataMapping: {
            categoryKey: [{ id: 'transactions.activity' }],
            valueKey: [{ id: 'transactions.net_usd', aggregation: 'sum' }],
          },
          format: {
            title: { enabled: true, text: 'Net by activity' },
            subtitle: { enabled: true, text: 'Click a bar to cross-filter evidence' },
            triggerCrossFilter: true,
          },
        },
        'source-grid': {
          type: 'grid',
          dataMapping: {
            cols: [
              { id: 'transactions.date' },
              { id: 'transactions.counterparty' },
              { id: 'transactions.activity' },
              { id: 'transactions.event_code' },
              { id: 'transactions.net_usd' },
              { id: 'transactions.source' },
            ],
          },
          format: {
            title: { enabled: true, text: 'Source ledger' },
            subtitle: { enabled: true, text: 'Every number remains traceable to a record ID' },
          },
        },
      },
      widgetLayout: {
        'net-current': { xTrack: 0, yTrack: 0, xSpan: 6, ySpan: 10 },
        'net-bridge': { xTrack: 6, yTrack: 0, xSpan: 18, ySpan: 20 },
        'activity-chart': { xTrack: 0, yTrack: 10, xSpan: 6, ySpan: 10 },
        'source-grid': { xTrack: 0, yTrack: 20, xSpan: 24, ySpan: 22 },
      },
    },
  ],
};
