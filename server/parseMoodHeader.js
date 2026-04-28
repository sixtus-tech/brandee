// parseMoodHeader.js — extracts the mood metadata header that Brandee
// prepends to every reply, returning { mood, content } with the JSON
// header stripped from the visible content.

export const VALID_MOODS = [
  'neutral', 'thinking', 'excited', 'confused',
  'celebrating', 'skeptical', 'playful',
];

export function parseMoodHeader(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return { mood: 'neutral', content: '' };
  }
  const trimmed = text.trimStart();
  // Match a JSON object on the first line followed by newline(s)
  const match = trimmed.match(/^(\{[^}]*\})\s*\n+/);
  if (!match) return { mood: 'neutral', content: trimmed };
  try {
    const meta = JSON.parse(match[1]);
    const content = trimmed.slice(match[0].length).trim();
    const mood =
      typeof meta.mood === 'string' && VALID_MOODS.includes(meta.mood)
        ? meta.mood
        : 'neutral';
    return { mood, content };
  } catch {
    return { mood: 'neutral', content: trimmed };
  }
}

// Streaming variant — we may receive the mood header split across chunks.
// Maintains a buffer until we've seen enough text to confidently emit the mood.
export class StreamingMoodExtractor {
  constructor() {
    this.buffer = '';
    this.moodEmitted = false;
    this.maxBufferBeforeGiveUp = 80;
  }
  // Returns { mood, text, ready }
  //   mood    — emitted exactly once when we identify it (or give up)
  //   text    — text to forward to the client (mood header stripped)
  //   ready   — true when mood has been determined for this stream
  push(chunk) {
    if (this.moodEmitted) {
      return { text: chunk, ready: true };
    }
    this.buffer += chunk;
    const match = this.buffer.match(/^(\{[^}]*\})\s*\n+/);
    if (match) {
      try {
        const meta = JSON.parse(match[1]);
        const mood = VALID_MOODS.includes(meta.mood) ? meta.mood : 'neutral';
        const remainder = this.buffer.slice(match[0].length);
        this.moodEmitted = true;
        return { mood, text: remainder, ready: true };
      } catch {
        // Malformed JSON — treat as no mood
        this.moodEmitted = true;
        return { mood: 'neutral', text: this.buffer, ready: true };
      }
    }
    // No header found yet; if buffer is large, give up looking
    if (this.buffer.length >= this.maxBufferBeforeGiveUp) {
      this.moodEmitted = true;
      const text = this.buffer;
      this.buffer = '';
      return { mood: 'neutral', text, ready: true };
    }
    // Still waiting — emit nothing yet
    return { text: '', ready: false };
  }
  // Call when stream ends to flush whatever is left
  flush() {
    if (this.moodEmitted) return { text: '' };
    this.moodEmitted = true;
    return { mood: 'neutral', text: this.buffer };
  }
}
