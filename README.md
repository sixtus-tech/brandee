# Brandee — Animated AI Desk Assistant

Brandee is a small, expressive character. She's an AI brand & creative companion — but more importantly, she's a *desk assistant*: she has moods, idle behaviors, and a personality you actually notice. Think Clippy, if Clippy had taste, charm, and 25 years of design lessons.

This is v3. The layout is calm and Brandee-first: she takes the left half of the screen, the chat lives on the right, and there's nothing else competing for your attention. Earlier versions tried to surround her with a full mock SaaS dashboard (KPI cards, brand pulse charts, sidebar nav). That was the wrong instinct — it crowded her out and made the demo feel like a product screenshot instead of a character study. v3 strips that all back and lets the character lead.

All of the personality machinery from earlier rounds is intact: 7+ animated states, 7 random idle vignettes, click-escalation reactions, cursor-tracking eyes, mood metadata that reacts to what she's *saying*, streaming responses, an onboarding wave, and a settings panel where you can rename her or change her color.

## Tech stack

**Frontend**
- React 18 + Vite
- Pure CSS with CSS variables (no Tailwind, no UI library)
- SVG character with state-driven animations (no animation library)
- Custom React hooks: `useIdleBehaviors` (vignette director), `useCursorGaze` (eye tracking), `useOnboarding` (first-run experience)
- DM Sans + Fraunces (Google Fonts)

**Backend**
- Node.js + Express (ESM)
- `@anthropic-ai/sdk` for AI calls
- `express-rate-limit` for abuse protection
- Mood-tag parser — extracts an emotion hint from each AI response so Brandee's face reacts to *what she's saying*, not just the request lifecycle
- Server-Sent Events (SSE) streaming endpoint at `/api/chat/stream`
- API key stays server-side, never exposed to the browser

**Tests**
- Node's built-in test runner (no Vitest/Jest)
- 14 tests covering the mood parser and streaming extractor
- `npm test --prefix server`

## Setup

```bash
npm run install:all
cp server/.env.example server/.env
# add your key from https://console.anthropic.com/
npm run dev
```

Open http://localhost:5173. Chat with her. Then leave the tab alone for 30 seconds and watch what happens.

## Layout

The page is intentionally minimal:

```
┌──────────────────────────────────────────────────────────────────┐
│ • Brandee                  BRAND & CREATIVE COMPANION   ⚙        │   ← header
├──────────────────────────────┬───────────────────────────────────┤
│                              │                                   │
│                              │   [chat history fills here as     │
│         ┌────────┐           │    messages arrive — empty on     │
│         │        │           │    first load]                    │
│         │ BRANDEE│           │                                   │
│         │        │           │                                   │
│         └────────┘           │                                   │
│                              │                                   │
│           ● IDLE             │   ╭──────────────────────────╮    │
│                              │   │ Help me name a coffee... │    │  ← suggestions
│        Hi, I'm Brandee.      │   ╰──────────────────────────╯    │
│   Naming, copy, taste calls. │   ╭──────────────────────────╮    │
│                              │   │ My tagline feels...      │    │
│                              │   ╰──────────────────────────╯    │
│                              │   ┌─────────────────────────┐ ▶  │  ← input
└──────────────────────────────┴────└─────────────────────────┘────┘
```

When messages arrive, the chat-history area fills from the top and the suggestion chips disappear. The "Hi, I'm Brandee" welcome stays in place but fades slightly so the active conversation gets visual priority.

The status pill below Brandee changes label in real time: `IDLE`, `LISTENING`, `THINKING`, `SPEAKING`, `EXCITED`, `SKEPTICAL`, `NAPPING`, `DOODLING`, `DANCING`, `STARTLED`, `NOT AMUSED`, etc. — it's both an accessibility cue and a small humanizing detail.

## How the AI / chat works

