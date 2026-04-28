# Brandee — Animated AI Desk Assistant

Brandee is a small, expressive character who lives in your sidebar. She's an AI brand & creative companion — but more importantly, she's a *desk assistant*: she has moods, idle behaviors, and a personality you actually notice. Think Clippy, if Clippy had taste, charm, and 25 years of design lessons.

This is v2.5: the v1 chat prototype rebuilt as a character, then polished with the kinds of details that make her feel *present* — eyes that follow your cursor, an onboarding wave when she meets you for the first time, a settings panel where you can rename her or change her color, streaming responses so she speaks as she thinks, and real tests so the personality machinery doesn't regress.

## Tech stack

**Frontend**
- React 18 + Vite
- Pure CSS with CSS variables (no Tailwind, no UI library)
- SVG character with state-driven animations
- Custom React hooks: `useIdleBehaviors` (vignette director), `useCursorGaze` (eye tracking), `useOnboarding` (first-run experience)
- DM Sans + Fraunces (Google Fonts)

**Backend**
- Node.js + Express (ESM)
- `@anthropic-ai/sdk` for AI calls
- `express-rate-limit` for abuse protection
- Mood-tag parser — extracts an emotion hint from each AI response so Brandee's face can react to *what she's saying*
- Server-Sent Events (SSE) streaming endpoint at `/api/chat/stream`
- API key stays server-side, never exposed to the browser

**Tests**
- Node's built-in test runner (no Vitest/Jest dependency)
- 14 tests covering the mood parser and streaming extractor
- Run with `npm test --prefix server`

## Setup

```bash
npm run install:all
cp server/.env.example server/.env
# add your key from https://console.anthropic.com/
npm run dev
```

Open http://localhost:5173. Chat with her. Then leave the tab alone for 30 seconds and watch what happens.

To run the tests: `cd server && npm test`

## How the AI / chat works

1. The user sends a message → React appends to local conversation state and POSTs to `/api/chat/stream`.
2. Vite proxies `/api/*` to the Express server in dev. In production, Express serves both API and built client from one process.
3. The server validates the payload (length caps, role shape, rate limit at 30 req/min) and forwards to the Anthropic API with Brandee's system prompt.
4. **Brandee returns a mood tag with every response.** The system prompt tells her to prepend a JSON metadata line (`{"mood":"excited"}`) to every reply. The streaming extractor pulls it off as soon as it's identified, hides it from the user, and emits an SSE `mood` event before any text chunks. This means her face changes *before* she starts talking.
5. **Streaming.** Server forwards Anthropic's text deltas as SSE `chunk` events. The client appends each chunk to the latest assistant message and Brandee enters the speaking state at the first chunk. No artificial typewriter delay — her speaking duration tracks the actual stream rate.
6. The frontend updates her face based on mood — sparkly star eyes for `excited`, side-eye for `skeptical`, full confetti for `celebrating`.
7. Conversation history is preserved client-side and re-sent each request, so she has full context.

The mood system means Brandee doesn't just go `idle → thinking → speaking → idle`. Her *expression* during speaking varies based on what she's actually saying. If she pushes back on a bad idea, she gets the skeptical squint. If she likes your concept, her eyes turn into stars.

## How animation states are handled

A single React state machine drives the avatar. Three layers stack on top of each other:

**1. Primary state** (`agentState`):
| State | Trigger | Visual |
|---|---|---|
| `idle` | Default | Floating, blinks, eyes drift naturally — and follow your cursor when it's near |
| `bored` | Idle for 35+ seconds | Body slumps, tuft droops, flat mouth |
| `listening` | User typing in input | Body leans forward, eyes look down toward input |
| `thinking` | API request in flight | Body wobbles, squinted eyes look up, sweat drop |
| `speaking` | Response streaming in | Body bobs, mouth opens/closes |
| `error` | Request failed | Body shakes, X eyes, facepalm arm, squiggle mouth |
| `celebrating` | User shipped something / Brandee's mood says so | Big jump, arms thrown up, confetti, star eyes |

**2. Mood overlay** (`agentMood`, from AI response): `neutral`, `excited`, `confused`, `skeptical`, `playful`, `celebrating`. Modifies eyes, mouth, cheeks, tuft on top of the primary state.

