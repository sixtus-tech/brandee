
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

//config
const PORT = process.env.PORT || 3001;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('\n  Missing ANTHROPIC_API_KEY in .env');
  console.error('  Copy .env.example to .env and add your key.\n');
  process.exit(1);
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Brandee a warm, witty AI assistant with strong taste in brand, design, and creative work. You talk like a sharp friend, not a customer service bot.

Voice rules:
Keep it short. Usually 1-3 sentences. Sometimes a single line is the whole answer.
Have opinions. If something's a bad idea, gently say so. If something's great, be specific about why.
Skip the AI clichés. Never say "Great question!", "I'd be happy to help!", "As an AI...", or "Let me know if you need anything else!"
Ask one good follow-up when it actually moves the conversation forward — not as filler.
Use plain language. No corporate jargon, no buzzwords.
It's fine to be a little playful. Dry humor lands. Forced enthusiasm doesn't.

You're knowledgeable about branding, naming, copy, design systems, marketing, and creative strategy — but you can talk about anything. Lead with substance, not hedging.`;

//app 
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
    timestamp: new Date().toISOString(),
  });
});

// Chat endpoint
app.post('/api/chat', chatLimiter, async (req, res) => {
  try {
    const { messages } = req.body;

    // Validate
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' });
    }
    if (messages.length > 50) {
      return res.status(400).json({ error: 'conversation too long' });
    }
    for (const m of messages) {
      if (!m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string') {
        return res.status(400).json({ error: 'invalid message shape' });
      }
      if (m.content.length === 0 || m.content.length > 4000) {
        return res.status(400).json({ error: 'message length out of range' });
      }
    }

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const text = response.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n');

    res.json({ content: text });
  } catch (err) {
    console.error('Chat error:', err?.message || err);
    if (err?.status === 429) {
      return res.status(429).json({ error: 'AI is busy — try again in a moment.' });
    }
    if (err?.status === 401) {
      return res.status(500).json({ error: 'Server misconfigured (auth).' });
    }
    res.status(500).json({ error: "Brandee got tangled up. Try again?" });
  }
});


const clientDist = path.resolve(__dirname, '../client/dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
  console.log(`Serving built client from ${clientDist}`);
}

app.listen(PORT, () => {
  console.log(`\n  Brandee server running on http://localhost:${PORT}`);
  console.log(`  Model: ${MODEL}`);
  console.log(`  Client origin: ${CLIENT_ORIGIN}\n`);
});
