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
      label: 'Verified net income bridge',
      comp: NetChangeBridgeWidget,
      dataMapping: {},
      defaultSize: { height: 340, width: 600 },
      minSize: { height: 250, width: 360 },
      form: ({ createDefaults }) => createDefaults({ dataMappingItems: [] }),
      ai: {
        label: 'Verified net change bridge',
        description:
          'The centre of the income investigation: a waterfall from last month to this month with one row per verified factor. Selecting a factor narrows the evidence ledger to its PayPal records.',
        usage:
          'Keep it in every investigation of why income changed. It is deterministic and must not be replaced with an unverified narrative or a chart of model-written numbers.',
        configuration:
          'The widget reads the code-calculated bridge from application context. It takes no data mapping, and no model-generated amount is accepted.',
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
