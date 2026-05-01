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
  // Voice
  voiceEnabled = true,
  ttsAvailable = false,
  ttsSpeaking = false,
  onStopSpeaking,
  sttSupported = false,
  sttListening = false,
  sttInterim = '',
  onStartListening,
  onStopListening,
  // Drawer mode
  onClose,
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
  // Suggestions can be either text prompts or special actions (like opening the file picker).
  // Action chips look the same but trigger different behavior — used for the logo roast chip.
  const suggestions = roastMode
    ? [
        { kind: 'image', label: '📸 Drop your logo for an honest take', primary: true },
        { kind: 'text', label: 'Roast my tagline: "We move fast and make magic."' },
        { kind: 'text', label: "Why does my About page sound generic?" },
      ]
    : [
        { kind: 'image', label: '📸 Want my take on your logo? Drop it here.', primary: true },
        { kind: 'text', label: 'Help me name a small coffee brand' },
        { kind: 'text', label: 'My tagline feels generic, can you fix it' },
        { kind: 'text', label: "What's wrong with my About page copy?" },
      ];

  return (
    <section className={`chat-column ${isEmpty ? 'is-empty' : 'is-active'}`} aria-label={`Chat with ${brandeeName}`}>
      {roastMode && (
        <div className="chat-mode-banner">
          <span className="brand-dot" />
          <span className="serif">Honest mode</span>
          <span className="chat-banner-sub">— I'll tell you what I actually think.</span>
        </div>
      )}

      {/* Welcome hero — only shown before the first message */}
      {isEmpty && (
        <div className="chat-welcome">
          <div className="chat-welcome-inner">
            <h1 className="welcome-headline serif">
              {roastMode ? 'Drop something. I\'ll be honest.' : `Hi, I'm ${brandeeName}.`}
            </h1>
            <p className="welcome-sub">
              {roastMode
                ? "Drop a logo, paste a tagline, share your About page. I'll be honest."
                : "Naming, taglines, copy, taste calls. Type a question or drop an image."}
            </p>
          </div>
        </div>
      )}

      {!isEmpty && (
        <div className="chat-history" ref={scrollRef}>
          {messages.map((m, i) => (
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
      )}

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {latestAssistantMessage}
      </div>

      <div className={`chat-bottom ${showOnboarding ? 'onboarding-active' : ''} ${roastMode ? 'roast-active' : ''} ${isEmpty ? 'is-hero' : ''}`}>
        {isEmpty && (
          <div className="suggestions">
            {suggestions.map((s) => (
              <button
                key={s.label}
                className={`suggestion-chip ${s.kind === 'image' ? 'is-image-trigger' : ''} ${s.primary ? 'is-primary' : ''}`}
                onClick={() => {
                  onDismissOnboarding?.();
                  if (s.kind === 'image') {
                    fileInputRef.current?.click();
                  } else {
                    setInput(s.label);
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }
                }}
              >
                {s.label}
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
              sttListening
                ? sttInterim || 'Listening…'
                : pendingImage
                ? `Add a note (or just hit send and ${brandeeName} will take a look)…`
                : roastMode
                ? `Drop something for ${brandeeName} to roast…`
                : `Tell ${brandeeName} what you're working on…`
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={isLoading || sttListening}
            rows={1}
            aria-label="Message input"
          />

          {/* Mic button — only shown when voice is enabled and STT is supported */}
          {voiceEnabled && sttSupported && (
            <button
              type="button"
              className={`mic-btn ${sttListening ? 'recording' : ''}`}
              onClick={sttListening ? onStopListening : onStartListening}
              disabled={isLoading}
              aria-label={sttListening ? 'Stop listening' : 'Talk to Brandee'}
              aria-pressed={sttListening}
              title={sttListening ? 'Tap to stop' : 'Tap to talk'}
            >
              {sttListening ? (
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                  <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                  <path
                    d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"
                    fill="currentColor"
                  />
                  <path
                    d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              )}
              {sttListening && <span className="mic-pulse" aria-hidden />}
            </button>
          )}

          <button
            className="send-btn"
            onClick={onSend}
            disabled={(!input.trim() && !pendingImage) || isLoading || sttListening}
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

        {/* Speaking indicator — shown while TTS audio is playing */}
        {ttsSpeaking && (
          <button
            type="button"
            className="speaking-indicator"
            onClick={onStopSpeaking}
            aria-label="Stop speaking"
            title="Tap to stop"
          >
            <span className="speaking-bars" aria-hidden>
              <span /><span /><span /><span />
            </span>
            <span>{brandeeName} is speaking — tap to stop</span>
          </button>
        )}
      </div>
    </section>
  );
}
