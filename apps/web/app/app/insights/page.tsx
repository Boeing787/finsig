import { Insights } from '../../../src/features/workspace/Insights';

export const metadata = { title: 'AI Insights · FinSig' };

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const question = params.q?.trim().slice(0, 240) || null;
  return <Insights key={question ?? 'none'} initialQuestion={question} />;
}
