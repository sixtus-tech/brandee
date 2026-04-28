import { useState, useEffect, useRef, useMemo, forwardRef } from 'react';

/**
 * BrandeeAvatar — the soul of the assistant.
 *
 * Props:
 *   state         — primary: idle | bored | listening | thinking | speaking | error | celebrating
 *   mood          — secondary from AI response: neutral | excited | confused | skeptical | playful
 *   vignette      — current idle vignette name (from useIdleBehaviors), or null
 *   cursorGaze    — { x, y, active } from useCursorGaze; overrides eye direction when active
 *   onPoke        — called when user clicks her
 *   size          — pixel size (default 200)
 *   compact       — if true, minor layout tweaks for sidebar use
 *   srLabel       — optional override for screen-reader live region label
 *
 * Forwards a ref to the wrapper element (used by the cursor-gaze hook).
 */
const BrandeeAvatar = forwardRef(function BrandeeAvatar({
  state = 'idle',
  mood = 'neutral',
  vignette = null,
  cursorGaze = null,
  onPoke,
  size = 200,
  compact = false,
  srLabel,
}, ref) {
  const [blink, setBlink] = useState(false);
  const [lookDir, setLookDir] = useState({ x: 0, y: 0 });
  const [pokeCount, setPokeCount] = useState(0);
  const [pokeReaction, setPokeReaction] = useState(null);
  const pokeTimer = useRef(null);

  // Resolve effective state: vignettes override 'idle' state
  const effectiveState = useMemo(() => {
    if (state === 'idle' && vignette) return vignette;
    return state;
  }, [state, vignette]);

  // Blinking — varies by state
  useEffect(() => {
    if (['thinking', 'sleeping', 'celebrating'].includes(effectiveState)) return;
    const blinkOnce = () => {
      setBlink(true);
      setTimeout(() => setBlink(false), 130);
    };
    const interval = setInterval(blinkOnce, 2800 + Math.random() * 2400);
    return () => clearInterval(interval);
  }, [effectiveState]);

  // Idle eye drift — looks around when not focused
  useEffect(() => {
    if (effectiveState !== 'idle' && effectiveState !== 'bored') {
      setLookDir({ x: 0, y: 0 });
      return;
    }
    const drift = setInterval(() => {
      setLookDir({
        x: (Math.random() - 0.5) * 5,
        y: (Math.random() - 0.5) * 3,
      });
    }, 2200);
    return () => clearInterval(drift);
  }, [effectiveState]);

  // Click reactions — escalate with repeated pokes
  const handlePoke = (e) => {
    e.stopPropagation();
    const next = pokeCount + 1;
    setPokeCount(next);
    if (next === 1) setPokeReaction('startled');
    else if (next === 2) setPokeReaction('wave');
    else if (next === 3) setPokeReaction('giggle');
    else if (next >= 4) setPokeReaction('annoyed');

    clearTimeout(pokeTimer.current);
    pokeTimer.current = setTimeout(() => {
      setPokeReaction(null);
      // Reset escalation after a calm period
      setTimeout(() => setPokeCount(0), 4000);
    }, 1500);
    onPoke?.(next);
  };

  useEffect(() => () => clearTimeout(pokeTimer.current), []);

  const visualState = pokeReaction || effectiveState;

  // ============== FACE LOGIC ==============
  const isThinking = visualState === 'thinking';
  const isSpeaking = visualState === 'speaking';
  const isListening = visualState === 'listening';
  const isError = visualState === 'error';
  const isCelebrating = visualState === 'celebrating';
  const isBored = visualState === 'bored';
  const isSleeping = visualState === 'sleeping';
  const isYawning = visualState === 'yawning';
  const isStretching = visualState === 'stretching';
  const isHumming = visualState === 'humming';
  const isLookingAround = visualState === 'lookingAround';
  const isStartled = visualState === 'startled';
  const isWaving = visualState === 'wave';
  const isGiggling = visualState === 'giggle';
  const isAnnoyed = visualState === 'annoyed';
  const isWatchingButterfly = visualState === 'butterfly';
  const isDoodling = visualState === 'doodling';
  const isDancing = visualState === 'dancing';
  const isPeeking = visualState === 'peeking';
  const isExcited = mood === 'excited' && !pokeReaction;
  const isConfused = mood === 'confused' || isError;
  const isSkeptical = mood === 'skeptical';
  const isPlayful = mood === 'playful';

  // Eye look offsets per state
  let eyeOffset = lookDir;
  if (isListening) eyeOffset = { x: 0, y: 4 };
  else if (isThinking) eyeOffset = { x: 5, y: -5 };
  else if (isWatchingButterfly) eyeOffset = { x: 8, y: -4 };
  else if (isLookingAround) eyeOffset = { x: 7, y: 2 };
  else if (isDoodling) eyeOffset = { x: 2, y: 8 };
  else if (isPeeking) eyeOffset = { x: 9, y: 0 };
  else if (isAnnoyed) eyeOffset = { x: 0, y: -3 };
  else if (isSkeptical) eyeOffset = { x: 4, y: 0 };
  else if (isStartled) eyeOffset = { x: 0, y: 0 };

  // Cursor gaze overrides everything when active during idle/listening/bored
  // (i.e. she's not busy doing something else)
  if (
    cursorGaze?.active &&
    ['idle', 'bored', 'listening', 'lookingAround', 'humming'].includes(visualState)
  ) {
    eyeOffset = { x: cursorGaze.x, y: cursorGaze.y };
  }

  // Eye SHAPE varies by state — this is what gives her range
  // Returns { type, ...params }
  const eyeShape = (() => {
    if (isSleeping) return { type: 'closed-curve' };
    if (isYawning) return { type: 'closed-curve' };
    if (blink) return { type: 'closed' };
    if (isError) return { type: 'x' };
    if (isCelebrating || (isExcited && !pokeReaction)) return { type: 'star' };
    if (isThinking) return { type: 'squint' };
    if (isAnnoyed) return { type: 'flat' };
    if (isSkeptical) return { type: 'sideEye' };
    if (isStartled) return { type: 'wide' };
    if (isGiggling) return { type: 'happy-arc' };
    return { type: 'normal' };
  })();

  // Friendly screen-reader description of current activity
  const srDescription = srLabel || stateToSrLabel(visualState, mood);

  // ============== RENDER ==============
  return (
    <div
      ref={ref}
      className={`brandee-avatar state-${visualState} mood-${mood} ${compact ? 'compact' : ''}`}
      style={{ width: size, height: size }}
      onClick={onPoke ? handlePoke : undefined}
      onKeyDown={onPoke ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePoke(e); } } : undefined}
      role={onPoke ? 'button' : 'img'}
      aria-label={onPoke ? 'Brandee — press to interact' : 'Brandee'}
      tabIndex={onPoke ? 0 : undefined}
    >
      <span className="sr-only" aria-live="polite">{srDescription}</span>
      <svg viewBox="0 0 260 260" xmlns="http://www.w3.org/2000/svg" className="brandee-svg">
        <defs>
          <radialGradient id="bodyGrad" cx="35%" cy="30%" r="80%">
            <stop offset="0%" stopColor="var(--brand-primary, #F4A87C)" stopOpacity="0.55" />
            <stop offset="55%" stopColor="var(--brand-primary, #F4A87C)" />
            <stop offset="100%" stopColor="var(--brand-deep, #C46A40)" />
          </radialGradient>
          <radialGradient id="cheekGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#E85A4F" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#E85A4F" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="cheekHotGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#D44033" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#D44033" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="highlightGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="armGrad" cx="40%" cy="40%" r="80%">
            <stop offset="0%" stopColor="var(--brand-primary, #F4A87C)" />
            <stop offset="100%" stopColor="var(--brand-deep, #C46A40)" />
          </radialGradient>
          <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
            <feOffset dx="0" dy="3" result="o" />
            <feComponentTransfer><feFuncA type="linear" slope="0.22" /></feComponentTransfer>
            <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Ground shadow */}
        <ellipse
          cx="130"
          cy="238"
          rx={isCelebrating ? 50 : isSpeaking ? 64 : 70}
          ry="6"
          fill="#1A1815"
          opacity="0.12"
          className="ground-shadow"
        />

        {/* Confetti for celebrating */}
        {isCelebrating && (
          <g className="confetti">
            {[...Array(8)].map((_, i) => {
              const colors = ['#E85A4F', '#F4A87C', '#B8763A', '#88a092', '#D44033'];
              const x = 60 + (i * 18) + (i % 2 ? 5 : -5);
              return (
                <rect
                  key={i}
                  x={x}
                  y="-10"
                  width="6"
                  height="10"
                  fill={colors[i % colors.length]}
                  className={`confetti-piece c-${i}`}
                  transform={`rotate(${i * 45} ${x + 3} 0)`}
                />
              );
            })}
          </g>
        )}

        {/* Butterfly vignette */}
        {isWatchingButterfly && (
          <g className="butterfly">
            <path d="M 0 0 Q -8 -8 -14 -4 Q -8 0 -10 6 Q -4 4 0 0 Q 4 4 10 6 Q 8 0 14 -4 Q 8 -8 0 0 Z"
              fill="#E85A4F" opacity="0.85" />
            <circle cx="0" cy="0" r="1.5" fill="#1A1815" />
          </g>
        )}

        {/* Doodling — small notepad on a desk surface, pencil-stroke marks appear */}
        {isDoodling && (
          <g className="doodle-scene">
            <rect x="76" y="220" width="108" height="22" rx="2" fill="#FAF3E3" stroke="#1A1815" strokeWidth="1.2" />
            <line x1="86" y1="226" x2="174" y2="226" stroke="#C46A40" strokeWidth="0.5" opacity="0.4" />
            <line x1="86" y1="231" x2="174" y2="231" stroke="#C46A40" strokeWidth="0.5" opacity="0.4" />
            <line x1="86" y1="236" x2="174" y2="236" stroke="#C46A40" strokeWidth="0.5" opacity="0.4" />
            <path d="M 92 230 Q 100 224 110 230 T 130 230" stroke="#1A1815" strokeWidth="1.5" fill="none" strokeLinecap="round" className="doodle-stroke s-1" />
            <path d="M 138 234 Q 148 228 158 234" stroke="#1A1815" strokeWidth="1.5" fill="none" strokeLinecap="round" className="doodle-stroke s-2" />
            <circle cx="120" cy="226" r="2.5" fill="none" stroke="#1A1815" strokeWidth="1.5" className="doodle-stroke s-3" />
          </g>
        )}

        {/* Dancing — speed lines and stray music notes */}
        {isDancing && (
          <g className="dance-scene">
            <text x="50" y="100" className="note dance-note dn-1">♪</text>
            <text x="210" y="120" className="note dance-note dn-2">♫</text>
            <text x="40" y="160" className="note dance-note dn-3">♩</text>
            <text x="220" y="80" className="note dance-note dn-4">♬</text>
            <line x1="20" y1="130" x2="38" y2="130" stroke="#C46A40" strokeWidth="2" strokeLinecap="round" className="speed-line sl-1" opacity="0.5" />
            <line x1="222" y1="140" x2="240" y2="140" stroke="#C46A40" strokeWidth="2" strokeLinecap="round" className="speed-line sl-2" opacity="0.5" />
          </g>
        )}

        {/* Peeking — small glance bubble pointing toward chat (right) */}
        {isPeeking && (
          <g className="peek-scene">
            <text x="210" y="100" className="peek-arrow">→</text>
          </g>
        )}

        {/* Music notes for humming */}
        {isHumming && (
          <g className="notes">
            <text x="200" y="80" className="note note-1">♪</text>
            <text x="220" y="60" className="note note-2">♫</text>
            <text x="240" y="40" className="note note-3">♪</text>
          </g>
        )}

        {/* Sleep Z's */}
        {isSleeping && (
          <g className="sleep-zs">
            <text x="195" y="80" className="sleep-z z-1">z</text>
            <text x="215" y="60" className="sleep-z z-2">Z</text>
            <text x="235" y="40" className="sleep-z z-3">Z</text>
          </g>
        )}

        {/* LEFT ARM — only shows in specific states */}
        <g className={`arm arm-left arm-pose-${visualState}`}>
          <ellipse cx="44" cy="156" rx="14" ry="18" fill="url(#armGrad)" filter="url(#softShadow)" />
        </g>

        {/* RIGHT ARM */}
        <g className={`arm arm-right arm-pose-${visualState}`}>
          <ellipse cx="216" cy="156" rx="14" ry="18" fill="url(#armGrad)" filter="url(#softShadow)" />
        </g>

        {/* BODY group — animates with state */}
        <g className="body-group" filter="url(#softShadow)">
          {/* Body */}
          <ellipse cx="130" cy="130" rx="92" ry="96" fill="url(#bodyGrad)" />
          {/* Top highlight */}
          <ellipse cx="100" cy="80" rx="40" ry="30" fill="url(#highlightGrad)" />

          {/* Tuft on top — bends/droops/perks per mood */}
          <path
            d="M 130 35 Q 138 18 148 28 Q 142 38 130 40 Z"
            fill="var(--brand-deep, #C46A40)"
            className="tuft"
          />

          {/* Cheeks — hotter when excited/embarrassed */}
          <ellipse
            cx="78"
            cy="148"
            rx={isExcited || isCelebrating || isError ? 16 : 14}
            ry={isExcited || isCelebrating || isError ? 11 : 10}
            fill={isError || isExcited ? 'url(#cheekHotGrad)' : 'url(#cheekGrad)'}
            className="cheek cheek-l"
          />
          <ellipse
            cx="182"
            cy="148"
            rx={isExcited || isCelebrating || isError ? 16 : 14}
            ry={isExcited || isCelebrating || isError ? 11 : 10}
            fill={isError || isExcited ? 'url(#cheekHotGrad)' : 'url(#cheekGrad)'}
            className="cheek cheek-r"
          />

          {/* EYES — many shapes */}
          <Eyes
            eyeShape={eyeShape}
            offset={eyeOffset}
            isThinking={isThinking}
            blink={blink}
          />

          {/* Confused question mark above head */}
          {isConfused && (
            <text x="130" y="20" className="confused-mark" textAnchor="middle">?</text>
          )}

          {/* MOUTH */}
          <Mouth state={visualState} mood={mood} />

          {/* Sweat drop for thinking-hard / annoyed */}
          {(isThinking || isAnnoyed) && (
            <path
              d="M 200 100 Q 204 108 200 112 Q 196 108 200 100 Z"
              fill="#7BB7E0"
              className="sweat-drop"
              opacity="0.85"
            />
          )}
        </g>
      </svg>
    </div>
  );
});

