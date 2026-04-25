import { useState, useRef, useEffect } from 'react';
import BrandeeAvatar from './BrandeeAvatar.jsx';

function StateBadge({ state }) {
  return (
    <div className="state-badge">
      <span className={`state-dot state-${state}`} />
      <span className="state-label">{state}</span>
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [agentState, setAgentState] = useState('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Listening state when typing
  useEffect(() => {
    if (isLoading) return;
    setAgentState(input.length > 0 ? 'listening' : 'idle');
  }, [input, isLoading]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setError(null);
    const userMsg = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    setAgentState('thinking');

    try {
      const response = await fetch('/api/chat', {
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

      const data = await response.json();
      const text = data.content || '';

      // Typewriter effect 
      setMessages((prev) => [...prev, { role: 'assistant', content: '', typing: true }]);
      setAgentState('speaking');

      const chars = Array.from(text);
      for (let i = 1; i <= chars.length; i++) {
        await new Promise((r) => setTimeout(r, 14));
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            role: 'assistant',
            content: chars.slice(0, i).join(''),
            typing: i < chars.length,
          };
          return copy;
        });
      }

      setAgentState('idle');
    } catch (e) {
      console.error(e);
      setError(e.message || 'Something went wrong.');
      setAgentState('idle');
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="brandee-app">
      <div className="grain" />

      <header className="header">
        <div className="brand-mark">
          <span className="brand-dot" />
          <span className="brand-name">Brandee</span>
        </div>
        <div className="header-meta">
          <span className="meta-text">brand &amp; creative companion</span>
        </div>
      </header>

      <main className="main">
        <section className="avatar-panel">
          <BrandeeAvatar state={agentState} />
          <StateBadge state={agentState} />
          {messages.length === 0 && (
            <div className="welcome">
              <h1 className="welcome-title">Hi, I'm Brandee.</h1>
              <p className="welcome-sub">
                Naming, positioning, copy, taste calls. Throw something at me.
              </p>
            </div>
          )}
        </section>

        <section className="chat-panel">
          <div className="chat-scroll" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="suggestions">
                {[
                  'Help me name a small coffee brand',
                  'My tagline feels generic, can you fix it',
                  "What's wrong with my About page copy?",
                ].map((s) => (
                  <button key={s} className="suggestion-chip" onClick={() => setInput(s)}>
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`msg msg-${m.role}`}>
                  <div className="msg-bubble">
                    {m.content}
                    {m.typing && <span className="caret">▍</span>}
                  </div>
                </div>
              ))
            )}
            {error && <div className="error-banner">{error}</div>}
          </div>

          <div className="input-bar">
            <textarea
              ref={inputRef}
              className="input"
              placeholder="Tell Brandee what you're working on…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={isLoading}
              rows={1}
            />
            <button
              className="send-btn"
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              aria-label="Send"
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path
                  d="M3 11l18-7-7 18-2-8-9-3z"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </section>
      </main>

      <footer className="footer">
        <span>Sixtus Kuudaar · {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}
