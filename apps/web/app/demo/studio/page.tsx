import {
  buildAnalyticsBridge,
  buildAnalyticsRecords,
  buildAnalyticsSummary,
} from '../../../src/domain/analytics';
import { StudioClient } from './StudioClient';

export const dynamic = 'force-static';

export default function StudioPage() {
  const summary = buildAnalyticsSummary();
  return (
    <StudioClient
      bridge={buildAnalyticsBridge()}
      records={buildAnalyticsRecords()}
      summary={summary}
    />
  );
}
