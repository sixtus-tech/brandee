// parseMoodHeader.test.js — run with `node --test`
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseMoodHeader, StreamingMoodExtractor, VALID_MOODS } from './parseMoodHeader.js';

describe('parseMoodHeader (non-streaming)', () => {
  test('extracts a valid mood and returns the rest as content', () => {
    const r = parseMoodHeader('{"mood":"excited"}\n\nThat name slaps!');
    assert.equal(r.mood, 'excited');
    assert.equal(r.content, 'That name slaps!');
  });

  test('falls back to neutral when no header is present', () => {
    const r = parseMoodHeader('Just a regular response.');
    assert.equal(r.mood, 'neutral');
    assert.equal(r.content, 'Just a regular response.');
  });

  test('handles leading whitespace before the header', () => {
    const r = parseMoodHeader('   \n{"mood":"skeptical"}\n\nHmm.');
    assert.equal(r.mood, 'skeptical');
    assert.equal(r.content, 'Hmm.');
  });

  test('rejects unknown moods and falls back to neutral', () => {
    const r = parseMoodHeader('{"mood":"murderous"}\n\nUh oh.');
    assert.equal(r.mood, 'neutral');
    assert.equal(r.content, 'Uh oh.');
  });

  test('handles malformed JSON gracefully', () => {
    const r = parseMoodHeader('{not json}\n\nstill works');
    assert.equal(r.mood, 'neutral');
    // Malformed header is left in content (trimmed)
    assert.match(r.content, /still works/);
  });

  test('handles empty input', () => {
    const r = parseMoodHeader('');
    assert.equal(r.mood, 'neutral');
    assert.equal(r.content, '');
  });

  test('handles non-string input safely', () => {
    const r = parseMoodHeader(null);
    assert.equal(r.mood, 'neutral');
    assert.equal(r.content, '');
  });

  test('preserves multi-line message bodies', () => {
    const r = parseMoodHeader('{"mood":"thinking"}\n\nLine one.\n\nLine two.');
    assert.equal(r.mood, 'thinking');
    assert.equal(r.content, 'Line one.\n\nLine two.');
  });

  test('all valid moods round-trip cleanly', () => {
    for (const mood of VALID_MOODS) {
      const r = parseMoodHeader(`{"mood":"${mood}"}\n\nbody`);
      assert.equal(r.mood, mood);
    }
  });
});

describe('StreamingMoodExtractor', () => {
  test('extracts mood when header arrives in one chunk', () => {
    const x = new StreamingMoodExtractor();
    const r = x.push('{"mood":"excited"}\n\nHello!');
    assert.equal(r.ready, true);
    assert.equal(r.mood, 'excited');
    assert.equal(r.text, 'Hello!');
  });

  test('buffers until header is complete across chunks', () => {
    const x = new StreamingMoodExtractor();
    const r1 = x.push('{"mood":"');
    assert.equal(r1.ready, false);
    assert.equal(r1.text, '');
    const r2 = x.push('skeptical"}\n\nNot sure.');
    assert.equal(r2.ready, true);
    assert.equal(r2.mood, 'skeptical');
    assert.equal(r2.text, 'Not sure.');
  });

  test('after mood is emitted, subsequent pushes pass straight through', () => {
    const x = new StreamingMoodExtractor();
    x.push('{"mood":"playful"}\n\n');
    const r = x.push(' more text');
    assert.equal(r.ready, true);
    assert.equal(r.text, ' more text');
    assert.equal(r.mood, undefined);
  });

  test('gives up looking for header after enough buffered text without one', () => {
    const x = new StreamingMoodExtractor();
    const longText = 'This is a long response with no mood header at all '.repeat(3);
    const r = x.push(longText);
    assert.equal(r.ready, true);
    assert.equal(r.mood, 'neutral');
    assert.equal(r.text, longText);
  });

  test('flush returns remaining buffer if mood was never emitted', () => {
    const x = new StreamingMoodExtractor();
    x.push('short');
    const f = x.flush();
    assert.equal(f.mood, 'neutral');
    assert.equal(f.text, 'short');
  });
});
