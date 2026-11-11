import { z } from 'zod';
import type { WorkspaceState } from '../../domain/workspace';

export const classificationResponse = z.object({
  record_id: z.string(),
  activity_id: z.enum(['design', 'consulting', 'support']).nullable(),
  evidence: z.array(z.object({ field: z.string(), value: z.string() })),
  question: z.string(),
  model: z.string(),
});

export const answerResponse = z.object({
  model: z.string(),
  period: z.string(),
  unsupported: z.boolean(),
  claims: z.array(
    z.object({
      text: z.string(),
      metrics: z.array(z.object({ id: z.string(), label: z.string(), value: z.string() })),
      recordIds: z.array(z.string()),
    }),
  ),
});

export type Classification = z.infer<typeof classificationResponse>;
export type Answer = z.infer<typeof answerResponse>;

async function callAI(body: unknown): Promise<unknown> {
  const response = await fetch('/api/demo/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = z.object({ error: z.string() }).safeParse(json);
    throw new Error(error.success ? error.data.error : 'AI request failed.');
  }
  return json;
}

export async function requestClassification(recordId: string): Promise<Classification> {
  return classificationResponse.parse(await callAI({ task: 'classify', recordId }));
}

export async function askFinSig(
  question: string,
  period: string,
  state: WorkspaceState,
): Promise<Answer> {
  const workspace = {
    confirmed: state.confirmedActivityIds,
    hours: state.hours,
    taxRatePercent: state.taxRatePercent,
    monthlyGoalUsd: Number(state.monthlyGoalMinor / 100n),
    expectations: {
      ...state.expectations,
      added: state.expectations.added.map((entry) => ({
        ...entry,
        amountMinor: entry.amountMinor.toString(),
      })),
    },
  };
  return answerResponse.parse(await callAI({ task: 'ask', question, period, workspace }));
}

export const suggestedQuestions = [
  'Why did my net income change this month?',
  'Which kind of work pays me best per hour?',
  'Am I too dependent on one client?',
  'How much should I set aside for taxes?',
  'What should I expect over the next 30 days?',
];
