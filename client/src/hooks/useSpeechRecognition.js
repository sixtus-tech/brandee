import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useSpeechRecognition (v5.5 — continuous mode + VAD)
 *
 * Wraps the browser's Web Speech API but adds Voice Activity Detection on top.
 *
 * Without VAD: the recognizer auto-finalizes after the first ~0.5s of silence,
 * which interrupts the user mid-thought. Awful UX for conversation.
 *
 * With VAD: we run recognition in `continuous: true` mode (it never auto-stops),
 * AND independently measure microphone amplitude in real time. We only call
 * `recognizer.stop()` after the user has spoken AND been silent for >SILENCE_MS.
 *
 * Result: you can pause, breathe, say "uhhh" — Brandee waits for you to actually finish.
 *
 * Audio resources (mic stream, AudioContext) are created on start() and torn
 * down on stop()/onend, so we're not holding the mic when not listening.
 */

const DEFAULT_SILENCE_MS = 1500;     // 1.5s silence before we consider speech done
const DEFAULT_VOICE_THRESHOLD = 0.018; // RMS amplitude over which we count audio as "voice"
const MIN_SPEECH_MS = 250;            // ignore VAD until user has spoken for at least this long

export default function useSpeechRecognition({
  lang = 'en-US',
  onFinal,
  silenceMs = DEFAULT_SILENCE_MS,
  voiceThreshold = DEFAULT_VOICE_THRESHOLD,
} = {}) {
  const SpeechRecognition =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;
  const isSupported = !!SpeechRecognition;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0); // 0..1, useful for UI feedback

  const recognitionRef = useRef(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  // VAD state
  const vadRef = useRef(null);

  // ============== VAD helpers ==============

  const teardownVAD = useCallback(() => {
    const v = vadRef.current;
    if (!v) return;
    v.alive = false;
    if (v.rafId) cancelAnimationFrame(v.rafId);
    try { v.source?.disconnect(); } catch {}
    try { v.analyser?.disconnect(); } catch {}
    if (v.stream) {
      try { v.stream.getTracks().forEach((t) => t.stop()); } catch {}
    }
    if (v.audioCtx && v.audioCtx.state !== 'closed') {
      try { v.audioCtx.close(); } catch {}
    }
    vadRef.current = null;
    setAudioLevel(0);
  }, []);

  const setupVAD = useCallback(async () => {
    // Request microphone access
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (e) {
      console.warn('[STT] mic permission denied or unavailable:', e?.message);
      return null;
    }

    let audioCtx;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') {
        try { await audioCtx.resume(); } catch {}
      }
    } catch (e) {
      console.warn('[STT] AudioContext init for VAD failed:', e?.message);
      stream.getTracks().forEach((t) => t.stop());
      return null;
    }

    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.3;
    source.connect(analyser);
    // Note: we do NOT connect analyser to destination — we don't want to
    // play your own voice back through the speakers (echo).

    const buffer = new Uint8Array(analyser.fftSize);
    const startedAt = Date.now();

    const v = {
      stream,
      audioCtx,
      source,
      analyser,
      buffer,
      startedAt,
      lastVoiceAt: 0,     // when we last detected voice
      hasSpokenAt: 0,     // when we first detected voice this session
      alive: true,
      rafId: 0,
    };
    vadRef.current = v;

    return v;
  }, []);

  const startVADLoop = useCallback(() => {
    const v = vadRef.current;
    if (!v) return;

    const tick = () => {
      if (!v.alive) return;
      v.analyser.getByteTimeDomainData(v.buffer);
      let sum = 0;
      for (let i = 0; i < v.buffer.length; i++) {
        const x = (v.buffer[i] - 128) / 128;
        sum += x * x;
      }
      const rms = Math.sqrt(sum / v.buffer.length);
      setAudioLevel(Math.min(1, rms * 4));

      const now = Date.now();
      const elapsed = now - v.startedAt;

      if (rms > voiceThreshold) {
        v.lastVoiceAt = now;
        if (!v.hasSpokenAt) v.hasSpokenAt = now;
      } else {
        // Only consider stopping if the user has actually spoken AND the speech
        // was at least MIN_SPEECH_MS long (ignore tiny clicks/breaths)
        const spokeFor = v.lastVoiceAt - v.hasSpokenAt;
        if (v.hasSpokenAt && spokeFor >= MIN_SPEECH_MS) {
          const silenceFor = now - v.lastVoiceAt;
          if (silenceFor >= silenceMs) {
            console.info(`[STT] VAD: detected ${silenceFor}ms silence after ${spokeFor}ms speech — stopping`);
            // Stop recognition; cleanup happens in onend
            try { recognitionRef.current?.stop(); } catch {}
            v.alive = false;
            return;
          }
        }
        // Hard cap: if user just tapped mic and never spoke, give up after 8s
        if (!v.hasSpokenAt && elapsed > 8000) {
          console.info('[STT] VAD: no speech detected after 8s — stopping');
          try { recognitionRef.current?.stop(); } catch {}
          v.alive = false;
          return;
        }
      }
      v.rafId = requestAnimationFrame(tick);
    };
    v.rafId = requestAnimationFrame(tick);
  }, [voiceThreshold, silenceMs]);

  // ============== Recognition setup ==============

  const ensureRecognition = useCallback(() => {
    if (!isSupported) return null;
    if (recognitionRef.current) return recognitionRef.current;

    const r = new SpeechRecognition();
    r.lang = lang;
    r.interimResults = true;
    r.continuous = true;       // ← key change: don't auto-finalize on first silence
    r.maxAlternatives = 1;

    r.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      if (finalText) {
        setTranscript((prev) => (prev ? prev + ' ' + finalText.trim() : finalText.trim()));
        setInterim('');
      }
      if (interimText) setInterim(interimText.trim());
    };

    r.onerror = (event) => {
      if (['no-speech', 'aborted'].includes(event.error)) return;
      console.warn('[STT] recognition error:', event.error);
      setError(event.error);
    };

    r.onend = () => {
      teardownVAD();
      setIsListening(false);
      setInterim('');
      setTranscript((current) => {
        if (current && onFinalRef.current) onFinalRef.current(current);
        return current;
      });
    };

    recognitionRef.current = r;
    return r;
  }, [SpeechRecognition, isSupported, lang, teardownVAD]);

  // ============== Public API ==============

  const start = useCallback(async () => {
    if (!isSupported) return;
    const r = ensureRecognition();
    if (!r) return;

    setError(null);
    setTranscript('');
    setInterim('');

    // Set up VAD first (mic permission may prompt — must precede recognition.start)
    const v = await setupVAD();
    if (!v) {
      // No VAD — fall back to non-continuous recognition so the recognizer auto-stops
      r.continuous = false;
    } else {
      r.continuous = true;
    }

    try {
      r.start();
      setIsListening(true);
      if (v) startVADLoop();
    } catch (e) {
      // 'InvalidStateError' if already started — ignore
      console.warn('[STT] start:', e?.message);
      teardownVAD();
    }
  }, [isSupported, ensureRecognition, setupVAD, startVADLoop, teardownVAD]);

  const stop = useCallback(() => {
    const r = recognitionRef.current;
    if (!r) return;
    try { r.stop(); } catch {}
    // teardownVAD will run in onend
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setInterim('');
    setError(null);
  }, []);

  // ============== Cleanup ==============

  useEffect(() => {
    return () => {
      const r = recognitionRef.current;
      if (r) {
        try { r.abort(); } catch {}
      }
      teardownVAD();
    };
  }, [teardownVAD]);

  return {
    isSupported,
    isListening,
    transcript,
    interim,
    audioLevel,    // 0..1, can drive a UI indicator
    start,
    stop,
    reset,
    error,
  };
}
