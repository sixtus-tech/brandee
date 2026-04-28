import { useEffect, useRef } from 'react';

const COLOR_OPTIONS = [
  { name: 'Peach',    primary: '#F4A87C', deep: '#C46A40', accent: '#b8763a' },
  { name: 'Mint',     primary: '#A8D9C0', deep: '#5C9B7E', accent: '#3f8767' },
  { name: 'Lavender', primary: '#C9B6E6', deep: '#7E63A8', accent: '#6f4fa0' },
  { name: 'Butter',   primary: '#F4DC93', deep: '#C49A2E', accent: '#a07e1c' },
  { name: 'Sky',      primary: '#A8C9E6', deep: '#5C82AB', accent: '#456a92' },
];

export default function SettingsPanel({
  open,
  onClose,
  settings,
  onChange,
}) {
  const panelRef = useRef(null);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Click outside
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    // Defer one frame so the click that opened it doesn't immediately close it
    const t = setTimeout(() => document.addEventListener('mousedown', onClick), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="settings-panel"
      role="dialog"
      aria-label="Brandee settings"
      aria-modal="false"
    >
      <header className="settings-header">
        <h3>Brandee settings</h3>
        <button className="settings-close" onClick={onClose} aria-label="Close settings">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="settings-section">
        <label className="settings-label">Her name</label>
        <input
          type="text"
          className="settings-input"
          value={settings.name}
          onChange={(e) => onChange({ ...settings, name: e.target.value.slice(0, 20) })}
          placeholder="Brandee"
          maxLength={20}
        />
        <p className="settings-hint">What she goes by here.</p>
      </div>

      <div className="settings-section">
        <label className="settings-label">Color</label>
        <div className="color-grid">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c.name}
              className={`color-swatch ${settings.color === c.name ? 'selected' : ''}`}
              onClick={() => onChange({ ...settings, color: c.name })}
              aria-label={`${c.name} color`}
              aria-pressed={settings.color === c.name}
              style={{ background: `linear-gradient(135deg, ${c.primary}, ${c.deep})` }}
            >
              {settings.color === c.name && (
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path d="M5 12l5 5L20 7" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={settings.idleEnabled}
            onChange={(e) => onChange({ ...settings, idleEnabled: e.target.checked })}
          />
          <span className="toggle-track" aria-hidden>
            <span className="toggle-thumb" />
          </span>
          <span className="toggle-label">
            <span>Idle behaviors</span>
            <span className="settings-hint">Yawning, humming, looking around when ignored.</span>
          </span>
        </label>
      </div>

      <div className="settings-section">
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={settings.reduceMotion}
            onChange={(e) => onChange({ ...settings, reduceMotion: e.target.checked })}
          />
          <span className="toggle-track" aria-hidden>
            <span className="toggle-thumb" />
          </span>
          <span className="toggle-label">
            <span>Reduce motion</span>
            <span className="settings-hint">Minimize animation. Overrides system preference.</span>
          </span>
        </label>
      </div>
    </div>
  );
}

export { COLOR_OPTIONS };
