import { useState, useEffect } from 'react';

/**
 * useCursorGaze — when the cursor enters a radius around the target,
 * computes a small gaze offset that the avatar can use to "look at" it.
 *
 * Returns { x, y, active } where x,y are bounded offsets in SVG units
 * suitable for adding to eye coordinates (-8..8 range), and `active`
 * is true when the cursor is within the radius.
 *
 * Pointer-only: ignores touch (no hover on mobile).
 */
export default function useCursorGaze(targetRef, { radius = 320, maxOffset = 8 } = {}) {
  const [gaze, setGaze] = useState({ x: 0, y: 0, active: false });

  useEffect(() => {
    let raf = 0;
    let lastEvent = null;

    const compute = () => {
      raf = 0;
      const e = lastEvent;
      if (!e || !targetRef.current) return;
      const rect = targetRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);

      if (dist > radius) {
        setGaze((g) => (g.active ? { x: 0, y: 0, active: false } : g));
        return;
      }

      // Map cursor angle to small offset; magnitude scales with proximity
      const proximity = 1 - dist / radius; // 0..1, 1 when at center
      const angle = Math.atan2(dy, dx);
      const mag = maxOffset * (0.5 + 0.5 * proximity); // never less than 50% of max within radius
      setGaze({
        x: Math.cos(angle) * mag,
        y: Math.sin(angle) * mag,
        active: true,
      });
    };

    const onMove = (e) => {
      lastEvent = e;
      if (raf) return;
      raf = requestAnimationFrame(compute);
    };

    const onLeave = () => {
      setGaze({ x: 0, y: 0, active: false });
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [targetRef, radius, maxOffset]);

  return gaze;
}
