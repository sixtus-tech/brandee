import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useTextToSpeech (v5.3 — simplified, bulletproof)
 *
 * After painful debugging in Safari + Chrome, dropped the Web Audio API path
 * entirely. It was breaking after the first playback in Chrome (AudioContext
 * state issues) and never working in Safari (autoplay policy).
 *
 * This version uses ONLY the plain HTML <audio> element. Trade-off: no
 * audio-amplitude-driven lip sync (the mouth-speaking keyframe animation
 * still runs as a fallback, so her mouth still moves while she talks —
 * just not synced to the actual audio waveform).
 *
 * Returns: { speak, stop, isLoading, isSpeaking, amplitude, isAvailable, error, unlock }
 */
export default function useTextToSpeech() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState(null);

  // amplitude is always 0 in this version — Mouth component falls back to
  // its keyframe-based talk animation, which still looks fine.
  const amplitude = 0;

  const audioRef = useRef(null);
  const urlRef = useRef(null);
  const abortRef = useRef(null);
  const unlockedRef = useRef(false);

  // ============== SERVER CONFIG ==============
  useEffect(() => {
    let cancelled = false;
    fetch('/api/voice/config')
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setIsAvailable(!!d.enabled); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // ============== AUDIO UNLOCK ==============
  // Plays a 1-sample silent WAV during the first user gesture to grant
  // permission for subsequent audio playback (Chrome autoplay policy).
  const unlock = useCallback(() => {
    if (unlockedRef.current) return;
    try {
      const SILENT_WAV = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      const a = new Audio(SILENT_WAV);
      a.volume = 0;
      const promise = a.play();
      if (promise && typeof promise.then === 'function') {
        promise
          .then(() => {
            unlockedRef.current = true;
            console.info('[TTS] audio unlocked');
          })
          .catch(() => {
            // Some browsers reject when play() is called outside a gesture context;
            // we'll try again on the next gesture.
          });
      } else {
        unlockedRef.current = true;
      }
    } catch {}
  }, []);

  // Auto-unlock on first user gesture anywhere on the page
  useEffect(() => {
    const onGesture = () => {
      if (unlockedRef.current) return;
      unlock();
    };
    window.addEventListener('pointerdown', onGesture, { capture: true });
    window.addEventListener('keydown', onGesture, { capture: true });
    window.addEventListener('touchstart', onGesture, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', onGesture, { capture: true });
      window.removeEventListener('keydown', onGesture, { capture: true });
      window.removeEventListener('touchstart', onGesture, { capture: true });
    };
  }, [unlock]);

  // ============== STOP / CLEANUP ==============
  const stop = useCallback(() => {
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch {}
      abortRef.current = null;
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.load();
      } catch {}
      audioRef.current = null;
    }
    if (urlRef.current) {
      try { URL.revokeObjectURL(urlRef.current); } catch {}
      urlRef.current = null;
    }
    setIsSpeaking(false);
    setIsLoading(false);
  }, []);

  // ============== SPEAK ==============
  const speak = useCallback(async (text) => {
    if (!text || !text.trim()) return;
    if (!isAvailable) {
      console.warn('[TTS] not available — server has no ELEVENLABS_API_KEY');
      setError('Voice not enabled on server');
      return;
    }

    stop();
    setError(null);
    setIsLoading(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      console.info('[TTS] fetching audio for', text.length, 'chars');
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
      console.info('[TTS] got', blob.size, 'bytes');

      const url = URL.createObjectURL(blob);
      urlRef.current = url;

      const audio = new Audio();
      audio.src = url;
      audio.preload = 'auto';
      audioRef.current = audio;

      audio.onplay = () => {
        console.info('[TTS] playing');
        setIsLoading(false);
        setIsSpeaking(true);
      };
      audio.onended = () => {
        console.info('[TTS] ended naturally');
        setIsSpeaking(false);
        if (urlRef.current === url) {
          try { URL.revokeObjectURL(url); } catch {}
          urlRef.current = null;
        }
        if (audioRef.current === audio) audioRef.current = null;
      };
      audio.onerror = () => {
        const err = audio.error;
        const code = err?.code;
        const msg = err?.message || 'unknown';
        const codeName =
          code === 1 ? 'MEDIA_ERR_ABORTED' :
          code === 2 ? 'MEDIA_ERR_NETWORK' :
          code === 3 ? 'MEDIA_ERR_DECODE' :
          code === 4 ? 'MEDIA_ERR_SRC_NOT_SUPPORTED' :
          'MEDIA_ERR_UNKNOWN';
        console.error(`[TTS] audio error: ${codeName} —`, msg);
        setError(`Audio playback failed (${codeName})`);
        setIsSpeaking(false);
        setIsLoading(false);
      };

      try {
        await audio.play();
      } catch (playErr) {
        console.error('[TTS] audio.play() rejected:', playErr?.name, playErr?.message);
        setError(`Couldn't play audio: ${playErr?.message || 'autoplay blocked'}`);
        setIsLoading(false);
        setIsSpeaking(false);
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
      console.error('[TTS] fetch/decode error:', e);
      setError(e.message || 'TTS failed');
      setIsLoading(false);
      setIsSpeaking(false);
    }
  }, [isAvailable, stop]);

  // Cleanup on unmount
  useEffect(() => () => stop(), [stop]);

  return {
    speak,
    stop,
    unlock,
    isLoading,
    isSpeaking,
    amplitude,
    isAvailable,
    error,
  };
}
