# Brandee

Brandee is a small Branding AI desk assistant you can talk to. She has a face, opinions, and idle behaviors. 


Live: https://brandee-production.up.railway.app

## Run it locally

```bash
npm run install:all
cp server/.env.example server/.env
# add your Anthropic API key
# optionally add ELEVENLABS_API_KEY for voice
npm run dev
```

Open http://localhost:5173.

## Tech Stack

- React + Vite
- Plain CSS, no Tailwind, no UI library. Wanted full control over animation
- Express + the Anthropic SDK on the backend
- ElevenLabs for Brandee's voice (server-proxied so the key stays off the client)
- Browser Web Speech API for voice input (free, no key)
- Hand-rolled SVG character

No animation library. CSS keyframes for the idle stuff, React state for one-shot reactions. I wanted to know exactly what was happening on every frame.

## Content

Brandee is an SVG character with:

- 7 main states: idle, thinking, speaking, listening, celebrating, error, bored
- 8 idle vignettes that play randomly when you stop interacting: yawning, humming, looking around, watching a butterfly, doodling on a notepad, dancing, stretching, peeking
- Click reactions that escalate the more you poke her: startled, wave, giggle, annoyed
- Eyes that follow your cursor when it's near her
- A mood system where the AI tells her face what to show, so her expression matches what she's saying instead of just what's happening

The whole thing is a state machine. Inputs come from the chat lifecycle, your mouse, an idle director that schedules vignettes, and a mood tag the AI prepends to every response.

## Voice

You can talk to her. She talks back.

For your voice, I used the browser's native Web Speech API. On top of that I added voice activity detection. Without VAD, the browser auto-finalizes after about half a second of silence, which interrupts you mid-thought. With VAD I measure mic amplitude separately and only stop listening after you've actually been quiet for 1.5 seconds. So you can pause, breathe, think. She waits.

There's a dedicated voice mode (full-screen, big Brandee, big mic button) and a regular text mode with a mic button if you just want to dictate now and then.

## The viral pieces

Two features I added because they can create viral moments.

**Honest mode.** A toggle that swaps her system prompt to an unfiltered version. Same character, but now she can actually say a tagline sounds generic, or that "disrupt" doesn't belong in your About page. The whole UI shifts when it's on. Her eyes go skeptical, the status pill turns red, suggestion chips become roast prompts. The pitch: "Brandee said my tagline sounds like a dentist's marketing email" is a tweet people would actually write.

**Image intake.** Drag, paste, or upload any image and she gives an opinionated take. Combine with honest mode and you've got the "rate my logo" format that's already going viral on TikTok.


## What I'd build next

- Real lip sync via phoneme analysis instead of the current keyframe-based mouth animation
- "Save this take" button that captures her face + response as a PNG you can drop in a group chat
- A daily hot take she opens with on first load each day, so people come back for the joke
- Procedural variation in vignettes so the butterfly path, doodle shape, and dance moves change each time
- Memory across sessions so she remembers things you've worked on before
- More tests on the state machine. Right now only the mood parser is covered

## Layout

```
brandee/
  server/         Express, /api/chat/stream, /api/tts, /api/voice/config
  client/
    src/
      App.jsx               composition + state machine
      components/           BrandeeAvatar, BrandeeStage, ChatColumn,
                            VoiceMode, SettingsPanel
      hooks/                useIdleBehaviors, useCursorGaze, useOnboarding,
                            useTextToSpeech, useSpeechRecognition
      styles.css            all styles + animation keyframes
```

## Deploy

I deployed to Railway. Push to GitHub, connect the repo, set `ANTHROPIC_API_KEY` (and optionally `ELEVENLABS_API_KEY`), generate a public domain. The `railway.toml` in the repo handles the build config.

Don't commit `server/.env`. It's in `.gitignore` for a reason. If you do, rotate the key immediately at console.anthropic.com.


