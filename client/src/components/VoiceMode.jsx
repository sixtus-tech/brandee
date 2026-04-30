import { forwardRef, useEffect, useRef, useState } from 'react';
import BrandeeAvatar from './BrandeeAvatar.jsx';
import SkyBackdrop from './SkyBackdrop.jsx';

/**
 * VoiceMode — full-screen voice conversation layout.
 *
 * In voice mode, Brandee is huge and centered. There's no input bar —
 * just a big mic button and a status indicator. The conversation loop is:
 *
 *   tap mic → listening → user speaks → silence → auto-send →
 *   thinking → speaking (audio + lip sync) → auto-arm mic → loop
 *
 * Tap Brandee herself or the stop button to interrupt while she's speaking.
 *
 * Props:
 *   state, mood, vignette, cursorGaze, audioAmplitude — passed through to avatar
 *   brandeeName            — display name
 *   onExit                 — called when user taps "End"
 *   onSendVoiceMessage     — called with transcribed text to fire a chat request
 *   onInterrupt            — called when user wants to interrupt her speaking
 *   isLoading              — true while waiting for AI response
 *   ttsSpeaking            — true while audio is playing
 *   stt                    — speech-recognition instance from useSpeechRecognition
 *   autoListen             — whether to auto-arm mic after she finishes
 *   lastUserText           — most recent transcribed user message
 *   lastAssistantText      — most recent assistant response
 *   error                  — error message (if any)
 *   roastMode              — pass through for the avatar styling
 *   onToggleRoast          — toggle handler
 *   ttsAvailable           — whether server has voice configured
 */
