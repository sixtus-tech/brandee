import { forwardRef } from 'react';
import BrandeeAvatar from './BrandeeAvatar.jsx';
import { OnboardingPointer } from '../hooks/useOnboarding.jsx';

const NAV_ITEMS = [
  { label: 'Home', icon: 'home', active: true },
  { label: 'Brand Hub', icon: 'sparkle' },
  { label: 'Content', icon: 'doc' },
  { label: 'Campaigns', icon: 'target' },
  { label: 'Assets', icon: 'image' },
  { label: 'Insights', icon: 'chart' },
];

const AppShell = forwardRef(function AppShell({
  children,
  brandeeState,
  brandeeMood,
  vignette,
  cursorGaze,
  onPokeBrandee,
  onOpenChat,
  onOpenSettings,
  hasUnread,
  brandeeName = 'Brandee',
  showOnboarding = false,
  onDismissOnboarding,
}, brandeeWrapperRef) {
  return (
    <div className="app-shell">
      <div className="grain" />

      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="logo">
            <span className="logo-dot" />
            <span className="logo-text">{brandeeName}</span>
          </div>

          <nav className="nav" aria-label="Primary">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.label}
                href="#"
                className={`nav-item ${item.active ? 'active' : ''}`}
                onClick={(e) => e.preventDefault()}
                aria-current={item.active ? 'page' : undefined}
              >
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
              </a>
            ))}
          </nav>
        </div>

        {/* BRANDEE'S HOME */}
        <div className="brandee-home">
          <div className="brandee-shelf">
            <div className="shelf-surface" />

            <div className="brandee-stage">
              <BrandeeAvatar
                ref={brandeeWrapperRef}
                state={brandeeState}
                mood={brandeeMood}
                vignette={vignette}
                cursorGaze={cursorGaze}
                onPoke={onPokeBrandee}
                size={140}
                compact
              />
            </div>

            <button
              className={`chat-trigger ${hasUnread ? 'has-unread' : ''} ${showOnboarding ? 'onboarding-target' : ''}`}
              onClick={onOpenChat}
              aria-label={`Open chat with ${brandeeName}`}
              aria-keyshortcuts="Control+K Meta+K"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                <path
                  d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Chat with {brandeeName}</span>
              {hasUnread && <span className="unread-pulse" aria-label="unread message" />}
            </button>
          </div>

          <OnboardingPointer visible={showOnboarding} onDismiss={onDismissOnboarding} />

          <div className="user-row">
            <div className="user-avatar" aria-hidden>YN</div>
            <div className="user-info">
              <div className="user-name">Your Name</div>
              <div className="user-team">Acme Co</div>
            </div>
            <button
              className="settings-btn"
              onClick={onOpenSettings}
              aria-label="Brandee settings"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" fill="none" />
                <path
                  d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">{children}</main>
    </div>
  );
});

export default AppShell;

function NavIcon({ name }) {
  const props = {
    width: 18, height: 18, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
  };
  switch (name) {
    case 'home':    return <svg {...props}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2V9z" /></svg>;
    case 'sparkle': return <svg {...props}><path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z" /></svg>;
    case 'doc':     return <svg {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>;
    case 'target':  return <svg {...props}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></svg>;
    case 'image':   return <svg {...props}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="1.5" fill="currentColor" /><path d="M21 16l-5-5-9 9" /></svg>;
    case 'chart':   return <svg {...props}><path d="M3 20h18M6 16V9M11 16V5M16 16v-7M21 16v-3" /></svg>;
    default: return null;
  }
}
