import { useState, useEffect, useRef, useCallback } from 'react';
import AppShell from './components/AppShell.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import MockDashboard from './components/MockDashboard.jsx';
import SettingsPanel, { COLOR_OPTIONS } from './components/SettingsPanel.jsx';
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
  const [chatOpen, setChatOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  // ============== AVATAR STATE ==============
  const [agentState, setAgentState] = useState('idle');
  const [agentMood, setAgentMood] = useState('neutral');

  // ============== IDLE DIRECTOR ==============
  const idleEnabled =
    settings.idleEnabled &&
    !isLoading &&
    !chatOpen &&
    !['speaking', 'celebrating', 'error'].includes(agentState);
  const { vignette, isBored, registerActivity, peekChat } = useIdleBehaviors({ enabled: idleEnabled });

  // ============== CURSOR GAZE ==============
  const brandeeWrapperRef = useRef(null);
  const cursorGaze = useCursorGaze(brandeeWrapperRef, { radius: 360, maxOffset: 11 });

  // Cursor near her also counts as activity (resets idle clock)
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

  // ============== LISTENING / BORED INTERPLAY ==============
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

  // Peek toward chat when there's an unread message
  useEffect(() => {
    if (!hasUnread || chatOpen || isLoading) return;
    const t = setTimeout(() => peekChat(), 4000);
    return () => clearTimeout(t);
  }, [hasUnread, chatOpen, isLoading, peekChat]);

  // ============== INTERACTION HANDLERS ==============
  const handlePoke = () => {
    registerActivity();
    dismissOnboarding();
  };

  const handleOpenChat = () => {
    setChatOpen(true);
    setHasUnread(false);
    registerActivity();
    dismissOnboarding();
  };

  const handleCloseChat = () => setChatOpen(false);

  // Keyboard shortcut Cmd/Ctrl+K to toggle chat
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (chatOpen) handleCloseChat();
        else handleOpenChat();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatOpen]);

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

    // Add an empty assistant message that we'll fill as the stream arrives
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
      if (!chatOpen) setHasUnread(true);
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

      // Parse SSE
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Split on event boundaries (double newline)
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
      // Remove the empty assistant placeholder
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

  const triggerCelebration = () => {
    registerActivity();
    setAgentState('celebrating');
    setAgentMood('excited');
    setTimeout(() => {
      setAgentState('idle');
      setAgentMood('neutral');
    }, 2400);
  };

  return (
    <>
      <AppShell
        ref={brandeeWrapperRef}
        brandeeState={agentState}
        brandeeMood={agentMood}
        vignette={vignette}
        cursorGaze={cursorGaze}
        onPokeBrandee={handlePoke}
        onOpenChat={handleOpenChat}
        onOpenSettings={() => setSettingsOpen(true)}
        hasUnread={hasUnread}
        brandeeName={settings.name || 'Brandee'}
        showOnboarding={showOnboarding}
        onDismissOnboarding={dismissOnboarding}
      >
        <MockDashboard onCelebrate={triggerCelebration} />
      </AppShell>

      <ChatPanel
        open={chatOpen}
        onClose={handleCloseChat}
        messages={messages}
        input={input}
        setInput={setInput}
        onSend={sendMessage}
        isLoading={isLoading}
        error={error}
        brandeeName={settings.name || 'Brandee'}
      />

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={setSettings}
      />
    </>
  );
}
