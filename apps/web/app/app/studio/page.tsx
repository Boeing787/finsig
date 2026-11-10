import { buildAnalyticsRecords } from '../../../src/domain/analytics';
import { IncomeInvestigation } from '../../../src/features/studio/IncomeInvestigation';

export const metadata = { title: 'Income investigation · FinSig' };

export default function IncomeInvestigationPage() {
  return <IncomeInvestigation records={buildAnalyticsRecords()} />;
}
