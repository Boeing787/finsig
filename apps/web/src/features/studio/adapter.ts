'use client';

import type {
  AgAiEvent,
  AgAiOutputItem,
  AgLlmAdapter,
  AgLlmRequest,
  AgLlmResponse,
} from 'ag-studio';

type AdapterEnvelope = {
  response: AgLlmResponse;
};

async function execute(request: AgLlmRequest, signal?: AbortSignal): Promise<AgLlmResponse> {
  const response = await fetch('/api/demo/studio-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    cache: 'no-store',
    signal,
  });
  const body = (await response.json().catch(() => null)) as
    AdapterEnvelope | { error?: string } | null;
  if (!response.ok || !body || !('response' in body)) {
    const message = body && 'error' in body ? body.error : undefined;
    throw new Error(message ?? `Studio AI proxy failed with HTTP ${response.status}.`);
  }
  return body.response;
}

function outputEvents(item: AgAiOutputItem): AgAiEvent[] {
  if (item.type === 'message') {
    const text = item.content
      .map((part) => (part.type === 'text' ? part.text : part.refusal))
      .join('\n');
    return [
      { type: 'TEXT_MESSAGE_START', messageId: item.id, role: 'assistant' },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: item.id, delta: text },
      { type: 'TEXT_MESSAGE_END', messageId: item.id },
    ];
  }
  if (item.type === 'function_call') {
    return [
      {
        type: 'TOOL_CALL_START',
        toolCallId: item.callId,
        toolCallName: item.name,
      },
      { type: 'TOOL_CALL_ARGS', toolCallId: item.callId, delta: item.arguments },
      { type: 'TOOL_CALL_END', toolCallId: item.callId },
    ];
  }
  return [];
}

export const finSigLlmAdapter: AgLlmAdapter = {
  executeTurn(request, options) {
    const complete = execute(request, options?.signal);
    return {
      complete,
      stream: {
        async *[Symbol.asyncIterator]() {
          const response = await complete;
          for (const item of response.output) {
            for (const event of outputEvents(item)) yield event;
          }
        },
      },
    };
  },
};
