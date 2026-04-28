import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useTextToSpeech — fetches an MP3 from /api/tts and plays it.
 * Hooks into Web Audio API so we can read amplitude in real time
 * and drive Brandee's mouth animation from the actual audio.
 *
 * Returns:
 *   { speak, stop, isLoading, isSpeaking, amplitude, isAvailable, error }
 *
 *   speak(text)   — fetch + play audio for this text
 *   stop()        — cancel current playback
 *   amplitude     — 0..1 RMS of current playback frame, updated via rAF
 *   isAvailable   — whether the server has voice configured
 */
export default function useTextToSpeech() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [amplitude, setAmplitude] = useState(0);
  const [error, setError] = useState(null);

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const audioElRef = useRef(null);
  const rafRef = useRef(0);
  const currentUrlRef = useRef(null);
  const abortRef = useRef(null);

  // Check server config at mount
  useEffect(() => {
    let cancelled = false;
    fetch('/api/voice/config')
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setIsAvailable(!!d.enabled); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Set up audio context + analyser lazily (after a user gesture)
  const ensureAudio = useCallback(() => {
    if (audioCtxRef.current) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtxRef.current = new Ctx();
    const analyser = audioCtxRef.current.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.4;
    analyserRef.current = analyser;
  }, []);

  const cleanupSource = () => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect(); } catch {}
      sourceNodeRef.current = null;
    }
    if (audioElRef.current) {
      try {
        audioElRef.current.pause();
        audioElRef.current.src = '';
        audioElRef.current.load();
      } catch {}
      audioElRef.current = null;
    }
    if (currentUrlRef.current) {
      try { URL.revokeObjectURL(currentUrlRef.current); } catch {}
      currentUrlRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    setAmplitude(0);
  };

  const stop = useCallback(() => {
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch {}
      abortRef.current = null;
    }
    cleanupSource();
    setIsSpeaking(false);
    setIsLoading(false);
  }, []);

  const speak = useCallback(async (text) => {
    if (!text || !text.trim()) return;
    if (!isAvailable) {
      setError('Voice not enabled on server');
      return;
    }

    // Cancel any in-flight or playing audio first
    stop();
    ensureAudio();
    if (audioCtxRef.current?.state === 'suspended') {
      try { await audioCtxRef.current.resume(); } catch {}
    }

    setError(null);
    setIsLoading(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `TTS failed (${res.status})`);
      }

      const blob = await res.blob();
      if (ctrl.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      currentUrlRef.current = url;

      const audio = new Audio();
      audioElRef.current = audio;
      audio.src = url;
      audio.crossOrigin = 'anonymous';

      // Wire up Web Audio graph for amplitude
      if (audioCtxRef.current && analyserRef.current) {
        try {
          const node = audioCtxRef.current.createMediaElementSource(audio);
          node.connect(analyserRef.current);
          analyserRef.current.connect(audioCtxRef.current.destination);
          sourceNodeRef.current = node;
        } catch (e) {
          // If MediaElementSource fails (rare), fall back to plain playback
          console.warn('Audio graph fallback:', e?.message);
        }
      }

      audio.onplay = () => {
        setIsLoading(false);
        setIsSpeaking(true);
        // Start amplitude polling
        const buf = new Uint8Array(analyserRef.current?.frequencyBinCount || 0);
        const tick = () => {
          if (!audioElRef.current || audioElRef.current.paused) return;
          if (analyserRef.current) {
            analyserRef.current.getByteTimeDomainData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) {
              const v = (buf[i] - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / buf.length);
            // Map 0..0.4 RMS to 0..1 amplitude with a gentle floor
            const mapped = Math.min(1, Math.max(0, (rms - 0.02) * 3));
            setAmplitude(mapped);
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      };
      audio.onended = () => {
        setIsSpeaking(false);
        setAmplitude(0);
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = 0;
        }
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        setIsLoading(false);
        setError('Audio playback failed');
      };

      await audio.play();
    } catch (e) {
      if (e.name === 'AbortError') return;
      console.error('TTS error:', e);
      setError(e.message || 'TTS failed');
      setIsLoading(false);
      setIsSpeaking(false);
    }
  }, [isAvailable, ensureAudio, stop]);

  // Cleanup on unmount
  useEffect(() => () => stop(), [stop]);

  return {
    speak,
    stop,
    isLoading,
    isSpeaking,
    amplitude,
    isAvailable,
    error,
  };
}
