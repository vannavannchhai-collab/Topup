import { config } from '../config.js';
import type { ChatMessage } from '../types.js';
import { log } from '../lib/logger.js';

/**
 * Optional OpenAI-compatible bridge. NOVA ships with a built-in grounded
 * generator; when AI_BASE_URL + AI_API_KEY are configured the assistant
 * upgrades to a hosted LLM while keeping the same retrieval context.
 */
export async function* streamCompletion(messages: ChatMessage[]): AsyncGenerator<string> {
  if (!config.ai.baseUrl || !config.ai.apiKey) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.ai.requestTimeoutMs);

  try {
    const response = await fetch(`${config.ai.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.ai.apiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.model,
        messages,
        temperature: config.ai.temperature,
        max_tokens: config.ai.maxTokens,
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      log.warn('llm upstream error, falling back to built-in engine', { status: response.status });
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const parsed = JSON.parse(payload) as {
            choices?: { delta?: { content?: string } }[];
          };
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) yield token;
        } catch {
          // ignore malformed keep-alive frames
        }
      }
    }
  } finally {
    clearTimeout(timeout);
  }
}
