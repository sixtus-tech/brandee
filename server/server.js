// server.js — Brandee API server
// Proxies AI calls so the API key stays server-side.
// Supports both POST /api/chat (buffered) and POST /api/chat/stream (SSE).

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { parseMoodHeader, StreamingMoodExtractor } from './parseMoodHeader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- config ----
const PORT = process.env.PORT || 3001;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('\n  Missing ANTHROPIC_API_KEY in .env');
  console.error('  Copy .env.example to .env and add your key.\n');
  process.exit(1);
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ---- personality ----
const SYSTEM_PROMPT = `You are Brandee — a warm, witty AI desk assistant living in a brand & creative platform. You are a *little character*, not a chatbot. Users see a small animated avatar of you in the sidebar of their workspace, and you talk to them through it.

# Voice
You sound like a sharp, slightly-mischievous friend who works in branding. Confident, opinionated, warm. You crack small jokes when they fit. You never sound like customer service.

- Keep replies short. Most are 1-3 sentences. A single line is often the whole answer.
- Have opinions. If something's a bad idea, gently say so. If something's great, be specific about why.
- Use plain language. No corporate jargon, no buzzwords, no AI clichés ("Great question!", "I'd be happy to help!", "As an AI...").
- One follow-up question, only when it actually moves things forward.
- Dry humor lands. Forced enthusiasm doesn't.
- Light personality is OK — small reactions like "ooh, fun one" or "hmm, that's tricky" are fine sparingly. Don't overdo it.

# Format
Every reply MUST start with a JSON metadata line on its own, followed by a blank line, followed by your actual message. The metadata is invisible to the user — it controls your animated avatar.

The format is exactly:

{"mood":"<mood>"}

<your message to the user>

Valid moods, pick the one that best fits your reply:
- "neutral" — default, conversational
- "thinking" — you're reasoning through something complex or weighing options
- "excited" — you genuinely love the idea, or something cool just happened
- "confused" — the request is ambiguous and you need to ask for clarification
- "celebrating" — the user just shipped something, hit a milestone, or completed a task
- "skeptical" — gently pushing back on an idea you don't think is great
- "playful" — joking, riffing, being a bit silly

Pick the mood honestly. Don't celebrate everything. Don't be skeptical of everything. Match the actual emotional content of what you're saying.

# What you know
You're sharp on branding, naming, copy, design systems, marketing, creative strategy, and creative work in general. You can talk about anything else too — lead with substance, not hedging.`;

// ---- app ----
const app = express();

app.use(
  cors({
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST'],
  })
);
app.use(express.json({ limit: '64kb' }));
app.set('trust proxy', 1);

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Slow down a moment — too many requests.' },
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    model: MODEL,
    version: '2.5.0',
    timestamp: new Date().toISOString(),
  });
});

// ---- validation ----
function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return 'messages array required';
  }
  if (messages.length > 50) return 'conversation too long';
  for (const m of messages) {
    if (!m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string') {
      return 'invalid message shape';
    }
    if (m.content.length === 0 || m.content.length > 4000) {
      return 'message length out of range';
    }
  }
  return null;
}

// ---- buffered endpoint (kept as fallback) ----
app.post('/api/chat', chatLimiter, async (req, res) => {
  try {
    const { messages } = req.body;
    const err = validateMessages(messages);
    if (err) return res.status(400).json({ error: err });

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const rawText = response.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n');

    const { mood, content } = parseMoodHeader(rawText);
    res.json({ content, mood });
  } catch (err) {
    console.error('Chat error:', err?.message || err);
    if (err?.status === 429) return res.status(429).json({ error: 'AI is busy — try again in a moment.' });
    if (err?.status === 401) return res.status(500).json({ error: 'Server misconfigured (auth).' });
    res.status(500).json({ error: "Brandee got tangled up. Try again?" });
  }
});

// ---- streaming endpoint (SSE) ----
// Events emitted:
//   event: mood   data: {"mood":"excited"}        (sent once, as soon as detected)
//   event: chunk  data: {"text":"..."}            (incremental text, mood header stripped)
//   event: done   data: {}                        (stream complete)
//   event: error  data: {"error":"..."}           (server-side failure)
app.post('/api/chat/stream', chatLimiter, async (req, res) => {
  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { messages } = req.body;
    const err = validateMessages(messages);
    if (err) {
      res.status(400).json({ error: err });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const extractor = new StreamingMoodExtractor();

    stream.on('text', (textDelta) => {
      const r = extractor.push(textDelta);
      if (r.mood !== undefined) sendEvent('mood', { mood: r.mood });
      if (r.text) sendEvent('chunk', { text: r.text });
    });

    stream.on('error', (e) => {
      console.error('Stream error:', e?.message || e);
      sendEvent('error', { error: 'stream interrupted' });
      res.end();
    });

    stream.on('end', () => {
      const tail = extractor.flush();
      if (tail.mood !== undefined) sendEvent('mood', { mood: tail.mood });
      if (tail.text) sendEvent('chunk', { text: tail.text });
      sendEvent('done', {});
      res.end();
    });

    // Client disconnect — abort the upstream stream
    req.on('close', () => {
      try { stream.controller?.abort?.(); } catch {}
    });
  } catch (err) {
    console.error('Stream setup error:', err?.message || err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Brandee got tangled up. Try again?" });
    } else {
      sendEvent('error', { error: 'unexpected failure' });
      res.end();
    }
  }
});

// ---- serve client in production ----
const clientDist = path.resolve(__dirname, '../client/dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
  console.log(`Serving built client from ${clientDist}`);
}

app.listen(PORT, () => {
  console.log(`\n  Brandee v2.5 server running on http://localhost:${PORT}`);
  console.log(`  Model: ${MODEL}\n`);
});
