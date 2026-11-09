import type { AgDefaultRegistry, AgWidgetData, AgWidgetDataFormat } from 'ag-studio';
import type { AgAiToolDisplay, AgRegistry, AgWidgetDefinition } from 'ag-studio-react';
import type { AnalyticsBridgeItem } from '../../domain/analytics';

export type BridgeWidgetFormat = AgWidgetDataFormat<{
  accentColor?: string;
}>;

export interface BridgeWidgetState extends AgWidgetData<Record<string, never>, BridgeWidgetFormat> {
  type: 'finsig-net-change-bridge';
}

type BuiltInWidgetDefinition = AgDefaultRegistry['widgets'][number];
type BridgeWidgetDefinition = AgWidgetDefinition<'finsig-net-change-bridge', BridgeWidgetState>;

export interface FinSigStudioRegistry extends AgRegistry {
  widgets: readonly (BuiltInWidgetDefinition | BridgeWidgetDefinition)[];
  components: Record<string, never>;
  aiToolDisplay: AgAiToolDisplay;
  formats: AgDefaultRegistry['formats'];
  buckets: AgDefaultRegistry['buckets'];
}

export type FinSigStudioContext = {
  bridge: AnalyticsBridgeItem[];
  currentNetUsd: number;
  deltaUsd: number;
  previousNetUsd: number;
};
