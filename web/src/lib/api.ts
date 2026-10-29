const TOKEN_KEY = 'nova.token';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = body?.error ?? {};
    if (response.status === 401) tokenStore.clear();
    throw new ApiError(
      response.status,
      error.code ?? 'error',
      error.message ?? 'Request failed. Please try again.',
      error.details,
    );
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};

export interface StreamHandlers {
  onMeta?: (payload: any) => void;
  onToken?: (text: string) => void;
  onDone?: (payload: { text: string; engine: string }) => void;
  onConversation?: (id: string) => void;
  onError?: (message: string) => void;
}

/** POST + read an SSE stream (fetch keeps auth headers, EventSource cannot). */
export async function streamChat(
  body: { message: string; locale: string; conversationId?: string; history?: { role: string; content: string }[] },
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const token = tokenStore.get();
  const response = await fetch('/api/assistant/stream', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok || !response.body) {
    handlers.onError?.('The assistant is unavailable right now.');
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      const lines = frame.split('\n');
      const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
      const dataLine = lines.find((line) => line.startsWith('data:'));
      if (!event || !dataLine) continue;
      let data: any;
      try {
        data = JSON.parse(dataLine.slice(5).trim());
      } catch {
        continue;
      }
      if (event === 'meta') handlers.onMeta?.(data);
      else if (event === 'token') handlers.onToken?.(data.text ?? '');
      else if (event === 'done') handlers.onDone?.(data);
      else if (event === 'conversation') handlers.onConversation?.(data.conversationId);
      else if (event === 'error') handlers.onError?.(data.message ?? 'Assistant error');
    }
  }
}
