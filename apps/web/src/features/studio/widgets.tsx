'use client';

import { createWidgets, type AgWidgetCustomCellRendererProps } from 'ag-studio-react';
import type { AgWidgetField } from 'ag-studio';
import { NetChangeBridgeWidget } from './NetChangeBridgeWidget';
import type { FinSigStudioRegistry } from './types';

function SourceLinkRenderer({ value }: AgWidgetCustomCellRendererProps) {
  if (typeof value !== 'string' || !value.startsWith('/app/')) return String(value ?? '');
  return (
    <a className="fs-studio-source-link" href={value}>
      Open record
    </a>
  );
}

export const finSigWidgets = createWidgets<FinSigStudioRegistry>({
  additionalTypes: [
    {
      id: 'finsig-net-change-bridge',
      label: 'FinSig net change bridge',
      comp: NetChangeBridgeWidget,
      dataMapping: {},
      defaultSize: { height: 340, width: 600 },
      minSize: { height: 250, width: 360 },
      form: ({ createDefaults }) => createDefaults({ dataMappingItems: [] }),
      ai: {
        label: 'Verified net change bridge',
        description:
          'A FinSig-specific reconciliation widget that explains the exact change in net income with source-linked factors.',
        usage:
          'Use when the reader asks why income changed. It is deterministic and should not be replaced with an unverified narrative.',
        configuration:
          'The widget reads the server-verified bridge from application context. No model-generated amount is accepted.',
      },
    },
  ],
  overrides: [
    {
      id: 'grid',
      options: {
        createCellRenderer: (field: AgWidgetField) =>
          field.fieldId.endsWith('.source') ? SourceLinkRenderer : undefined,
      },
    },
  ],
  defaultType: 'grid',
  menu: [
    { label: 'FinSig', widgetIds: ['finsig-net-change-bridge'] },
    {
      label: 'Financial overview',
      widgetIds: ['value', 'column-chart-grouped', 'line-chart', 'donut-chart'],
    },
    { label: 'Evidence', widgetIds: ['grid', 'pivot-grid'] },
  ],
});