1. The user sends a message → React appends to local conversation state and POSTs to `/api/chat/stream`.
2. Vite proxies `/api/*` to the Express server in dev. In production, Express serves both API and built client from one process.
3. Server validates payload (length caps, role shape, rate limit at 30 req/min) and forwards to the Anthropic API with Brandee's system prompt.
4. **Brandee returns a mood tag with every response.** The system prompt tells her to prepend a JSON metadata line (`{"mood":"excited"}`) to every reply. The streaming extractor pulls it off as soon as it identifies it, hides it from the user, and emits an SSE `mood` event before any text chunks. Her face changes *before* she starts talking.
5. **Streaming.** Server forwards Anthropic's text deltas as SSE `chunk` events. The client appends each chunk to the latest assistant message and Brandee enters the speaking state at the first chunk. No artificial typewriter delay — her speaking duration tracks the actual stream rate.
6. The frontend updates her face based on mood — sparkly star eyes for `excited`, side-eye for `skeptical`, full confetti for `celebrating`.
7. Conversation history is preserved client-side and re-sent each request, so she has full context.

## How animation states are handled

A single React state machine drives the avatar. Three layers stack on top of each other:

**1. Primary state** (`agentState`):
| State | Trigger | Visual |
|---|---|---|
| `idle` | Default | Floats, blinks, eyes drift naturally — and follow your cursor when it's near |
| `bored` | Idle for 35+ seconds | Body slumps, tuft droops, flat mouth |
| `listening` | User typing in input | Body leans forward, eyes look down toward input |
| `thinking` | API request in flight | Body wobbles, squinted eyes look up, sweat drop |
| `speaking` | Response streaming in | Body bobs, mouth opens/closes |
| `error` | Request failed | Body shakes, X eyes, facepalm arm, squiggle mouth |
| `celebrating` | Brandee's mood says so | Big jump, arms thrown up, confetti, star eyes |

**2. Mood overlay** (from AI response): `neutral`, `excited`, `confused`, `skeptical`, `playful`, `celebrating`. Modifies eyes, mouth, cheeks, tuft on top of the primary state.

**3. Idle vignettes** (`useIdleBehaviors` hook): When she's idle, a director schedules random short performances at increasing frequency the longer she's ignored:
- **Looks around** — head and eyes track to one side
- **Hums** — sways gently, music notes float up
- **Stretches** — body extends vertically, arms reach up
- **Watches a butterfly** — a butterfly flutters across, eyes follow
- **Doodles** — leans down to a notepad, animated pencil strokes appear
- **Dances** — shoulder shimmy with floating notes (rare, ~5% chance)
- **Yawns** — covers her mouth with one arm, then drifts into…
- **Sleeps** — sits down, breathes slowly, Z's float up

**4. Click reactions** (escalating): Click her once → startled (wide eyes, arms up). Twice → wave. Three times → giggle. Four+ → annoyed/crossed arms. Resets after 4s of being left alone.

**5. Cursor-aware glance**: When your cursor enters a 360px radius around her, her eyes track its position. Disabled during busy states (thinking, speaking, dancing, etc.) so it doesn't fight other animations.

Animations are split between CSS keyframes (idle motions like breathing, mouth-talk) and React-driven SVG attribute changes (one-shot reactions, state-driven shape changes, cursor-tracked eye offsets). No animation libraries — everything is hand-built SVG + CSS, ~172KB JS / 55KB gzipped.

## How I designed Brandee's personality

The brief said *"think Microsoft Clippy, but actually good."* That framing made me identify what made Clippy memorable (visible character, moods, surprise) and what made him *annoying* (interruption, condescension, no off-switch).

**Voice.** I wrote a system prompt that bans the standard AI tells — no "Great question!", no "I'd be happy to help!", no "As an AI...". She sounds like a sharp friend who works in branding: short, opinionated, dry. 1–3 sentences most of the time. She has takes. The biggest single shift from a generic chatbot was adding the **mood metadata system** — Brandee tags every reply with her emotional state, so her face actually reacts to what she's saying.