**3. Idle vignettes** (`useIdleBehaviors` hook): When Brandee is `idle`, a director schedules random short performances at increasing frequency the longer she's ignored:
- **Looks around** — head and eyes track to one side
- **Hums** — sways gently, music notes float up
- **Stretches** — body extends vertically, arms reach up
- **Watches a butterfly** — a butterfly flutters across, eyes follow
- **Doodles** — leans down to a notepad and animated pencil strokes appear (one of the new v2.5 vignettes)
- **Dances** — shoulder shimmy with stray notes (rare upbeat surprise, ~5% chance)
- **Yawns** — covers her mouth with one arm, then drifts into…
- **Sleeps** — sits down, breathes slowly, Z's float up
- **Peeks** — when chat has unread messages, she glances toward it with an arrow indicator

**4. Click reactions** (escalating): Click her once → startled (wide eyes, arms up). Twice → wave. Three times → giggle. Four+ → annoyed/crossed arms. Resets after 4s of being left alone.

**5. Cursor-aware glance** *(new in v2.5)*: When your cursor enters a 360px radius around her, her eyes track its position. Disabled during busy states (thinking, speaking, dancing, etc.) so it doesn't fight other animations. Subtle but you feel it — she registers your presence.

Animations are split between CSS keyframes (idle motions like breathing, mouth-talk) and React-driven SVG attribute changes (one-shot reactions, state-driven shape changes, cursor-tracked eye offsets). No animation libraries — everything is hand-built SVG + CSS, ~178KB JS / 56KB gzipped.

## How I designed Brandee's personality

The brief said *"think Microsoft Clippy, but actually good."* That framing was helpful because it made me identify what made Clippy memorable (visible character, moods, surprise) and what made him *annoying* (interruption, condescension, no off-switch).

**Voice.** I wrote a system prompt that bans the standard AI tells — no "Great question!", no "I'd be happy to help!", no "As an AI...". She sounds like a sharp friend who works in branding: short, opinionated, dry. She uses 1–3 sentences most of the time. She has takes. The biggest single shift from v1 was adding the **mood metadata system** — Brandee tags every reply with her emotional state, which means her face actually reacts to what she's saying.

**Body.** She has a distinct silhouette (round body, tuft on top) so she's recognizable in shadow. She has small arms that emerge for specific moments — waving, covering her mouth in a yawn, throwing them up to celebrate, leaning down to doodle, shimmying when she dances. The arms are crucial; they're 80% of why she reads as a *character* and not just an animated icon.

**Inner life.** This is the marketability piece. The idle director is what makes her share-able. People will screenshot her napping. They'll record her watching the butterfly or doodling on a notepad. They'll tweet "look what Brandee just did" because *she does things you didn't ask her to do*. Predictability isn't memorable; surprise is.

**Presence.** Cursor tracking and the onboarding wave both serve the same goal: make her feel *aware* of you. Not in a creepy way, but in a "she knows you're here" way. The first time you load the app, she waves at you and points to the chat button. After that she just exists alongside your work, occasionally glancing your direction.

**Restraint.** I deliberately did *not* give her speech bubbles that pop up unprompted, or audio, or push notifications. Clippy's biggest sin was interrupting. Brandee performs only when you're looking at her — she doesn't fight for your attention, she rewards it. The settings panel makes this even clearer: if her vignettes annoy you, you can mute them.

## What I improved in this round

