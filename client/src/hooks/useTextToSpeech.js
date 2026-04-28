import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useTextToSpeech — fetches an MP3 from /api/tts and plays it.
 *
 * AUDIO GRAPH (key fix in v5.1):
 *   source ──► destination   (direct — audio ALWAYS plays)
 *   source ──► analyser      (parallel tap — for amplitude only, no destination)
 *
 * The previous version chained them in series (source → analyser → destination),
 * which meant any hiccup in the analyser chain killed audio output. The new
 * version separates the two: audio playback is independent of the analyser.
 *
 * Returns:
 *   { speak, stop, isLoading, isSpeaking, amplitude, isAvailable, error }
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

  // Set up audio context + analyser lazily (only after a user gesture)
  const ensureAudio = useCallback(() => {
    if (audioCtxRef.current) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      audioCtxRef.current = new Ctx();
      const analyser = audioCtxRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      analyserRef.current = analyser;
      // NOTE: we do NOT connect analyser to destination.
      // Analyser is a passive observer — it gets data via parallel tap from the source.
    } catch (e) {
      console.warn('AudioContext init failed:', e?.message);
    }
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

    // Resume audio context if suspended (browser power saving)
    if (audioCtxRef.current?.state === 'suspended') {
      try { await audioCtxRef.current.resume(); } catch (e) {
        console.warn('AudioContext resume failed:', e?.message);
      }
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
      if (!blob || blob.size === 0) {
        throw new Error('Empty audio response');
      }
      const url = URL.createObjectURL(blob);
      currentUrlRef.current = url;

      const audio = new Audio();
      audioElRef.current = audio;
      audio.src = url;
      audio.preload = 'auto';

      // ============ AUDIO GRAPH SETUP (parallel branches) ============
      // Try to wire source into Web Audio for amplitude analysis,
      // but if anything fails, fall back to plain audio element playback
      // (which routes through default output without our intervention).
      let usingWebAudio = false;
      if (audioCtxRef.current && analyserRef.current) {
        try {
          const source = audioCtxRef.current.createMediaElementSource(audio);
          // CRITICAL: connect source DIRECTLY to destination so audio plays
          source.connect(audioCtxRef.current.destination);
          // ALSO connect to analyser as a parallel tap for amplitude (no destination link)
          source.connect(analyserRef.current);
          sourceNodeRef.current = source;
          usingWebAudio = true;
        } catch (e) {
          // MediaElementSource failed (rare). Audio element will play through
          // default routing. We just lose lip sync for this play.
          console.warn('Audio graph fallback (no lip sync this turn):', e?.message);
          sourceNodeRef.current = null;
        }
      }
      // ================================================================

      audio.onplay = () => {
        setIsLoading(false);
        setIsSpeaking(true);
        // Start amplitude polling only if analyser is wired up
        if (usingWebAudio && analyserRef.current) {
          const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
          const tick = () => {
            if (!audioElRef.current || audioElRef.current.paused) return;
            analyserRef.current.getByteTimeDomainData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) {
              const v = (buf[i] - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / buf.length);
            const mapped = Math.min(1, Math.max(0, (rms - 0.02) * 3));
            setAmplitude(mapped);
            rafRef.current = requestAnimationFrame(tick);
          };
          rafRef.current = requestAnimationFrame(tick);
        }
      };
      audio.onended = () => {
        setIsSpeaking(false);
        setAmplitude(0);
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = 0;
        }
      };
      audio.onerror = (e) => {
        console.error('Audio element error:', audio.error?.message || e);
        setIsSpeaking(false);
        setIsLoading(false);
        setError('Audio playback failed');
      };

      // Try to play. If autoplay is blocked, this rejects.
      try {
        await audio.play();
      } catch (playErr) {
        console.error('audio.play() rejected:', playErr?.message);
        setError(`Couldn't play audio: ${playErr?.message || 'autoplay blocked'}`);
        setIsLoading(false);
        setIsSpeaking(false);
      }
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