**Body.** She has a distinct silhouette (round body, tuft on top) so she's recognizable at a glance. Small arms emerge for specific moments — waving, covering her mouth in a yawn, throwing them up to celebrate, leaning down to doodle, shimmying when she dances. The arms are 80% of why she reads as a *character* and not just an animated icon.

**Inner life.** This is the marketability piece. The idle director is what makes her share-able. People will screenshot her napping. They'll record her watching the butterfly or doodling on a notepad. They'll send "look what Brandee just did" to their team because *she does things you didn't ask her to do*. Predictability isn't memorable; surprise is.

**Presence.** Cursor tracking and the onboarding wave both serve the same goal: make her feel *aware* of you. Not in a creepy way, but in a "she knows you're here" way. The first time you load the app, she waves at you and points to the chat input. After that she just exists alongside your work, occasionally glancing your direction.

**Restraint.** I deliberately did *not* give her speech bubbles that pop up unprompted, audio, or push notifications. Clippy's biggest sin was interrupting. Brandee performs only when you're looking at her — she doesn't fight for your attention, she rewards it. The settings panel makes this explicit: if her vignettes annoy you, mute them.

**Whitespace.** v3's biggest visual change. The earlier rounds tried to embed her inside a busy mock SaaS dashboard. That was wrong — it crowded her out. The Brandee aesthetic is calm, premium, character-led. She gets the left half of the screen and lots of room to *be*.

## What went into v3

**Originally built (v1 → v2):**
- Moved her from a centered demo into a real-feeling layout
- Gave her arms — 80% of her character expression
- Massive expression range (9 eye types, 12+ mouth shapes vs the original 1 and 4)
- 4 new states + 5 idle vignettes + 4 click reactions
- Mood metadata system so face reacts to content, not just lifecycle
- Idle director that escalates from quiet → vignettes → bored → yawn → nap
- Tab focus awareness, mobile layout, `prefers-reduced-motion`

**Polished (v2.5):**
- Cursor-aware glance — `useCursorGaze` hook computes pointer offset; her eyes track within a 360px radius
- Onboarding wave + animated pointer on first load (localStorage flag, never repeats)
- Three new vignettes — *doodling*, *dancing*, *peeking*
- Streaming responses via SSE so she speaks as she thinks
- Settings panel — name, 5 colors, idle on/off, reduce-motion toggle
- 14 tests for the mood parser + streaming extractor
- Accessibility — sr-only live region, focus trap in chat, ESC, Cmd/Ctrl+K shortcut, ARIA labels

**Layout rebuild (v3):**
- Stripped the mock SaaS dashboard (KPIs, charts, sidebar nav, hint card) — all that visual noise was crowding Brandee out
- Two-column layout: Brandee dominant on the left, chat on the right
- Header is just logo + tagline + settings gear
- Status pill below Brandee shows her current state in real-time text — both an accessibility cue and a small character detail
- Chat is now always-visible (not a slide-out panel) — feels more like a conversation, less like opening a tool
- Settings panel anchors to the gear icon in the header
- Onboarding pointer points at the chat input area
- Mobile: stacks vertically with Brandee on top, chat below

**Viral features (v3.5):**
- **Honest mode** ("Roast mode") — toggleable pill in the chat. Swaps Brandee's system prompt to an unfiltered version: still warm, still affectionate, but allowed to call out clichés, generic startup language, and weak ideas with specific, quotable feedback. The whole UI shifts when on: skeptical side-eye on the avatar, red status pill reading `HONEST MODE`, suggestion chips become roast-y, input placeholder changes to "Drop something for Brandee to roast…". This is the share-able moment — users will screenshot her takedowns for their group chats.
- **Drag / paste / upload an image** — drop a logo, screenshot, mockup, or moodboard onto the app and Brandee will look at it and give a short opinionated take. Three intake methods: drag-and-drop (with a full-screen "Drop it here" overlay), paste from clipboard (Cmd/Ctrl+V), or click the attach icon in the input. Combine with honest mode for maximum effect — "rate my logo" is already a viral TikTok format. Server validates type (JPEG/PNG/WebP/GIF), size (5MB cap), and shape; the Anthropic API does the actual vision.

