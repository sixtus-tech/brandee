import { useRef, useEffect } from 'react';

export default function ChatPanel({
  open,
  onClose,
  messages,
  input,
  setInput,
  onSend,
  isLoading,
  error,
  brandeeName = 'Brandee',
}) {
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Simple focus trap inside the panel when open
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const onTab = (e) => {
      if (e.key !== 'Tab') return;
      const focusable = panelRef.current.querySelectorAll(
        'button, textarea, input, [href], [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    panelRef.current.addEventListener('keydown', onTab);
    const node = panelRef.current;
    return () => node?.removeEventListener('keydown', onTab);
  }, [open]);

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  // Find latest assistant message for ARIA live announcement
  const latestAssistantMessage = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant' && !messages[i].typing) return messages[i].content;
    }
    return '';
  })();

  return (
    <>
      <div
        className={`chat-overlay ${open ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        className={`chat-panel ${open ? 'open' : ''}`}
        aria-hidden={!open}
        aria-label={`Chat with ${brandeeName}`}
        role="dialog"
        aria-modal="true"
      >
        <header className="chat-header">
          <div className="chat-title">
            <span className="chat-dot" />
            <div>
              <div className="chat-title-name">{brandeeName}</div>
              <div className="chat-title-sub">your brand & creative companion</div>
            </div>
          </div>
          <button className="chat-close" onClick={onClose} aria-label="Close chat (Esc)">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="chat-scroll" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="chat-welcome">
              <p className="welcome-line">
                Hey there. <span className="serif">I'm {brandeeName}.</span>
              </p>
              <p className="welcome-sub">
                Naming, positioning, copy, taste calls — throw something at me.
              </p>
              <div className="suggestions">
                {[
                  'Help me name a small coffee brand',
                  'My tagline feels generic, can you fix it',
                  "What's wrong with my About page copy?",
                  'I need a personality for a fintech app',
                ].map((s) => (
                  <button key={s} className="suggestion-chip" onClick={() => setInput(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`msg msg-${m.role}`}>
                <div className="msg-bubble">
                  {m.content}
                  {m.typing && <span className="caret" aria-hidden>▍</span>}
                </div>
              </div>
            ))
          )}
          {error && <div className="error-banner" role="alert">{error}</div>}
        </div>

        {/* Visually hidden live region for screen readers */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {latestAssistantMessage}
        </div>

        <div className="input-bar">
          <textarea
            ref={inputRef}
            className="input"
            placeholder={`Tell ${brandeeName} what you're working on…`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={isLoading}
            rows={1}
            aria-label="Message input"
          />
          <button
            className="send-btn"
            onClick={onSend}
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path
                d="M3 11l18-7-7 18-2-8-9-3z"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </aside>
    </>
  );
}
