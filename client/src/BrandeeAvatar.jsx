import { useState, useEffect } from 'react';

export default function BrandeeAvatar({ state }) {
  const [blink, setBlink] = useState(false);
  const [lookDir, setLookDir] = useState({ x: 0, y: 0 });

  // Idle blinking
  useEffect(() => {
    if (state === 'thinking') return;
    const blinkLoop = () => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
    };
    const interval = setInterval(blinkLoop, 3200 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, [state]);

  
  useEffect(() => {
    if (state !== 'idle') {
      setLookDir({ x: 0, y: 0 });
      return;
    }
    const drift = setInterval(() => {
      setLookDir({
        x: (Math.random() - 0.5) * 4,
        y: (Math.random() - 0.5) * 2,
      });
    }, 2400);
    return () => clearInterval(drift);
  }, [state]);

  const isThinking = state === 'thinking';
  const isSpeaking = state === 'speaking';
  const isListening = state === 'listening';

  const eyeOffset = isListening
    ? { x: 0, y: 3 }
    : isThinking
    ? { x: 4, y: -5 }
    : lookDir;

  const eyeRY = blink ? 1 : isThinking ? 2 : 11;

  return (
    <div className={`avatar-wrap state-${state}`}>
      <svg viewBox="0 0 260 260" className="avatar-svg" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="bodyGrad" cx="35%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#FFC9A8" />
            <stop offset="55%" stopColor="#F4A87C" />
            <stop offset="100%" stopColor="#D67D52" />
          </radialGradient>
          <radialGradient id="cheekGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#E85A4F" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#E85A4F" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="highlightGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFE8D2" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#FFE8D2" stopOpacity="0" />
          </radialGradient>
          <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="4" />
            <feOffset dx="0" dy="4" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.25" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ground shadow */}
        <ellipse
          cx="130"
          cy="238"
          rx={isSpeaking ? 64 : 70}
          ry="6"
          fill="#1A1815"
          opacity="0.12"
          className="ground-shadow"
        />

        {/* Body group */}
        <g className="body-group" filter="url(#softShadow)">
          <ellipse cx="130" cy="130" rx="92" ry="96" fill="url(#bodyGrad)" />
          <ellipse cx="100" cy="80" rx="40" ry="30" fill="url(#highlightGrad)" />

          {/* Tuft */}
          <path
            d="M 130 35 Q 138 18 148 28 Q 142 38 130 40 Z"
            fill="#D67D52"
            className="tuft"
          />

          {/* Cheeks */}
          <ellipse cx="78" cy="148" rx="14" ry="10" fill="url(#cheekGrad)" />
          <ellipse cx="182" cy="148" rx="14" ry="10" fill="url(#cheekGrad)" />

          {/* Eyes */}
          <g className="eyes-group">
            <ellipse
              cx={98 + eyeOffset.x}
              cy={112 + eyeOffset.y}
              rx="8"
              ry={eyeRY}
              fill="#1A1815"
              style={{ transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)' }}
            />
            <ellipse
              cx={162 + eyeOffset.x}
              cy={112 + eyeOffset.y}
              rx="8"
              ry={eyeRY}
              fill="#1A1815"
              style={{ transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)' }}
            />
            {!blink && !isThinking && (
              <>
                <circle cx={100 + eyeOffset.x} cy={108 + eyeOffset.y} r="2.5" fill="white" />
                <circle cx={164 + eyeOffset.x} cy={108 + eyeOffset.y} r="2.5" fill="white" />
              </>
            )}
          </g>

          {/* Mouth */}
          <g className="mouth-group">
            {isSpeaking ? (
              <ellipse
                cx="130"
                cy="158"
                rx="11"
                ry="9"
                fill="#1A1815"
                className="mouth-speaking"
              />
            ) : isThinking ? (
              <circle cx="130" cy="158" r="3.5" fill="#1A1815" />
            ) : isListening ? (
              <path
                d="M 116 156 Q 130 164 144 156"
                stroke="#1A1815"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M 118 154 Q 130 162 142 154"
                stroke="#1A1815"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
              />
            )}
          </g>
        </g>

        {/* Thinking dots */}
        {isThinking && (
          <g className="thinking-dots">
            <circle cx="200" cy="60" r="4" fill="#B8763A" className="t-dot t-dot-1" />
            <circle cx="218" cy="48" r="5" fill="#B8763A" className="t-dot t-dot-2" />
            <circle cx="238" cy="34" r="6" fill="#B8763A" className="t-dot t-dot-3" />
          </g>
        )}

        {/* Listening rings */}
        {isListening && (
          <g className="listen-rings">
            <circle cx="130" cy="130" r="100" fill="none" stroke="#B8763A" strokeWidth="1.5" className="ring r-1" />
            <circle cx="130" cy="130" r="100" fill="none" stroke="#B8763A" strokeWidth="1.5" className="ring r-2" />
          </g>
        )}
      </svg>
    </div>
  );
}
