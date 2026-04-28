import { useRef, useEffect } from 'react';

/**
 * ChatColumn — the right side of the app. Always visible.
 * Holds chat history, suggestion chips (when empty), an image preview chip
 * (when an image is staged), the roast-mode toggle, and the input bar.
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
  roastMode = false,
  onToggleRoast,
  pendingImage = null,
  onClearPendingImage,
  onPickFile,
}) {
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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

  const onAttachClick = () => fileInputRef.current?.click();
  const onFileChosen = (e) => {
    const file = e.target.files?.[0];
    if (file) onPickFile?.(file);
    e.target.value = '';
  };

  const isEmpty = messages.length === 0;
  const suggestions = roastMode
    ? [
        'Roast my tagline: "We move fast and make magic."',
        "Why does my About page sound generic?",
        'Tell me what brand sounds like a dentist office',
      ]
    : [
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
                {m.imageDataUrl && (
                  <img
                    src={m.imageDataUrl}
                    alt="attachment"
                    className="msg-image"
                  />
                )}
                {m.content}
                {m.typing && <span className="caret" aria-hidden>▍</span>}
              </div>
            </div>
          ))}
        {error && <div className="error-banner" role="alert">{error}</div>}
      </div>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {latestAssistantMessage}
      </div>

      <div className={`chat-bottom ${showOnboarding ? 'onboarding-active' : ''} ${roastMode ? 'roast-active' : ''}`}>
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

        {/* Roast mode toggle pill */}
        <div className="mode-row">
          <button
            type="button"
            className={`mode-toggle ${roastMode ? 'on' : ''}`}
            onClick={onToggleRoast}
            aria-pressed={roastMode}
            aria-label={roastMode ? 'Switch off honest mode' : 'Switch on honest mode'}
            title={roastMode ? 'Honest mode is on. Click to soften.' : 'Honest mode: unfiltered feedback.'}
          >
            <span className="mode-dot" aria-hidden />
            <span className="mode-label">{roastMode ? 'Honest mode: ON' : 'Be honest with me'}</span>
          </button>
          {roastMode && (
            <span className="roast-helper">she'll tell you what she actually thinks</span>
          )}
        </div>

        {/* Image preview chip when staged */}
        {pendingImage && (
          <div className="image-preview" role="group" aria-label="Image attached">
            <img src={pendingImage.dataUrl} alt={pendingImage.name} />
            <div className="image-preview-meta">
              <div className="image-preview-name" title={pendingImage.name}>
                {pendingImage.name}
              </div>
              <div className="image-preview-hint">
                {roastMode ? "she'll be honest" : "she'll take a look"}
              </div>
            </div>
            <button
              type="button"
              className="image-preview-remove"
              onClick={onClearPendingImage}
              aria-label="Remove image"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}

        <div className="input-bar">
          <button
            type="button"
            className="attach-btn"
            onClick={onAttachClick}
            disabled={isLoading || !!pendingImage}
            aria-label="Attach an image"
            title="Attach an image (or just paste / drop one)"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path
                d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={onFileChosen}
            style={{ display: 'none' }}
          />

          <textarea
            ref={inputRef}
            className="input"
            placeholder={
              pendingImage
                ? `Add a note (or just hit send and ${brandeeName} will take a look)…`
                : roastMode
                ? `Drop something for ${brandeeName} to roast…`
                : `Tell ${brandeeName} what you're working on…`
            }
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
            disabled={(!input.trim() && !pendingImage) || isLoading}
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
