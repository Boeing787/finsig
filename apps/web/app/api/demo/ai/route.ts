import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AIOutputError, AIProviderError, AIUnavailableError } from '../../../../src/ai/anthropic';
import { explainChange, suggestActivity } from '../../../../src/ai/grounding';

export const runtime = 'nodejs';

const requestSchema = z.discriminatedUnion('task', [
  z.object({ task: z.literal('classify'), recordId: z.literal('pp-oct-consulting') }),
  z.object({ task: z.literal('explain') }),
]);

const cache = new Map<string, { expiresAt: number; value: unknown }>();
let uncachedCalls = 0;
let windowStart = Date.now();

export async function POST(request: NextRequest) {
  const body = await request.text();
  if (body.length > 1_000) {
    return NextResponse.json({ error: 'Request too large.' }, { status: 413 });
  }
  let parsed: z.infer<typeof requestSchema>;
  try {
    parsed = requestSchema.parse(JSON.parse(body));
  } catch {
    return NextResponse.json({ error: 'Invalid demo request.' }, { status: 400 });
  }
  const key = parsed.task === 'classify' ? `classify:${parsed.recordId}` : 'explain';
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.value, { headers: { 'Cache-Control': 'no-store' } });
  }
  if (Date.now() - windowStart > 3_600_000) {
    windowStart = Date.now();
    uncachedCalls = 0;
  }
  if (uncachedCalls >= 12) {
    return NextResponse.json(
      { error: 'AI demo call limit reached. Try again later.' },
      { status: 429 },
    );
  }
  uncachedCalls += 1;
  try {
    const result =
      parsed.task === 'classify' ? await suggestActivity(parsed.recordId) : await explainChange();
    cache.set(key, { expiresAt: Date.now() + 3_600_000, value: result });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
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
            : 'AI response could not be verified. No suggestion was published.',
      },
      { status },
    );
  }
}
