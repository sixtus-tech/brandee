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
  const [roastMode, setRoastMode] = useState(false);
  const [pendingImage, setPendingImage] = useState(null); // { dataUrl, mediaType, name, base64 }
  const [isDragging, setIsDragging] = useState(false);

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
    if (input.length > 0 || pendingImage) {
      setAgentState('listening');
      registerActivity();
    } else if (agentState === 'listening') {
      setAgentState('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, isLoading, pendingImage]);

  useEffect(() => {
    if (agentState === 'idle' && isBored) setAgentState('bored');
    else if (agentState === 'bored' && !isBored) setAgentState('idle');
  }, [isBored, agentState]);

  // When roast mode toggles, swap the baseline mood and reset the avatar
  useEffect(() => {
    if (isLoading) return;
    setAgentMood(roastMode ? 'skeptical' : 'neutral');
  }, [roastMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePoke = () => {
    registerActivity();
    dismissOnboarding();
  };

  // ============== IMAGE INTAKE (drag/drop + paste) ==============
  const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const MAX_BYTES = 5 * 1024 * 1024;

  const stageFile = useCallback((file) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(`Brandee can only look at JPG, PNG, WebP, or GIF.`);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`That image is too big — keep it under 5MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(',')[1] || '';
      setPendingImage({
        dataUrl,
        mediaType: file.type,
        name: file.name || 'image',
        base64,
      });
      setError(null);
      registerActivity();
      dismissOnboarding();
    };
    reader.readAsDataURL(file);
  }, [registerActivity, dismissOnboarding]);

  // Window-level drag tracking (so the drop overlay shows for the whole app)
  useEffect(() => {
    let dragDepth = 0;
    const onDragEnter = (e) => {
      if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
      dragDepth++;
      setIsDragging(true);
    };
    const onDragLeave = () => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) setIsDragging(false);
    };
    const onDragOver = (e) => {
      if (e.dataTransfer?.types?.includes?.('Files')) {
        e.preventDefault();
      }
    };
    const onDrop = (e) => {
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      dragDepth = 0;
      setIsDragging(false);
      const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'));
      if (file) stageFile(file);
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [stageFile]);

  // Paste handler (Cmd/Ctrl+V with image in clipboard)
  useEffect(() => {
    const onPaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            stageFile(file);
            return;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [stageFile]);

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
    const hasImage = !!pendingImage;
    if ((!trimmed && !hasImage) || isLoading) return;

    setError(null);
    registerActivity();
    dismissOnboarding();

    // Build the user message content shape
    let userContent;
    let userMessageDisplay; // what to show in the chat history (image preview + text)
    if (hasImage) {
      const blocks = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: pendingImage.mediaType,
            data: pendingImage.base64,
          },
        },
      ];
      if (trimmed) blocks.push({ type: 'text', text: trimmed });
      else blocks.push({ type: 'text', text: 'What do you think?' });
      userContent = blocks;
      userMessageDisplay = {
        role: 'user',
        content: trimmed || 'What do you think?',
        imageDataUrl: pendingImage.dataUrl,
      };
    } else {
      userContent = trimmed;
      userMessageDisplay = { role: 'user', content: trimmed };
    }

    // Append user message to display history
    const newDisplayMessages = [...messages, userMessageDisplay];
    setMessages(newDisplayMessages);

    // Build the API messages — past messages we send as text-only since the
    // image content from earlier turns is already represented by Brandee's response.
    // For the *current* turn we send the full content (with image if present).
    const apiMessages = newDisplayMessages.map((m, i) => {
      if (i === newDisplayMessages.length - 1 && Array.isArray(userContent)) {
        return { role: 'user', content: userContent };
      }
      return { role: m.role, content: m.content };
    });

    setInput('');
    setPendingImage(null);
    setIsLoading(true);
    setAgentState('thinking');
    setAgentMood(roastMode ? 'skeptical' : 'thinking');

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
        setTimeout(() => setAgentMood(roastMode ? 'skeptical' : 'neutral'), 4000);
      }, 600);
    };

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          mode: roastMode ? 'roast' : 'default',
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
        setAgentMood(roastMode ? 'skeptical' : 'neutral');
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
          roastMode={roastMode}
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
          roastMode={roastMode}
          onToggleRoast={() => setRoastMode((v) => !v)}
          pendingImage={pendingImage}
          onClearPendingImage={() => setPendingImage(null)}
          onPickFile={stageFile}
        />
      </main>

      {/* Drag-over overlay */}
      {isDragging && (
        <div className="drop-overlay" aria-hidden>
          <div className="drop-card">
            <div className="drop-icon">↓</div>
            <div className="drop-title serif">Drop it here</div>
            <div className="drop-sub">Brandee will take a look.</div>
          </div>
        </div>
      )}

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
