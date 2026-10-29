import { Router } from 'express';
import { z } from 'zod';
import { q } from '../db/index.js';
import { ApiError, asyncHandler, parse } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { config } from '../config.js';
import { uuid, nowIso } from '../lib/ids.js';
import { prepareAnswer, streamAnswer, type AssistantRequest } from '../ai/assistant.js';
import type { ChatMessage } from '../types.js';

export const assistantRouter = Router();

const chatSchema = z.object({
  message: z.string().min(1, 'Say something and I will help').max(2000),
  locale: z.enum(['km', 'en']).default('km'),
  conversationId: z.string().uuid().optional(),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) }))
    .max(20)
    .optional(),
});

function ensureConversation(userId: string, conversationId: string | undefined, firstMessage: string) {
  if (conversationId) {
    const existing = q.get<{ id: string }>('SELECT id FROM conversations WHERE id = ? AND user_id = ?', conversationId, userId);
    if (existing) return existing.id;
  }
  const id = uuid();
  const title = firstMessage.slice(0, 60) || 'New chat';
  q.run(
    'INSERT INTO conversations (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    id,
    userId,
    title,
    nowIso(),
    nowIso(),
  );
  return id;
}

function persist(conversationId: string, role: 'user' | 'assistant', content: string, meta: Record<string, unknown> = {}) {
  q.run(
    'INSERT INTO messages (id, conversation_id, role, content, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    uuid(),
    conversationId,
    role,
    content,
    JSON.stringify(meta),
    nowIso(),
  );
  q.run('UPDATE conversations SET updated_at = ? WHERE id = ?', nowIso(), conversationId);
}

function storedHistory(conversationId: string): ChatMessage[] {
  return q
    .all<{ role: 'user' | 'assistant'; content: string }>(
      'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 10',
      conversationId,
    )
    .reverse();
}

assistantRouter.post(
  '/chat',
  requireAuth,
  rateLimit(config.limits.assistantRateMax, config.limits.rateWindowMs),
  asyncHandler(async (req, res) => {
    const body = parse(chatSchema, req.body);
    const conversationId = ensureConversation(req.user!.id, body.conversationId, body.message);
    const request: AssistantRequest = {
      user: req.user!,
      message: body.message,
      locale: body.locale,
      history: body.history?.length ? body.history : storedHistory(conversationId),
    };

    persist(conversationId, 'user', body.message, { locale: body.locale });
    const { builtin } = prepareAnswer(request);
    persist(conversationId, 'assistant', builtin.text, {
      intent: builtin.intent,
      products: builtin.products.map((product) => product.id),
      engine: builtin.engine,
    });

    res.json({ ...builtin, conversationId });
  }),
);

/** Server-Sent Events streaming endpoint for the typing assistant UI. */
assistantRouter.post('/stream', requireAuth, rateLimit(config.limits.assistantRateMax, config.limits.rateWindowMs), async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'bad_request', message: 'Invalid chat payload' } });
    return;
  }
  const body = parsed.data;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const conversationId = ensureConversation(req.user!.id, body.conversationId, body.message);
  send('conversation', { conversationId });

  const request: AssistantRequest = {
    user: req.user!,
    message: body.message,
    locale: body.locale,
    history: body.history?.length ? body.history : storedHistory(conversationId),
  };
  persist(conversationId, 'user', body.message, { locale: body.locale });

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15_000);
  let finalText = '';

  try {
    for await (const event of streamAnswer(request)) {
      if (event.type === 'token') finalText += event.payload.text;
      if (event.type === 'done') finalText = event.payload.text;
      send(event.type, event.payload);
    }
    persist(conversationId, 'assistant', finalText, { streamed: true });
    send('conversation', { conversationId });
  } catch (error) {
    send('error', { message: error instanceof Error ? error.message : 'Assistant failed' });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

assistantRouter.get(
  '/conversations',
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = q.all<{ id: string; title: string; updated_at: string; count: number }>(
      `SELECT c.id, c.title, c.updated_at, (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS count
       FROM conversations c WHERE c.user_id = ? ORDER BY c.updated_at DESC LIMIT 30`,
      req.user!.id,
    );
    res.json({
      conversations: rows.map((row) => ({
        id: row.id,
        title: row.title,
        updatedAt: row.updated_at,
        messageCount: row.count,
      })),
    });
  }),
);

assistantRouter.get(
  '/conversations/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const conversation = q.get<{ id: string; title: string }>(
      'SELECT id, title FROM conversations WHERE id = ? AND user_id = ?',
      String(req.params.id),
      req.user!.id,
    );
    if (!conversation) throw ApiError.notFound('Conversation not found');
    const messages = q.all<{ id: string; role: string; content: string; meta: string; created_at: string }>(
      'SELECT id, role, content, meta, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
      conversation.id,
    );
    res.json({
      conversation,
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        meta: JSON.parse(message.meta || '{}'),
        createdAt: message.created_at,
      })),
    });
  }),
);

assistantRouter.delete(
  '/conversations/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = q.run('DELETE FROM conversations WHERE id = ? AND user_id = ?', String(req.params.id), req.user!.id);
    if (!result.changes) throw ApiError.notFound('Conversation not found');
    res.json({ deleted: true });
  }),
);
