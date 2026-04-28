import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useIdleBehaviors — schedules random "idle vignettes" so Brandee feels alive
 * when no one's interacting with her. This is the marketability engine.
 *
 * Returns:
 *   { vignette, isBored, registerActivity, peekChat }
 *
 *   vignette         — current vignette name or null
 *   isBored          — true after long idle; the avatar shows bored face
 *   registerActivity — call when user interacts to reset the idle clock
 *   peekChat()       — externally-triggered "peek toward chat" vignette
 *                      (e.g. when chat has unread messages)
 */

// Vignettes that play during light idle (8–25s)
const QUICK_VIGNETTES = ['lookingAround', 'humming', 'stretching', 'butterfly', 'doodling'];
// Vignettes that play during deeper idle (25–45s) — slower, more "tired"
const TIRED_VIGNETTES = ['yawning', 'lookingAround', 'humming', 'stretching', 'doodling'];
// Vignettes that play occasionally even during fresh idle — "uppers" that surprise
const RARE_UPBEAT = ['dancing'];

const VIGNETTE_DURATIONS = {
  lookingAround: 2200,
  humming: 3500,
  stretching: 1800,
  butterfly: 4500,
  yawning: 2400,
  sleeping: 8000,
  doodling: 3800,
  dancing: 4200,
  peeking: 1800,
};

const pickRandom = (arr, exclude) => {
  const filtered = exclude ? arr.filter((x) => x !== exclude) : arr;
  return filtered[Math.floor(Math.random() * filtered.length)];
};

export default function useIdleBehaviors({ enabled = true } = {}) {
  const [vignette, setVignette] = useState(null);
  const [isBored, setIsBored] = useState(false);
  const idleStart = useRef(Date.now());
  const lastVignette = useRef(null);
  const timers = useRef({ next: null, end: null, bored: null });
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const clearAll = () => {
    Object.values(timers.current).forEach(clearTimeout);
    timers.current = { next: null, end: null, bored: null };
  };

  const registerActivity = useCallback(() => {
    clearAll();
    setVignette(null);
    setIsBored(false);
    idleStart.current = Date.now();
    if (enabledRef.current) {
      timers.current.next = setTimeout(scheduleVignette, 8000);
      timers.current.bored = setTimeout(() => setIsBored(true), 35000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Externally triggered peek — used when chat has unread to subtly draw the eye
  const peekChat = useCallback(() => {
    if (!enabledRef.current) return;
    clearTimeout(timers.current.next);
    clearTimeout(timers.current.end);
    setVignette('peeking');
    timers.current.end = setTimeout(() => {
      setVignette(null);
      timers.current.next = setTimeout(scheduleVignette, 4000);
    }, VIGNETTE_DURATIONS.peeking);
  }, []);

  const scheduleVignette = () => {
    if (!enabledRef.current) return;
    const idleMs = Date.now() - idleStart.current;

    // Occasional upbeat surprise (5% chance) to break the pattern
    let pool;
    if (Math.random() < 0.05 && idleMs < 30000) {
      pool = RARE_UPBEAT;
    } else if (idleMs > 45000) {
      // Drift toward sleep
      pool = Math.random() < 0.5 ? ['yawning'] : TIRED_VIGNETTES;
    } else if (idleMs > 25000) {
      pool = TIRED_VIGNETTES;
    } else {
      pool = QUICK_VIGNETTES;
    }

    playVignette(pickRandom(pool, lastVignette.current));
  };

  const playVignette = (name) => {
    setVignette(name);
    lastVignette.current = name;
    const duration = VIGNETTE_DURATIONS[name] || 2500;

    timers.current.end = setTimeout(() => {
      // Yawn → sleep transition
      if (name === 'yawning') {
        setVignette('sleeping');
        timers.current.end = setTimeout(() => {
          setVignette(null);
          timers.current.next = setTimeout(scheduleVignette, 6000);
        }, VIGNETTE_DURATIONS.sleeping);
        return;
      }

      setVignette(null);
      const idleMs = Date.now() - idleStart.current;
      const nextDelay = idleMs > 45000 ? 3500 : idleMs > 25000 ? 5500 : 8000;
      timers.current.next = setTimeout(scheduleVignette, nextDelay);
    }, duration);
  };

  // Initial scheduling
  useEffect(() => {
    if (!enabled) {
      clearAll();
      setVignette(null);
      setIsBored(false);
      return;
    }
    timers.current.next = setTimeout(scheduleVignette, 8000);
    timers.current.bored = setTimeout(() => setIsBored(true), 35000);
    return clearAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Tab focus awareness — gets bored faster if you walk away
  useEffect(() => {
    const onBlur = () => { idleStart.current = Date.now() - 30000; };
    const onFocus = () => registerActivity();
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, [registerActivity]);

  return { vignette, isBored, registerActivity, peekChat };
}