**Compared to v1** (the original chat prototype):
- Moved her into a real workspace — mock SaaS shell with sidebar nav, KPI cards, dedicated "shelf" where she lives
- Gave her arms — 80% of her character expression
- Massive expression range (9 eye types, 12+ mouth shapes vs v1's 1 and 4)
- 4 new states + 5 idle vignettes + 4 click reactions
- Mood metadata system so face reacts to content, not just lifecycle
- Idle director that escalates from quiet → vignettes → bored → yawn → nap
- Tab focus awareness, mobile layout, `prefers-reduced-motion`

**New in v2.5** (the polish round):
- **Cursor-aware glance** — `useCursorGaze` hook computes pointer offset relative to her wrapper element; her eyes track within a 360px radius. Disabled during busy states.
- **Onboarding wave** — first-load wave + animated bubble/arrow pointing at the chat button. localStorage flag so it never repeats. Auto-dismisses after 9s or any interaction.
- **Three new vignettes** — *doodling* (leans to a notepad with animated pencil strokes), *dancing* (shoulder shimmy with stray notes, rare upbeat surprise), *peeking* (glances toward chat when there's an unread message).
- **Streaming responses** — new `/api/chat/stream` endpoint emits SSE events (`mood`, `chunk`, `done`, `error`). Mood arrives first so Brandee's face changes before she starts talking. Client uses native `ReadableStream` — no extra dependency.
- **Settings panel** — small gear in the user row. Rename her, swap her color (5 themes via CSS variable swap on the SVG gradient stops), toggle idle behaviors, force-enable reduce-motion. Persisted to localStorage.
- **Tests** — Node's built-in test runner. 14 tests covering the mood parser and streaming extractor (including: split-across-chunks header, malformed JSON, unknown moods, give-up-after-N-bytes). `npm test --prefix server`.
- **Accessibility completion** — `sr-only` live region narrating Brandee's state ("Brandee is thinking", "Brandee is napping"); chat panel has focus trap, ESC to close, ARIA labels everywhere; Cmd/Ctrl+K shortcut to open chat; `aria-keyshortcuts` exposed; visible focus rings using `:focus-visible`.
- **Activity awareness** — moving the cursor near her counts as activity, resetting the idle clock the same way clicking would.

## What I'd still improve with more time

1. **Voice output with lip-sync.** Drive the mouth animation off audio amplitude (Web Audio analyser node) for proper lip-sync. ElevenLabs has a warm, slightly playful voice library that would fit her.
2. **Procedural variation in vignettes.** Currently each vignette plays the same way. The butterfly path could be randomized; the doodle could draw different shapes; the dance could pick from several routines.
3. **More reactive vignettes.** She could glance when you scroll past her, peek at the cursor when it idles for a moment, get visibly excited when you hover the "+ New Campaign" button. Tiny moments of attention that make her feel present.
4. **Memory of user's style.** Over time, she could note things ("you tend to brief in 3-word taglines") and reference them lightly. This is the difference between a chatbot and an assistant. Requires a small persistence layer + summarization on the server.
5. **Real evals on personality.** Write 30 tricky prompts, grade outputs against the voice rules, catch regressions when tweaking the system prompt. Especially valuable as the prompt grows.
6. **More test coverage.** Right now tests cover the parser. The state machine (vignette scheduling, click escalation, mood transitions) deserves coverage too — that's where bugs hide.
7. **Stream cancellation UX.** If you start a long response and want to cut her off, there's no UI for it. Should be a small "stop" button that aborts the fetch (the server already handles client disconnect).
8. **Internationalization.** Right now her voice is English-only. The system prompt would need adjustment per locale; the mood tags should still work universally.
9. **Telemetry hooks.** Anonymized counters for which vignettes play, which states get clicked, where users disengage — would inform what to add or cut.
10. **A real "+ New Campaign" flow.** Right now clicking it just triggers Brandee's celebration. Even a stub modal would make the demo feel more like a product.

## Project structure

```
brandee/
├── package.json                  # root scripts (concurrently runs both)
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
    ├── vite.config.js            # proxies /api → :3001 in dev
    ├── package.json
    └── src/
        ├── main.jsx
        ├── App.jsx               # composition + state machine + streaming consumer
        ├── styles.css            # all styles + animation keyframes (~1500 lines)
        ├── components/
        │   ├── BrandeeAvatar.jsx # the character (forwardRef, ~640 lines)
        │   ├── AppShell.jsx      # mock SaaS sidebar with Brandee's home
        │   ├── ChatPanel.jsx     # slide-out chat, focus trap, ESC, ARIA live
        │   ├── MockDashboard.jsx # fake brand-platform main content
        │   └── SettingsPanel.jsx # name, color, idle, reduce-motion
        └── hooks/
            ├── useIdleBehaviors.js   # vignette director + peeking
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
- Keyboard shortcut `Cmd/Ctrl+K` opens/closes chat.
- Settings are stored in `localStorage`. Clearing it resets her to "Peach Brandee" and re-triggers the onboarding moment.
