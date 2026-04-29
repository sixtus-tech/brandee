import { forwardRef } from 'react';
import BrandeeAvatar from './BrandeeAvatar.jsx';

/**
 * Sidebar — Brandee's home. This is the "natural sidebar placement" the brief
 * specifically asked for: she lives in a small dedicated panel inside the app's
 * sidebar, like Slackbot or Clippy in the corner. Click her (or the chat button
 * below) to open the chat as a drawer.
 *
 * Layout:
 *   ┌────────────────┐
 *   │ • Brandee      │   ← brand mark
 *   │                │
 *   │   [BRANDEE]    │   ← her panel — clickable to chat
 *   │   IDLE pill    │
 *   │   "Hi, I'm…"   │
 *   │   [Chat] [🎤]  │   ← actions
 *   │                │
 *   │ ── Workspace ──│   ← fake nav (gives the sidebar context)
 *   │  📋 Brand kit  │
 *   │  ✏️  Copy      │
 *   │  🎯 Strategy   │
 *   │  📁 Library    │
 *   │                │
 *   │ ⚙ Settings     │
 *   └────────────────┘
 */
const Sidebar = forwardRef(function Sidebar({
  // Avatar
  state, mood, vignette, cursorGaze, audioAmplitude,
  // Brand
  brandeeName = 'Brandee',
  // Actions
  onOpenVoice,
  onOpenSettings,
  // Status
  roastMode = false,
}, avatarRef) {
  return (
    <aside className="sidebar" aria-label="Brandee sidebar">
      <div className="sidebar-brand">
        <span className="brand-dot" />
        <span className="brand-name serif">{brandeeName}</span>
      </div>

      {/* Brandee's home panel inside the sidebar */}
      <div className="brandee-home" role="region" aria-label={`${brandeeName}, your AI desk assistant`}>
        <div className="brandee-shelf">
          <div className="shelf-surface" aria-hidden />
          <div className="brandee-stage">
            <BrandeeAvatar
              ref={avatarRef}
              state={state}
              mood={mood}
              vignette={vignette}
              cursorGaze={cursorGaze}
              audioAmplitude={audioAmplitude}
              roastMode={roastMode}
              size={230}
              compact
            />
          </div>
        </div>

        <div className={`status-pill ${roastMode ? 'roast' : ''}`} aria-hidden>
          <span className="status-dot" />
          <span className="status-label">
            {roastMode && state === 'idle' ? 'HONEST MODE' : statusLabel(state, vignette, mood)}
          </span>
        </div>

        <div className="brandee-hint">
          <span className="serif">{roastMode ? "I'll be honest." : "Hi, I'm here."}</span>
          <span className="brandee-hint-sub">
            {roastMode
              ? 'Drop something for me to roast.'
              : 'Type below or hit voice mode to talk.'}
          </span>
        </div>

        <div className="brandee-actions">
          <button type="button" className="action-btn" onClick={onOpenVoice} title="Talk hands-free">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" fill="currentColor" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"
                stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
            <span>Voice mode</span>
          </button>
        </div>
      </div>

      <button type="button" className="sidebar-settings" onClick={onOpenSettings} aria-label="Settings">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" fill="none" />
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
            stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>Settings</span>
      </button>
    </aside>
  );
});

export default Sidebar;

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
    case 'lookingAround': return 'LOOKING';
    case 'stretching': return 'STRETCHING';
    case 'peeking': return 'PEEKING';
    case 'startled': return 'STARTLED';
    case 'wave': return 'HI THERE';
    case 'giggle': return 'GIGGLING';
    case 'annoyed': return 'NOT AMUSED';
    default: return 'IDLE';
  }
}