export default BrandeeAvatar;

// SR-only label generator — describes Brandee's state in friendly text
function stateToSrLabel(state, mood) {
  switch (state) {
    case 'idle': return 'Brandee is idle';
    case 'bored': return 'Brandee looks a bit bored';
    case 'listening': return 'Brandee is listening';
    case 'thinking': return 'Brandee is thinking';
    case 'speaking': return mood === 'excited' ? 'Brandee is speaking, excited' : 'Brandee is speaking';
    case 'celebrating': return 'Brandee is celebrating';
    case 'error': return 'Brandee ran into an error';
    case 'sleeping': return 'Brandee is napping';
    case 'yawning': return 'Brandee is yawning';
    case 'stretching': return 'Brandee is stretching';
    case 'humming': return 'Brandee is humming';
    case 'doodling': return 'Brandee is doodling';
    case 'dancing': return 'Brandee is dancing';
    case 'butterfly': return 'Brandee is watching a butterfly';
    case 'lookingAround': return 'Brandee is looking around';
    case 'peeking': return 'Brandee is peeking toward the chat';
    case 'startled': return 'Brandee is startled';
    case 'wave': return 'Brandee is waving hello';
    case 'giggle': return 'Brandee is giggling';
    case 'annoyed': return 'Brandee is a bit annoyed';
    default: return 'Brandee';
  }
}
function Eyes({ eyeShape, offset, isThinking, blink }) {
  const lx = 98 + offset.x;
  const ly = 112 + offset.y;
  const rx = 162 + offset.x;
  const ry = 112 + offset.y;
  const trans = { transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)' };

  switch (eyeShape.type) {
    case 'closed':
      return (
        <g>
          <ellipse cx={lx} cy={ly} rx="8" ry="1" fill="#1A1815" style={trans} />
          <ellipse cx={rx} cy={ry} rx="8" ry="1" fill="#1A1815" style={trans} />
        </g>
      );
    case 'closed-curve':
      // Sleeping — gentle upward curves
      return (
        <g>
          <path d={`M ${lx - 9} ${ly} Q ${lx} ${ly - 5} ${lx + 9} ${ly}`}
            stroke="#1A1815" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d={`M ${rx - 9} ${ry} Q ${rx} ${ry - 5} ${rx + 9} ${ry}`}
            stroke="#1A1815" strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'happy-arc':
      // Giggling — upside-down U's (^^)
      return (
        <g>
          <path d={`M ${lx - 8} ${ly + 2} Q ${lx} ${ly - 8} ${lx + 8} ${ly + 2}`}
            stroke="#1A1815" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d={`M ${rx - 8} ${ry + 2} Q ${rx} ${ry - 8} ${rx + 8} ${ry + 2}`}
            stroke="#1A1815" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'star':
      // Excited / celebrating — sparkly
      return (
        <g>
          <Star cx={lx} cy={ly} />
          <Star cx={rx} cy={ry} />
        </g>
      );
    case 'x':
      // Error — X eyes
      return (
        <g stroke="#1A1815" strokeWidth="3" strokeLinecap="round">
          <line x1={lx - 7} y1={ly - 7} x2={lx + 7} y2={ly + 7} />
          <line x1={lx - 7} y1={ly + 7} x2={lx + 7} y2={ly - 7} />
          <line x1={rx - 7} y1={ry - 7} x2={rx + 7} y2={ry + 7} />
          <line x1={rx - 7} y1={ry + 7} x2={rx + 7} y2={ry - 7} />
        </g>
      );
    case 'squint':
      // Thinking — narrowed
      return (
        <g>
          <ellipse cx={lx} cy={ly} rx="7" ry="3" fill="#1A1815" style={trans} />
          <ellipse cx={rx} cy={ry} rx="7" ry="3" fill="#1A1815" style={trans} />
        </g>
      );
    case 'flat':
      // Annoyed — flat dashes
      return (
        <g stroke="#1A1815" strokeWidth="3.5" strokeLinecap="round">
          <line x1={lx - 8} y1={ly} x2={lx + 8} y2={ly} />
          <line x1={rx - 8} y1={ry} x2={rx + 8} y2={ry} />
        </g>
      );
    case 'sideEye':
      // Skeptical — pupils to one side
      return (
        <g>
          <ellipse cx={lx} cy={ly} rx="9" ry="11" fill="white" stroke="#1A1815" strokeWidth="1.5" />
          <ellipse cx={rx} cy={ry} rx="9" ry="11" fill="white" stroke="#1A1815" strokeWidth="1.5" />
          <circle cx={lx + 4} cy={ly + 1} r="4" fill="#1A1815" />
          <circle cx={rx + 4} cy={ry + 1} r="4" fill="#1A1815" />
        </g>
      );
    case 'wide':
      // Startled — eyes blown out
      return (
        <g>
          <circle cx={lx} cy={ly} r="13" fill="white" stroke="#1A1815" strokeWidth="1.5" />
          <circle cx={rx} cy={ry} r="13" fill="white" stroke="#1A1815" strokeWidth="1.5" />
          <circle cx={lx} cy={ly} r="6" fill="#1A1815" />
          <circle cx={rx} cy={ry} r="6" fill="#1A1815" />
          <circle cx={lx - 2} cy={ly - 2} r="2" fill="white" />
          <circle cx={rx - 2} cy={ry - 2} r="2" fill="white" />
        </g>
      );
    case 'normal':
    default:
      return (
        <g>
          <ellipse
            cx={lx}
            cy={ly}
            rx="8"
            ry={isThinking ? 2 : 11}
            fill="#1A1815"
            style={trans}
          />
          <ellipse
            cx={rx}
            cy={ry}
            rx="8"
            ry={isThinking ? 2 : 11}
            fill="#1A1815"
            style={trans}
          />
          {!blink && !isThinking && (
            <>
              <circle cx={lx + 2} cy={ly - 4} r="2.5" fill="white" />
              <circle cx={rx + 2} cy={ry - 4} r="2.5" fill="white" />
            </>
          )}
        </g>
      );
  }
}

// Star eye — 5-pointed
function Star({ cx, cy }) {
  const points = [];
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI * i) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? 11 : 5;
    points.push(`${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`);
  }
  return (
    <polygon
      points={points.join(' ')}
      fill="#FFD93D"
      stroke="#B8763A"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  );
}

