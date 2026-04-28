import { useState, useEffect, useRef, useCallback } from 'react';
import BrandeeStage from './components/BrandeeStage.jsx';
import ChatColumn from './components/ChatColumn.jsx';
import SettingsPanel, { COLOR_OPTIONS } from './components/SettingsPanel.jsx';
import { OnboardingPointer } from './hooks/useOnboarding.jsx';
import useIdleBehaviors from './hooks/useIdleBehaviors.js';
import useCursorGaze from './hooks/useCursorGaze.js';
import useOnboarding from './hooks/useOnboarding.jsx';

const SETTINGS_KEY = 'brandee_settings_v1';

const DEFAULT_SETTINGS = {
  name: 'Brandee',
  color: 'Peach',
  idleEnabled: true,
  reduceMotion: false,
};

export default function App() {
  // ============== SETTINGS (persisted) ==============
  const [settings, setSettings] = useState(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_SETTINGS;
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Persist + apply theme
  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
    const colorDef = COLOR_OPTIONS.find((c) => c.name === settings.color) || COLOR_OPTIONS[0];
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', colorDef.primary);
    root.style.setProperty('--brand-deep', colorDef.deep);
    root.style.setProperty('--accent', colorDef.accent);
    root.classList.toggle('reduce-motion', !!settings.reduceMotion);
  }, [settings]);

  // ============== CHAT STATE ==============
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // ============== AVATAR STATE ==============
  const [agentState, setAgentState] = useState('idle');
  const [agentMood, setAgentMood] = useState('neutral');

  // ============== IDLE DIRECTOR ==============
  const idleEnabled =
    settings.idleEnabled &&
    !isLoading &&
    !['speaking', 'celebrating', 'error'].includes(agentState);
  const { vignette, isBored, registerActivity } = useIdleBehaviors({ enabled: idleEnabled });

  // ============== CURSOR GAZE ==============
  const avatarRef = useRef(null);
  const cursorGaze = useCursorGaze(avatarRef, { radius: 360, maxOffset: 11 });

  useEffect(() => {
    if (cursorGaze.active) registerActivity();
  }, [cursorGaze.active, registerActivity]);

  // ============== ONBOARDING ==============
  const triggerWave = useCallback(() => {
    setAgentState('wave');
    setTimeout(() => setAgentState('idle'), 1500);
  }, []);
  const { showPointer: showOnboarding, dismiss: dismissOnboarding } = useOnboarding({
    onWaveTrigger: triggerWave,
  });

  // ============== STATE INTERPLAY ==============
  useEffect(() => {
    if (isLoading) return;
    if (input.length > 0) {
      setAgentState('listening');
      registerActivity();
    } else if (agentState === 'listening') {
      setAgentState('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, isLoading]);

  useEffect(() => {
    if (agentState === 'idle' && isBored) setAgentState('bored');
    else if (agentState === 'bored' && !isBored) setAgentState('idle');
  }, [isBored, agentState]);

  const handlePoke = () => {
    registerActivity();
    dismissOnboarding();
  };

  // Cmd/Ctrl+K focuses the chat input
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const input = document.querySelector('textarea.input');
        if (input) {
          input.focus();
          dismissOnboarding();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============== CHAT FLOW (streaming) ==============
  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setError(null);
    registerActivity();
    dismissOnboarding();
    const userMsg = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    setAgentState('thinking');
    setAgentMood('thinking');

    setMessages((prev) => [...prev, { role: 'assistant', content: '', typing: true }]);

    let receivedAnyText = false;
    let celebrationDone = false;

    const appendChunk = (text) => {
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        copy[copy.length - 1] = {
          ...last,
          content: (last.content || '') + text,
          typing: true,
        };
        return copy;
      });
      if (!receivedAnyText) {
        receivedAnyText = true;
        if (!celebrationDone) setAgentState('speaking');
      }
    };

    const finalize = () => {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { ...copy[copy.length - 1], typing: false };
        return copy;
      });
      setIsLoading(false);
      setTimeout(() => {
        setAgentState('idle');
        setTimeout(() => setAgentMood('neutral'), 4000);
      }, 600);
    };

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const block of events) {
          if (!block.trim()) continue;
          const eventMatch = block.match(/^event: (\w+)/m);
          const dataMatch = block.match(/^data: (.+)$/m);
          if (!eventMatch || !dataMatch) continue;
          const event = eventMatch[1];
          let data;
          try { data = JSON.parse(dataMatch[1]); } catch { continue; }

          if (event === 'mood') {
            setAgentMood(data.mood || 'neutral');
            if (data.mood === 'celebrating') {
              setAgentState('celebrating');
              celebrationDone = false;
              setTimeout(() => {
                celebrationDone = true;
                if (receivedAnyText) setAgentState('speaking');
              }, 1200);
            }
          } else if (event === 'chunk') {
            appendChunk(data.text);
          } else if (event === 'error') {
            throw new Error(data.error || 'stream error');
          } else if (event === 'done') {
            finalize();
            return;
          }
        }
      }

      finalize();
    } catch (e) {
      console.error(e);
      setError(e.message || 'Something went wrong.');
      setAgentState('error');
      setAgentMood('confused');
      setMessages((prev) => {
        const copy = [...prev];
        if (copy.length && copy[copy.length - 1].role === 'assistant' && !copy[copy.length - 1].content) {
          copy.pop();
        }
        return copy;
      });
      setTimeout(() => {
        setAgentState('idle');
        setAgentMood('neutral');
      }, 3000);
      setIsLoading(false);
    }
  };

  return (
    <div className="app-root">
      <div className="grain" />

      <header className="app-header">
        <div className="brand-mark">
          <span className="brand-dot" />
          <span className="brand-name serif">{settings.name || 'Brandee'}</span>
        </div>
        <div className="header-right">
          <span className="header-tagline">BRAND &amp; CREATIVE COMPANION</span>
          <button
            className="settings-btn"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-label="Settings"
            aria-expanded={settingsOpen}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
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
      </header>

      <main className="app-main">
        <BrandeeStage
          ref={avatarRef}
          state={agentState}
          mood={agentMood}
          vignette={vignette}
          cursorGaze={cursorGaze}
          onPoke={handlePoke}
          brandeeName={settings.name || 'Brandee'}
          hasMessages={messages.length > 0}
        />

        <ChatColumn
          messages={messages}
          input={input}
          setInput={setInput}
          onSend={sendMessage}
          isLoading={isLoading}
          error={error}
          brandeeName={settings.name || 'Brandee'}
          showOnboarding={showOnboarding}
          onDismissOnboarding={dismissOnboarding}
        />
      </main>

      {/* Onboarding pointer — points at the chat input */}
      {showOnboarding && (
        <OnboardingPointer visible={showOnboarding} onDismiss={dismissOnboarding} />
      )}

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={setSettings}
      />
    </div>
  );
}
