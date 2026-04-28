import { useEffect, useState } from 'react';

const STORAGE_KEY = 'brandee_onboarded_v1';

/**
 * useOnboarding — manages a one-time onboarding moment.
 *
 * Flow:
 *  1. On first ever load, after a short delay, fires onWaveTrigger() so App
 *     can show Brandee's wave reaction.
 *  2. After the wave begins, returns showPointer=true so the UI can render an
 *     animated arrow pointing at the chat trigger button.
 *  3. The pointer dismisses automatically after a few seconds, OR when the
 *     user interacts in any meaningful way (click, type, etc.).
 *  4. localStorage flag is set; never shows again.
 *
 * Returns: { showPointer, dismiss }
 */
export default function useOnboarding({ onWaveTrigger }) {
  const [showPointer, setShowPointer] = useState(false);
  const [done, setDone] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return true; // SSR or storage blocked — skip onboarding
    }
  });

  useEffect(() => {
    if (done) return;
    const waveTimer = setTimeout(() => {
      onWaveTrigger?.();
      // Show the pointer slightly after the wave begins
      setTimeout(() => setShowPointer(true), 400);
    }, 1200);
    // Auto-dismiss after a healthy beat
    const dismissTimer = setTimeout(() => dismiss(), 9000);
    return () => {
      clearTimeout(waveTimer);
      clearTimeout(dismissTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const dismiss = () => {
    if (done) return;
    setShowPointer(false);
    setDone(true);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
  };

  return { showPointer, dismiss };
}

export function OnboardingPointer({ visible, onDismiss }) {
  if (!visible) return null;
  return (
    <div className="onboarding-pointer" role="status" aria-live="polite" onClick={onDismiss}>
      <div className="pointer-bubble">
        <span className="pointer-text">Try chatting with me!</span>
      </div>
      <svg className="pointer-arrow" viewBox="0 0 40 40" width="36" height="36">
        <path
          d="M 8 8 Q 20 8 24 20 Q 26 28 32 32"
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="4 3"
        />
        <path
          d="M 32 32 L 26 30 M 32 32 L 30 26"
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
