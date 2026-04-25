# Brandee, Animated AI Chat Agent

A web app where you chat with **Brandee**, an animated AI brand & creative companion. 



## Quick start

You'll need Node.js 18+ and an Anthropic API key.

```bash
# 1. Install root, server,and client
npm run install:all

# 2. Set up the server's environment
create .env file


# 3. Run dev mode (starts server on :3001 and client on :5173)
npm run dev


Open http://localhost:5173  and you should see Brandee.

## Project structure

```
brandee/
├── package.json              # root scripts (concurrently runs both)
├── .gitignore
├── server/
│   ├── server.js             # Express API, proxies AI calls
│   ├── package.json
│   └── .env         
└── client/
    ├── index.html
    ├── vite.config.js        # proxies /api → :3001 in dev
    ├── package.json
    └── src/
        ├── main.jsx
        ├── App.jsx           # chat logic + state machine
        ├── BrandeeAvatar.jsx # SVG character + animations
        └── styles.css


## Tech stack

**Frontend**
- React 18 and Vite
- Pure CSS with CSS variables 
- SVG character with state-driven CSS animations 
- DM Sans and Fraunces (Google Fonts)

**Backend**
- Node.js + Express (ESM)
- `@anthropic-ai/sdk` for AI calls
- `express-rate-limit` for basic abuse protection
- API key stays server-side

## How the AI agent works

1. **User sends a message** frontend appends to local conversation state and POSTs the full message history to `/api/chat`.
2. **Vite proxies** `/api/*` to the Express server at `localhost:3001` in dev. In production, Express serves both the API and the built client.
3. **Server validates** the payload (length caps, role shape, rate limiting at 30 req/min) and forwards to the Anthropic API with Brandee's system prompt.
4. **Server returns the text** to the client. The frontend renders it via a typewriter effect, which doubles as the timing source for the "speaking" animation state.
5. **Conversation history is preserved** client side and re-sent each request, so Brandee has full context for the session.

The system prompt defines Brandee's personality: warm, opinionated, concise, anti corporate speak. She's tuned for short, conversational answers rather than essays.

## How animation states are handled

A single `agentState` value (`'idle'  'listening'  'thinking' 'speaking'`) drives every visual element of the avatar.


( `idle` ) No activity  Gentle floating, occasional blinks, eyes drift naturally 
( `listening` ) User has typed text in the input  Body leans forward, pulse rings, eyes look down toward input 
( `thinking` ) Request is in flight Body wobbles, eyes squint upward, three dots fade in above her head 
( `speaking` ) Response is typewriting in Body bobs, mouth opens/closes rhythmically 

The **speaking** state's duration is driven by the typewriter, when the last character renders, state flips back to `idle`. The animation is tied to actual output rather than an arbitrary timeout.

The avatar is a single inline SVG. Body, eyes, mouth, and accessories are separate `<g>` groups so each can animate independently. State-specific keyframes are toggled by a `state-{name}` class on the wrapper. Eye tracking is React-driven state computes the `cx/cy` offset.

## Deployment

The server is set up to serve the built client from `client/dist` if it exists, so you can deploy the whole thing as a single Node process:

```bash
npm run build        # builds client to client/dist/
npm start            # server serves API + static files
```

Alternative: deploy frontend to Vercel/Netlify and backend separately to Render/Fly/Railway. Set `CLIENT_ORIGIN` on the server to your frontend's URL so CORS allows it.

## What I'd improve with more time

1. **Streaming responses.** Right now the server returns the full response, then the client typewriters it. Real SSE streaming would feel snappier and let the speaking state start the moment the first token arrives.
2. **Voice output.** Wire up Web Speech API or ElevenLabs so Brandee actually talks. Drive the mouth animation off the audio amplitude for proper lip sync.
3. **Conversation persistence.** Currently session only. Add IndexedDB or a Postgres + auth layer to keep history across visits.
4. **Real evals on personality.** The system prompt is good but unverified. I'd write a small eval suite (10–20 tricky prompts) and grade outputs against the voice rules to catch regressions when tweaking.
5. **Accessibility audit.** Keyboard nav works, but I'd add proper ARIA live regions for streaming responses, `prefers-reduced-motion` handling for the avatar animations, and screen reader testing.
6. **Expression range.** Right now four states. With more time: emotional reactions (delight, surprise, "well actually" smirk) triggered by lightweight sentiment analysis on her own outputs.
7. **Tests.** Vitest for the frontend (state machine logic, message rendering), supertest for the backend (validation, rate limits).
8. **Deployment scripting.** Dockerfile, GitHub Actions for CI, env var management via something like Doppler.




