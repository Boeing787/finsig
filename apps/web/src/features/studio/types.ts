import type { AgDefaultRegistry, AgWidgetData, AgWidgetDataFormat } from 'ag-studio';
import type { AgAiToolDisplay, AgRegistry, AgWidgetDefinition } from 'ag-studio-react';
import type { AnalyticsBridgeItem } from '../../domain/analytics';
import type { EvidenceStore } from './selection';

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

/** Read once by AG Studio: the page remounts Studio when the investigated month changes. */
export type FinSigStudioContext = {
  /** Verified bridge factors, largest effect first, PayPal fees last. */
  bridge: AnalyticsBridgeItem[];
  /** Records whose amounts changed: every factor except PayPal fees. */
  changedRecordIds: string[];
  currentNetUsd: number;
  deltaUsd: number;
  previousNetUsd: number;
  periodLabel: string;
  previousLabel: string;
  evidence: EvidenceStore;
};
