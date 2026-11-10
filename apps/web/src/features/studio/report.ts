import type { AgReportState, AgResponsiveLayoutBreakpoint } from 'ag-studio';
import type { FinSigStudioRegistry } from './types';

/**
 * The income investigation as an AG Studio report: the verified bridge beside an evidence ledger.
 * Which records the ledger shows comes from the page's drill-through filter, not from this state,
 * so the saved report stays the same for every month.
 */
export const finSigInitialReport: AgReportState<FinSigStudioRegistry> = {
  selectedPageId: 'income-investigation',
  // Customize analysis opens on the agent; the other panels start as rails beside it.
  panels: {
    ai: { width: 340 },
    edit: { collapsed: true },
    data: { collapsed: true },
    filters: { collapsed: true },
  },
  pages: [
    {
      id: 'income-investigation',
      layout: {
        type: 'widget',
        columns: 24,
        rowHeight: 18,
        minWidth: 320,
        maxWidth: undefined,
        height: undefined,
        pagePadding: 0,
        backgroundColor: 'transparent',
        widgetPadding: 8,
        widgetBackgroundColor: '#ffffff',
        widgetBorderEnabled: true,
        widgetBorderRadius: 22,
        widgetBorderColor: '#e6e9f4',
        widgetBorderWidth: 1,
      },
      widgets: {
        'net-bridge': {
          type: 'finsig-net-change-bridge',
          dataMapping: {},
        },
        'evidence-ledger': {
          type: 'grid',
          dataMapping: {
            cols: [
              { id: 'transactions.date' },
              { id: 'transactions.client' },
              { id: 'transactions.amount_usd' },
              { id: 'transactions.fees_usd' },
              { id: 'transactions.source' },
            ],
          },
          format: {
            title: { enabled: true, text: 'Evidence ledger' },
            subtitle: {
              enabled: true,
              text: 'The PayPal records behind the selected factor. Amounts add up to the bridge.',
            },
            // A row click must not filter the rest of the report to that one row.
            triggerCrossFilter: false,
            // Columns fit their content so all five stay visible on a laptop-width canvas.
            style: { columnAutoSize: true },
          },
        },
      },
      widgetLayout: {
        // Authored stacked, which suits the editor's narrower canvas; wide view mode places the
        // two side by side (see investigationBreakpoints).
        'net-bridge': { xTrack: 0, yTrack: 0, xSpan: 24, ySpan: 30 },
        'evidence-ledger': { xTrack: 0, yTrack: 30, xSpan: 24, ySpan: 24 },
      },
    },
  ],
};

/**
 * View mode only (Studio applies breakpoints only there). From 900px of canvas the investigation
 * puts the bridge beside the evidence it points to. A report someone has customized keeps the
 * layout they authored.
 */
export const investigationBreakpoints: AgResponsiveLayoutBreakpoint[] = [
  {
    minWidth: 900,
    layout: (candidates, { columns }) => {
      const stacked = candidates.every(({ layout }) => layout.xSpan === columns);
      if (candidates.length !== 2 || !stacked) return candidates.map(({ layout }) => layout);
      const bridgeSpan = Math.round((columns * 9) / 24);
      return [
        { xTrack: 0, yTrack: 0, xSpan: bridgeSpan, ySpan: 30 },
        { xTrack: bridgeSpan, yTrack: 0, xSpan: columns - bridgeSpan, ySpan: 30 },
      ];
    },
  },
];
