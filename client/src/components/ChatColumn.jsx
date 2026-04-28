import { useRef, useEffect } from 'react';

/**
 * ChatColumn — the right side of the app. Always visible, not a slide-out.
 * Shows suggestion chips when empty, then chat history above the input as
 * messages accumulate. The input bar is anchored to the bottom.
 */
export default function ChatColumn({
  messages,
  input,
  setInput,
  onSend,
  isLoading,
  error,
  brandeeName = 'Brandee',
  showOnboarding = false,
  onDismissOnboarding,
}) {
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Find latest non-typing assistant message for ARIA live announcement
  const latestAssistantMessage = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant' && !messages[i].typing) return messages[i].content;
    }
    return '';
  })();

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const isEmpty = messages.length === 0;
  const suggestions = [
    'Help me name a small coffee brand',
    'My tagline feels generic, can you fix it',
    "What's wrong with my About page copy?",
  ];

  return (
    <section className="chat-column" aria-label={`Chat with ${brandeeName}`}>
      <div className="chat-history" ref={scrollRef}>
        {!isEmpty &&
          messages.map((m, i) => (
            <div key={i} className={`msg msg-${m.role}`}>
              <div className="msg-bubble">
                {m.content}
                {m.typing && <span className="caret" aria-hidden>▍</span>}
              </div>
            </div>
          ))}
        {error && <div className="error-banner" role="alert">{error}</div>}
      </div>

      {/* SR-only live region for assistant messages */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {latestAssistantMessage}
      </div>

      <div className={`chat-bottom ${showOnboarding ? 'onboarding-active' : ''}`}>
        {isEmpty && (
          <div className="suggestions">
            {suggestions.map((s) => (
              <button
                key={s}
                className="suggestion-chip"
                onClick={() => {
                  setInput(s);
                  onDismissOnboarding?.();
                  setTimeout(() => inputRef.current?.focus(), 50);
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

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
      </div>
    </section>
  );
}
