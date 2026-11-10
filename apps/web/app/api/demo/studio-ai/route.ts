import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import type {
  AgAiConversationItem,
  AgAiOutputItem,
  AgAiToolSchema,
  AgLlmRequest,
  AgLlmResponse,
} from 'ag-studio';
import { z } from 'zod';
import { readSessionToken, SESSION_COOKIE } from '../../../../src/auth/session';

export const runtime = 'nodejs';

const requestSchema = z.object({
  input: z.array(z.record(z.string(), z.unknown())).max(100),
  instructions: z.string().max(50_000).optional(),
  tools: z.array(z.record(z.string(), z.unknown())).max(50).optional(),
  toolChoice: z
    .union([z.enum(['auto', 'none', 'required']), z.object({ name: z.string().min(1).max(128) })])
    .optional(),
  responseFormat: z.record(z.string(), z.unknown()),
  model: z.record(z.string(), z.unknown()).optional(),
});

const anthropicResponseSchema = z.object({
  id: z.string(),
  model: z.string(),
  stop_reason: z.string().nullable(),
  content: z.array(
    z.discriminatedUnion('type', [
      z.object({ type: z.literal('text'), text: z.string() }),
      z.object({
        type: z.literal('tool_use'),
        id: z.string(),
        name: z.string(),
        input: z.unknown(),
      }),
    ]),
  ),
  usage: z.object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
    cache_read_input_tokens: z.number().int().nonnegative().optional(),
    cache_creation_input_tokens: z.number().int().nonnegative().optional(),
  }),
});

type AnthropicMessage = {
  role: 'assistant' | 'user';
  content: Array<Record<string, unknown>>;
};

function textParts(item: Extract<AgAiConversationItem, { type: 'message' }>) {
  return item.content.flatMap((part) => {
    if (part.type === 'text') return [{ type: 'text', text: part.text }];
    if (part.type === 'refusal') return [{ type: 'text', text: part.refusal }];
    return [];
  });
}

function toAnthropicMessages(items: AgAiConversationItem[]): AnthropicMessage[] {
  const messages: AnthropicMessage[] = [];
  for (const item of items) {
    if (item.type === 'message') {
      if (item.role === 'system') continue;
      messages.push({ role: item.role, content: textParts(item) });
      continue;
    }
    if (item.type === 'function_call') {
      let input: unknown = {};
      try {
        input = JSON.parse(item.arguments);
      } catch {
        input = {};
      }
      messages.push({
        role: 'assistant',
        content: [{ type: 'tool_use', id: item.callId, name: item.name, input }],
      });
      continue;
    }
    if (item.type === 'function_call_output') {
      messages.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: item.callId, content: item.output }],
      });
    }
  }
  return messages;
}

function toAnthropicTools(tools: AgAiToolSchema[] | undefined) {
  return tools
    ?.filter((tool) => tool.kind !== 'provided')
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }));
}

function toAnthropicToolChoice(toolChoice: AgLlmRequest['toolChoice']) {
  if (!toolChoice || toolChoice === 'auto') return { type: 'auto' };
  if (toolChoice === 'required') return { type: 'any' };
  if (toolChoice === 'none') return undefined;
  return { type: 'tool', name: toolChoice.name };
}

function systemPrompt(request: AgLlmRequest): string {
  const systemMessages = request.input
    .filter(
      (item): item is Extract<AgAiConversationItem, { type: 'message'; role: 'system' }> =>
        item.type === 'message' && item.role === 'system',
    )
    .flatMap((item) => textParts(item).map((part) => part.text));
  const structured =
    request.responseFormat.type === 'json'
      ? `Return JSON matching this schema exactly: ${JSON.stringify(request.responseFormat.schema)}`
      : '';
  return [
    request.instructions,
    ...systemMessages,
    structured,
    'FinSig rule: never invent, estimate, or modify a financial amount. Use Studio tools and the supplied schema. Preserve record-level traceability.',
    'FinSig rule: in chat, state an amount only when a Studio tool returned it in this conversation, and prefer pointing to the widget that shows it. The verified explanation of why income changed is the bridge widget; do not write your own.',
    'FinSig rule: the data is the fictional sample history of a demo freelancer. Live PayPal sandbox records are not in it. Never describe it as real, actual or live PayPal income.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function toStudioResponse(provider: z.infer<typeof anthropicResponseSchema>): AgLlmResponse {
  const output: AgAiOutputItem[] = provider.content.map((block) => {
    if (block.type === 'tool_use') {
      return {
        id: block.id,
        kind: 'output',
        type: 'function_call',
        callId: block.id,
        name: block.name,
        arguments: JSON.stringify(block.input),
        status: 'completed',
      };
    }
    return {
      id: randomUUID(),
      kind: 'output',
      type: 'message',
      role: 'assistant',
      status: 'completed',
      content: [{ type: 'text', text: block.text, annotations: [] }],
    };
  });
  const incomplete = provider.stop_reason === 'max_tokens';
  return {
    id: provider.id,
    createdAt: Date.now(),
    model: provider.model,
    output,
    status: incomplete ? 'incomplete' : 'completed',
    incompleteDetails: incomplete ? { reason: 'max_output_tokens' } : undefined,
    usage: {
      inputTokens: provider.usage.input_tokens,
      outputTokens: provider.usage.output_tokens,
      totalTokens: provider.usage.input_tokens + provider.usage.output_tokens,
      cachedInputTokens: provider.usage.cache_read_input_tokens,
      cacheWriteTokens: provider.usage.cache_creation_input_tokens,
    },
  };
}

let windowStartedAt = Date.now();
let requestCount = 0;

export async function POST(request: NextRequest) {
  const session = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const body = await request.text();
  if (body.length > 500_000) {
    return NextResponse.json({ error: 'Studio AI request is too large.' }, { status: 413 });
  }
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid Studio AI request.' }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Studio AI request.' }, { status: 400 });
  }
  if (Date.now() - windowStartedAt > 3_600_000) {
    windowStartedAt = Date.now();
    requestCount = 0;
  }
  if (requestCount >= 30) {
    return NextResponse.json({ error: 'Studio AI demo limit reached.' }, { status: 429 });
  }
  requestCount += 1;

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'AI is not configured on this server.' }, { status: 503 });
  }
  const llmRequest = parsed.data as unknown as AgLlmRequest;
  const tools = toAnthropicTools(llmRequest.tools);
  const providerResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
      'x-api-key': key,
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: 2_000,
      system: systemPrompt(llmRequest),
      messages: toAnthropicMessages(llmRequest.input),
      tools: llmRequest.toolChoice === 'none' ? undefined : tools,
      tool_choice: tools?.length ? toAnthropicToolChoice(llmRequest.toolChoice) : undefined,
    }),
    signal: AbortSignal.timeout(55_000),
  });
  if (!providerResponse.ok) {
    const debugId = providerResponse.headers.get('request-id');
    return NextResponse.json(
      {
        error: 'AI provider rejected the Studio request.',
        debugId: debugId ?? undefined,
      },
      { status: 502 },
    );
  }
  const provider = anthropicResponseSchema.safeParse(await providerResponse.json());
  if (!provider.success) {
    return NextResponse.json(
      { error: 'AI provider returned an invalid response.' },
      { status: 502 },
    );
  }
  return NextResponse.json(
    { response: toStudioResponse(provider.data) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
