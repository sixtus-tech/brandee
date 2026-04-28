import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useSpeechRecognition — wrapper around the browser's Web Speech API.
 *
 * Returns:
 *   { isSupported, isListening, transcript, interim, start, stop, reset, error }
 *
 *   transcript  — finalized recognized text (committed)
 *   interim     — what the recognizer thinks you're saying right now
 *   start/stop  — control mic
 *
 * Notes:
 *   - Web Speech API works in Chrome, Edge, Safari, mobile Chrome/Safari.
 *   - Firefox has it behind a flag; we report unsupported there.
 *   - Audio goes to the browser's recognition service (not our server).
 */
export default function useSpeechRecognition({
  lang = 'en-US',
  onFinal,
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
  const recognitionRef = useRef(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  // Lazy-create the recognition instance
  const ensureRecognition = useCallback(() => {
    if (!isSupported) return null;
    if (recognitionRef.current) return recognitionRef.current;

    const r = new SpeechRecognition();
    r.lang = lang;
    r.interimResults = true;
    r.continuous = false;
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
      // 'no-speech' and 'aborted' are expected lifecycle events; don't surface as errors
      if (['no-speech', 'aborted'].includes(event.error)) return;
      console.warn('SpeechRecognition error:', event.error);
      setError(event.error);
    };

    r.onend = () => {
      setIsListening(false);
      setInterim('');
      // Fire the final callback with whatever was recognized
      setTranscript((current) => {
        if (current && onFinalRef.current) onFinalRef.current(current);
        return current;
      });
    };

    recognitionRef.current = r;
    return r;
  }, [SpeechRecognition, isSupported, lang]);

  const start = useCallback(() => {
    if (!isSupported) return;
    const r = ensureRecognition();
    if (!r) return;
    setError(null);
    setTranscript('');
    setInterim('');
    try {
      r.start();
      setIsListening(true);
    } catch (e) {
      // Already started — ignore
      console.warn('SpeechRecognition start:', e?.message);
    }
  }, [isSupported, ensureRecognition]);

  const stop = useCallback(() => {
    const r = recognitionRef.current;
    if (!r) return;
    try { r.stop(); } catch {}
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setInterim('');
    setError(null);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      const r = recognitionRef.current;
      if (r) {
        try { r.abort(); } catch {}
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    interim,
    start,
    stop,
    reset,
    error,
  };
}