const VoiceMode = forwardRef(function VoiceMode({
  state,
  mood,
  vignette,
  cursorGaze,
  audioAmplitude,
  brandeeName = 'Brandee',
  onExit,
  onSendVoiceMessage,
  onInterrupt,
  isLoading,
  ttsSpeaking,
  stt,
  autoListen = true,
  lastUserText = '',
  lastAssistantText = '',
  error,
  roastMode = false,
  onToggleRoast,
  ttsAvailable,
}, avatarRef) {
  // Local conversation state (separate from main state to avoid race conditions)
  const [phase, setPhase] = useState('idle'); // idle | listening | thinking | speaking
  const lastFinalRef = useRef('');
  const autoArmTimerRef = useRef(null);

  // Mirror external state into our local phase
  useEffect(() => {
    if (stt.isListening) setPhase('listening');
    else if (isLoading) setPhase('thinking');
    else if (ttsSpeaking) setPhase('speaking');
    else setPhase('idle');
  }, [stt.isListening, isLoading, ttsSpeaking]);

  // When STT delivers a final transcript, send it
  useEffect(() => {
    if (!stt.transcript || stt.isListening) return;
    if (stt.transcript === lastFinalRef.current) return;
    const text = stt.transcript.trim();
    if (!text) return;
    lastFinalRef.current = stt.transcript;
    onSendVoiceMessage?.(text);
    stt.reset?.();
  }, [stt.transcript, stt.isListening]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-arm mic after Brandee finishes speaking
  useEffect(() => {
    clearTimeout(autoArmTimerRef.current);
    if (!autoListen) return;
    if (phase !== 'idle') return;
    if (!stt.isSupported) return;
    autoArmTimerRef.current = setTimeout(() => {
      // Only auto-arm if we just came back to idle from speaking (not on first load)
      if (lastFinalRef.current && !stt.isListening) {
        try { stt.start(); } catch {}
      }
    }, 600);
    return () => clearTimeout(autoArmTimerRef.current);
  }, [phase, autoListen, stt.isSupported]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMicTap = () => {
    if (phase === 'listening') {
      stt.stop();
    } else if (phase === 'speaking') {
      onInterrupt?.();
    } else if (phase === 'idle') {
      try { stt.start(); } catch {}
    }
    // ignore taps during 'thinking'
  };

  const handleAvatarTap = () => {
    if (phase === 'speaking') onInterrupt?.();
    else if (phase === 'idle') handleMicTap();
  };

  // Status text below the avatar
  const statusText = (() => {
    if (error) return error;
    if (phase === 'listening') return stt.interim || 'Listening…';
    if (phase === 'thinking') return `${brandeeName} is thinking…`;
    if (phase === 'speaking') return `${brandeeName} is speaking`;
    if (lastFinalRef.current) return autoListen ? 'I\'m here when you\'re ready.' : 'Tap the mic to talk.';
    return 'Tap the mic and start talking.';
  })();

  return (
    <div className={`voice-mode ${phase} ${roastMode ? 'roast' : ''}`}>
      <SkyBackdrop />
      <header className="voice-header">
        <div className="brand-mark">
          <span className="brand-dot" />
          <span className="brand-name serif">{brandeeName}</span>
        </div>
        <div className="voice-header-right">
          <button
            type="button"
            className={`voice-roast-toggle ${roastMode ? 'on' : ''}`}
            onClick={onToggleRoast}
            aria-pressed={roastMode}
            title={roastMode ? 'Honest mode is on. Tap to soften.' : 'Switch to honest mode'}
          >
            <span className="mode-dot" aria-hidden />
            {roastMode ? 'Honest mode' : 'Be honest'}
          </button>
          <button
            type="button"
            className="voice-exit-btn"
            onClick={onExit}
            aria-label="End voice mode"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span>End</span>
          </button>
        </div>
      </header>

      <main className="voice-stage">
        <div className="voice-avatar-wrap" onClick={handleAvatarTap}>
          <BrandeeAvatar
            ref={avatarRef}
            state={state}
            mood={mood}
            vignette={vignette}
            cursorGaze={cursorGaze}
            audioAmplitude={audioAmplitude}
            roastMode={roastMode}
            size={340}
          />
          {/* Pulsing ring when listening or speaking */}
          {(phase === 'listening' || phase === 'speaking') && (
            <div className={`voice-ring ${phase}`} aria-hidden />
          )}
        </div>

        <div className="voice-status-pill">
          <span className={`voice-status-dot ${phase}`} />
          <span className="voice-status-label">
            {phase === 'listening' ? 'LISTENING' :
             phase === 'thinking' ? 'THINKING' :
             phase === 'speaking' ? 'SPEAKING' :
             roastMode ? 'HONEST MODE' : 'READY'}
          </span>
        </div>

        <div className="voice-status-text" aria-live="polite">
          {statusText}
        </div>

        {/* Last assistant response (subtle, fades during conversation) */}
        {lastAssistantText && phase !== 'speaking' && (
          <div className="voice-last-message">
            <div className="voice-last-bubble serif">
              {lastAssistantText}
            </div>
          </div>
        )}
      </main>

      <footer className="voice-controls">
        <button
          type="button"
          className={`voice-mic-btn phase-${phase}`}
          onClick={handleMicTap}
          disabled={phase === 'thinking'}
          aria-label={
            phase === 'listening' ? 'Stop listening' :
            phase === 'speaking' ? 'Interrupt' :
            'Start talking'
          }
        >
          {phase === 'listening' && (
            <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden>
              <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
            </svg>
          )}
          {phase === 'speaking' && (
            <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden>
              <rect x="6" y="6" width="4" height="12" rx="1" fill="currentColor" />
              <rect x="14" y="6" width="4" height="12" rx="1" fill="currentColor" />
            </svg>
          )}
          {phase === 'idle' && (
            <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden>
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" fill="currentColor" />
              <path
                d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"
                stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"
              />
            </svg>
          )}
          {phase === 'thinking' && (
            <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden>
              <circle cx="6" cy="12" r="2" fill="currentColor" className="dot dot-1" />
              <circle cx="12" cy="12" r="2" fill="currentColor" className="dot dot-2" />
              <circle cx="18" cy="12" r="2" fill="currentColor" className="dot dot-3" />
            </svg>
          )}
        </button>

        <div className="voice-help">
          {phase === 'listening' ? 'Tap to stop' :
           phase === 'speaking' ? 'Tap to interrupt' :
           phase === 'thinking' ? '' :
           autoListen ? 'Tap to talk — or just start' : 'Tap to talk'}
        </div>

        {/* Transcript log on the side */}
        {lastUserText && (
          <div className="voice-last-user">
            you said: <em>{lastUserText}</em>
          </div>
        )}

        {!ttsAvailable && (
          <div className="voice-warning">
            Voice replies aren't configured on the server — Brandee will reply in text only.
            Set <code>ELEVENLABS_API_KEY</code> on your server to enable her voice.
          </div>
        )}
      </footer>
    </div>
  );
});

export default VoiceMode;
