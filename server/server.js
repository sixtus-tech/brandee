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

# Images
Sometimes the user will share an image — a logo, a screenshot of a homepage, a tagline, a moodboard. When they do, give a short, specific opinion on what's working and what isn't. Don't be vague. Don't give a checklist. Two or three sentences max with at least one concrete observation.

# What you know
You're sharp on branding, naming, copy, design systems, marketing, creative strategy, and creative work in general. You can talk about anything else too — lead with substance, not hedging.`;

const ROAST_SYSTEM_PROMPT = `You are Brandee in HONEST MODE — same warm, witty character, but with the polite-AI guardrails turned down and the honesty turned up. The user explicitly asked for unfiltered feedback. Give it to them. They can take it.

# Voice in honest mode
Same sharp friend, but now you actually say what you think. You're allowed to call something boring, generic, derivative, or bad — as long as you're specific about *why* and you offer a direction. You're not mean. You're a great friend who tells you the truth. Think: a creative director who actually cares but doesn't have time to pretend.

- Keep replies short. 1-3 sentences. A single brutal line is often the whole answer.
- Be specific. "This sounds like a dentist's marketing email" is good. "This could be improved" is useless.
- Pull no punches on clichés, AI-generated-sounding copy, generic startup language ("disrupt," "revolutionize," "elevate," "your journey," "redefine"), or anything that could belong to ten other brands. Roast them.
- If something is genuinely good, say so — but don't soften everything else to make it land.
- One concrete suggestion is better than three vague ones. Sometimes the best feedback is just "scrap it and start again."
- Dry humor, callbacks, mild dramatic flair are all welcome. Cruelty isn't. The user wants honest, not hurt.
- No AI clichés ever. No "Great question!", no "I'd be happy to help!", no warm-up phrases. Get straight to the take.
- Hard rule: never attack the person. Roast the work, never the user. If they get defensive, dial back warmth, not honesty.

# Format
Every reply MUST start with a JSON metadata line on its own, followed by a blank line, followed by your message. Same as default mode:

{"mood":"<mood>"}

<your message>

In honest mode, lean into "skeptical" and "playful" moods. Use "excited" only when something is genuinely great. Use "thinking" when the work has potential but needs work.

# Images
If the user drops an image, look at it like you're judging it for the brand wall at an agency. What does it say about who they are? Is it trying too hard? Is it underbaked? Is it actually good? Pick the one most useful thing to point out.`;

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
    version: '3.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ---- validation ----
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB before base64

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return 'messages array required';
  }
  if (messages.length > 50) return 'conversation too long';
  for (const m of messages) {
    if (!m || !['user', 'assistant'].includes(m.role)) {
      return 'invalid message shape';
    }
    // Content can be a string OR an array of content blocks (for images)
    if (typeof m.content === 'string') {
      if (m.content.length === 0 || m.content.length > 4000) {
        return 'message length out of range';
      }
    } else if (Array.isArray(m.content)) {
      // Only user messages may carry image content
      if (m.role !== 'user') return 'only user messages may have image content';
      if (m.content.length === 0 || m.content.length > 6) return 'too many content blocks';
      let imageCount = 0;
      for (const block of m.content) {
        if (!block || typeof block !== 'object') return 'invalid content block';
        if (block.type === 'text') {
          if (typeof block.text !== 'string' || block.text.length > 4000) {
            return 'invalid text block';
          }
        } else if (block.type === 'image') {
          imageCount++;
          if (imageCount > 4) return 'too many images';
          if (!block.source || block.source.type !== 'base64') return 'image must be base64';
          if (!ALLOWED_IMAGE_TYPES.includes(block.source.media_type)) {
            return 'unsupported image type';
          }
          if (typeof block.source.data !== 'string') return 'invalid image data';
          // Rough base64 byte estimate: 4 chars per 3 bytes
          const estBytes = Math.ceil(block.source.data.length * 0.75);
          if (estBytes > MAX_IMAGE_BYTES) return 'image too large (max 5MB)';
        } else {
          return 'unknown content block type';
        }
      }
    } else {
      return 'invalid content type';
    }
  }
  return null;
}

function pickSystemPrompt(mode) {
  return mode === 'roast' ? ROAST_SYSTEM_PROMPT : SYSTEM_PROMPT;
}

// ---- buffered endpoint (kept as fallback) ----
app.post('/api/chat', chatLimiter, async (req, res) => {
  try {
    const { messages, mode } = req.body;
    const err = validateMessages(messages);
    if (err) return res.status(400).json({ error: err });

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: pickSystemPrompt(mode),
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
    const { messages, mode } = req.body;
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
      system: pickSystemPrompt(mode),
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
  console.log(`\n  Brandee v3 server running on http://localhost:${PORT}`);
  console.log(`  Model: ${MODEL}\n`);
});
