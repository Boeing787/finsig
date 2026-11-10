import { z } from 'zod';

const messageSchema = z.object({
  stop_reason: z.string().nullable(),
  stop_details: z.object({ type: z.string() }).nullish(),
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
});

export class AIUnavailableError extends Error {}
export class AIProviderError extends Error {}
export class AIOutputError extends Error {}

export async function structuredMessage<T>(input: {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  output: z.ZodType<T>;
}): Promise<{ data: T; model: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new AIUnavailableError('Anthropic API key is not configured.');
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'anthropic-version': '2026-10-21',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2_000,
      system: input.system,
      messages: [{ role: 'user', content: input.user }],
      output_config: { format: { type: 'json_schema', schema: input.schema } },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const details = z
      .object({ error: z.object({ type: z.string(), message: z.string() }) })
      .safeParse(body);
    const description = details.success
      ? `${details.data.error.type}: ${details.data.error.message.slice(0, 240)}`
      : 'Unknown provider error';
    throw new AIProviderError(`Anthropic HTTP ${response.status}: ${description}`);
  }
  const parsed = messageSchema.safeParse(await response.json());
  if (!parsed.success || parsed.data.stop_reason !== 'end_turn' || parsed.data.stop_details) {
    throw new AIOutputError('Anthropic returned an incomplete or refused response.');
  }
  const text = parsed.data.content.find((block) => block.type === 'text')?.text;
  if (!text) throw new AIOutputError('Anthropic returned no structured text.');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AIOutputError('Anthropic returned invalid JSON.');
  }
  const output = input.output.safeParse(raw);
  if (!output.success) throw new AIOutputError('Anthropic output failed local validation.');
  return { data: output.data, model };
}
