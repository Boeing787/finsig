import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { readSessionToken, SESSION_COOKIE } from '../../../../src/auth/session';
import { AIOutputError, AIProviderError, AIUnavailableError } from '../../../../src/ai/anthropic';
import { answerQuestion, suggestActivity } from '../../../../src/ai/grounding';
import {
  classifiableRecordIds,
  initialWorkspaceState,
  PERIODS,
  type WorkspaceState,
} from '../../../../src/domain/workspace';

export const runtime = 'nodejs';

const requestSchema = z.discriminatedUnion('task', [
  z.object({
    task: z.literal('classify'),
    recordId: z.string().refine((id) => classifiableRecordIds.includes(id)),
  }),
  z.object({
    task: z.literal('ask'),
    question: z.string().trim().min(3).max(240),
    period: z.enum(PERIODS),
    /** The person's own inputs, validated here and used only to recompute metrics in code. */
    workspace: z
      .object({
        confirmed: z.record(
          z.string().refine((id) => classifiableRecordIds.includes(id)),
          z.enum(['design', 'consulting', 'support']),
        ),
        hours: z.partialRecord(
          z.enum(PERIODS),
          z.partialRecord(
            z.enum(['design', 'consulting', 'support']),
            z.string().regex(/^\d{1,3}\.\d{2}$/u),
          ),
        ),
        taxRatePercent: z.number().int().min(0).max(60),
        monthlyGoalUsd: z.number().int().min(100).max(1_000_000),
      })
      .optional(),
  }),
]);

function toState(input: z.infer<typeof requestSchema> & { task: 'ask' }): WorkspaceState {
  if (!input.workspace) return initialWorkspaceState;
  return {
    confirmedActivityIds: input.workspace.confirmed,
    hours: input.workspace.hours,
    taxRatePercent: input.workspace.taxRatePercent,
    monthlyGoalMinor: BigInt(input.workspace.monthlyGoalUsd) * 100n,
  };
}

const cache = new Map<string, { expiresAt: number; value: unknown }>();
let uncachedCalls = 0;
let windowStart = Date.now();
const HOURLY_LIMIT = 30;

export async function POST(request: NextRequest) {
  const session = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const body = await request.text();
  if (body.length > 6_000) {
    return NextResponse.json({ error: 'Request too large.' }, { status: 413 });
  }
  let parsed: z.infer<typeof requestSchema>;
  try {
    parsed = requestSchema.parse(JSON.parse(body));
  } catch {
    return NextResponse.json({ error: 'Invalid AI request.' }, { status: 400 });
  }
  const key =
    parsed.task === 'classify'
      ? `classify:${parsed.recordId}`
      : `ask:${parsed.period}:${JSON.stringify(parsed.workspace ?? null)}:${parsed.question.toLowerCase().replace(/\s+/gu, ' ')}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.value, { headers: { 'Cache-Control': 'no-store' } });
  }
  if (Date.now() - windowStart > 3_600_000) {
    windowStart = Date.now();
    uncachedCalls = 0;
  }
  if (uncachedCalls >= HOURLY_LIMIT) {
    return NextResponse.json(
      { error: 'AI demo call limit reached. Try a suggested question or come back later.' },
      { status: 429 },
    );
  }
  uncachedCalls += 1;
  try {
    const result =
      parsed.task === 'classify'
        ? await suggestActivity(parsed.recordId)
        : await answerQuestion(parsed.question, parsed.period, toState(parsed));
    cache.set(key, { expiresAt: Date.now() + 3_600_000, value: result });
    if (cache.size > 200) cache.delete(cache.keys().next().value!);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.warn(
      `[ai] ${parsed.task} rejected: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
    const status =
      error instanceof AIUnavailableError
        ? 503
        : error instanceof AIOutputError || error instanceof AIProviderError
          ? 502
          : 500;
    return NextResponse.json(
      {
        error:
          error instanceof AIUnavailableError
            ? 'AI is not configured on this server.'
            : 'The AI answer could not be verified against your data, so nothing was shown. Try rephrasing.',
      },
      { status },
    );
  }
}
