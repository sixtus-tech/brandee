import { forwardRef } from 'react';
import BrandeeAvatar from './BrandeeAvatar.jsx';

/**
 * BrandeeStage — left column. Shows Brandee at full size with a status pill
 * underneath and a soft welcome line. This is her home.
 *
 * Forwards a ref to the avatar wrapper element (used by useCursorGaze).
 */
const BrandeeStage = forwardRef(function BrandeeStage({
  state,
  mood,
  vignette,
  cursorGaze,
  onPoke,
  brandeeName = 'Brandee',
  hasMessages = false,
  roastMode = false,
}, avatarRef) {
  return (
    <section className="brandee-stage-column" aria-label={`${brandeeName}, your AI desk assistant`}>
      <div className="stage-spacer-top" />

      <div className="brandee-pedestal">
        <BrandeeAvatar
          ref={avatarRef}
          state={state}
          mood={mood}
          vignette={vignette}
          cursorGaze={cursorGaze}
          onPoke={onPoke}
          size={260}
        />
      </div>

      <div className={`status-pill ${roastMode ? 'roast' : ''}`} aria-hidden>
        <span className="status-dot" />
        <span className="status-label">
          {roastMode && state === 'idle' ? 'HONEST MODE' : statusLabel(state, vignette, mood)}
        </span>
      </div>

      <div className={`welcome-text ${hasMessages ? 'fade' : ''}`}>
        <h1 className="welcome-headline">
          <span className="serif">
            {roastMode ? `Hi, I'm ${brandeeName}.` : `Hi, I'm ${brandeeName}.`}
          </span>
        </h1>
        <p className="welcome-sub">
          {roastMode
            ? "Honest mode is on. I'll say what I actually think — drop something."
            : 'Naming, positioning, copy, taste calls. Throw something at me.'}
        </p>
      </div>
    </section>
  );
});

export default BrandeeStage;

// Friendly label for the status pill
function statusLabel(state, vignette, mood) {
  const effective = state === 'idle' && vignette ? vignette : state;
  switch (effective) {
    case 'idle': return 'IDLE';
    case 'bored': return 'BORED';
    case 'listening': return 'LISTENING';
    case 'thinking': return 'THINKING';
    case 'speaking':
      if (mood === 'excited') return 'EXCITED';
      if (mood === 'skeptical') return 'SKEPTICAL';
      if (mood === 'playful') return 'PLAYFUL';
      return 'SPEAKING';
    case 'celebrating': return 'CELEBRATING';
    case 'error': return 'CONFUSED';
    case 'sleeping': return 'NAPPING';
    case 'yawning': return 'YAWNING';
    case 'humming': return 'HUMMING';
    case 'doodling': return 'DOODLING';
    case 'dancing': return 'DANCING';
    case 'butterfly': return 'DISTRACTED';
    case 'lookingAround': return 'LOOKING AROUND';
    case 'stretching': return 'STRETCHING';
    case 'peeking': return 'PEEKING';
    case 'startled': return 'STARTLED';
    case 'wave': return 'HI THERE';
    case 'giggle': return 'GIGGLING';
    case 'annoyed': return 'NOT AMUSED';
    default: return 'IDLE';
  }
}