// ============== MOUTH SUB-COMPONENT ==============
function Mouth({ state, mood }) {
  const stroke = '#1A1815';
  const sw = 3;

  // Speaking — animated open ellipse
  if (state === 'speaking') {
    return (
      <ellipse
        cx="130" cy="158" rx="11" ry="9"
        fill={stroke}
        className="mouth-speaking"
      />
    );
  }
  // Yawning — wide open vertical oval
  if (state === 'yawning') {
    return (
      <ellipse cx="130" cy="160" rx="13" ry="16" fill={stroke} className="mouth-yawn" />
    );
  }
  // Sleeping — small slack mouth
  if (state === 'sleeping') {
    return <ellipse cx="130" cy="160" rx="6" ry="3" fill={stroke} opacity="0.6" />;
  }
  // Thinking — small pursed dot
  if (state === 'thinking') {
    return <circle cx="130" cy="158" r="3.5" fill={stroke} />;
  }
  // Error / confused — squiggle
  if (state === 'error' || mood === 'confused') {
    return (
      <path
        d="M 116 158 Q 122 152 128 158 T 140 158 T 144 158"
        stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round"
      />
    );
  }
  // Celebrating — wide open grin
  if (state === 'celebrating') {
    return (
      <path
        d="M 110 152 Q 130 178 150 152 Q 130 162 110 152 Z"
        fill={stroke}
      />
    );
  }
  // Annoyed — flat with slight downturn
  if (state === 'annoyed') {
    return (
      <path
        d="M 118 162 Q 130 156 142 162"
        stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round"
      />
    );
  }
  // Bored — slack flat
  if (state === 'bored') {
    return (
      <path
        d="M 118 160 L 142 160"
        stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round"
      />
    );
  }
  // Skeptical — slight smirk
  if (mood === 'skeptical') {
    return (
      <path
        d="M 118 158 Q 130 162 140 154"
        stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round"
      />
    );
  }
  // Startled — small "o"
  if (state === 'startled') {
    return <ellipse cx="130" cy="160" rx="6" ry="7" fill={stroke} />;
  }
  // Listening — slight smile, parted
  if (state === 'listening') {
    return (
      <path
        d="M 116 156 Q 130 164 144 156"
        stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round"
      />
    );
  }
  // Giggling — wider smile
  if (state === 'giggle' || mood === 'playful') {
    return (
      <path
        d="M 114 152 Q 130 170 146 152"
        stroke={stroke} strokeWidth={sw + 0.5} fill="none" strokeLinecap="round"
      />
    );
  }
  // Excited — open smile
  if (mood === 'excited') {
    return (
      <path
        d="M 113 152 Q 130 174 147 152 Q 130 160 113 152 Z"
        fill={stroke}
      />
    );
  }
  // Default — gentle smile
  return (
    <path
      d="M 118 154 Q 130 162 142 154"
      stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round"
    />
  );
}