## What I'd still improve with more time

1. **Voice output with lip-sync.** Drive the mouth animation off audio amplitude (Web Audio analyser node). ElevenLabs has a warm, slightly playful voice library that would fit her.
2. **Procedural variation in vignettes.** Currently each plays the same way. The butterfly path could randomize; the doodle could draw different shapes; the dance could pick from several routines.
3. **More reactive vignettes.** She could glance when you scroll, peek when the cursor idles, get excited when you hover certain UI. Tiny moments of attention.
4. **Memory of user's style.** Over time, she could note things ("you tend to brief in 3-word taglines") and reference them lightly. Requires a small persistence layer + summarization on the server.
5. **Real evals on personality.** 30 tricky prompts, scored against the voice rules, to catch regressions when the system prompt changes.
6. **More test coverage.** Right now tests cover the parser. The state machine (vignette scheduling, click escalation, mood transitions) deserves coverage too.
7. **Stream cancellation UI.** Cut her off mid-response with a stop button. Server already handles client disconnect.
8. **Internationalization.** System prompt would need adjustment per locale; the mood tag system is locale-agnostic so no client changes needed.
9. **Telemetry hooks.** Anonymized counters for which vignettes play, which states get clicked, where users disengage.
10. **An actual "ship something" flow.** Right now there's nothing for her to celebrate other than mood-tagged responses. A "+ New brief" button that triggers a small celebration would tie the demo together.

## Project structure

```
brandee/
├── package.json                  # root scripts
├── railway.toml                  # Railway deploy config
├── .gitignore
├── server/
│   ├── server.js                 # Express API + streaming endpoint
│   ├── parseMoodHeader.js        # mood extractor (testable module)
│   ├── parseMoodHeader.test.js   # 14 tests, run with `npm test`
│   ├── package.json
│   └── .env.example
└── client/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── main.jsx
        ├── App.jsx               # composition + state machine + streaming consumer
        ├── styles.css            # all styles + animation keyframes (~1k lines)
        ├── components/
        │   ├── BrandeeAvatar.jsx # the character (forwardRef, all the SVG + face logic)
        │   ├── BrandeeStage.jsx  # left column: avatar + status pill + welcome
        │   ├── ChatColumn.jsx    # right column: history + suggestions + input
        │   └── SettingsPanel.jsx # name, color, idle, reduce-motion popover
        └── hooks/
            ├── useIdleBehaviors.js   # vignette director
            ├── useCursorGaze.js      # pointer-tracking eye offset
            └── useOnboarding.jsx     # first-run wave + pointer
```

## Deployment

The server serves the built client from `client/dist` if it exists, so the whole app deploys as a single Node process.

**Railway** (recommended): push to GitHub, connect repo, set `ANTHROPIC_API_KEY`, generate domain. The included `railway.toml` handles the rest.

**Single-process production**:
```bash
npm run build      # builds client to client/dist/
npm start          # server serves API + static files on $PORT
```

## Notes

- **Never commit `server/.env`** — it's in `.gitignore`. If you push a key to a public repo, rotate it immediately at console.anthropic.com.
- The frontend never sees the API key. It only knows how to talk to your local `/api/chat/stream` (or `/api/chat` non-streaming fallback) endpoint.
- Default model is `claude-sonnet-4-5`. Switch via `ANTHROPIC_MODEL` env var: `claude-haiku-4-5` for cheaper/faster, `claude-opus-4-7` for max quality.
- Keyboard shortcut `Cmd/Ctrl+K` focuses the chat input. (Chat is always visible, so there's no panel to open.)
- Settings are stored in `localStorage`. Clearing it resets her to "Peach Brandee" and re-triggers the onboarding moment.
