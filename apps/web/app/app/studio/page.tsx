import {
  buildAnalyticsBridge,
  buildAnalyticsRecords,
  buildAnalyticsSummary,
} from '../../../src/domain/analytics';
import { DEFAULT_PERIOD, monthName, previousPeriod } from '../../../src/domain/workspace';
import { StudioWorkspace } from '../../../src/features/studio/StudioWorkspace';

export const metadata = { title: 'Analytics studio · FinSig' };

export default function StudioPage() {
  return (
    <StudioWorkspace
      bridge={buildAnalyticsBridge(DEFAULT_PERIOD)}
      records={buildAnalyticsRecords()}
      summary={buildAnalyticsSummary(DEFAULT_PERIOD)}
      periodLabel={monthName(DEFAULT_PERIOD)}
      previousLabel={monthName(previousPeriod(DEFAULT_PERIOD))}
    />
  );
}
