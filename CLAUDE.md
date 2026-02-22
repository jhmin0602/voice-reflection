# Voice Reflection Web App

Pure static web app on GitHub Pages. No build step — vanilla HTML/CSS/JS. All API calls from the browser.

## Architecture

- **Frontend**: `index.html`, `css/`, `js/` — single-page app with 6 screens (Settings → PIN → Setup → Chat → Saving → Done)
- **AI**: Gemini 2.5 Flash Lite called directly from browser (CORS supported)
- **Storage**: Notion database via Cloudflare Worker CORS proxy
- **Voice**: Web Speech API (SpeechRecognition + SpeechSynthesis), text fallback available
- **Auth**: Client-side PIN comparison (stored in localStorage)
- **Keys**: All API keys stored in localStorage, entered once via Settings screen

## File Map

```
index.html              Single-page app shell (6 screens)
css/style.css           Dark theme, mobile-first
js/
  app.js                State machine — session flow, question loop, interrupt/skip/end
  questions.js          Question definitions + system prompt
  speech.js             Web Speech API wrapper (STT continuous + TTS at 1.2x)
  ui.js                 DOM manipulation, screen transitions, settings form
  api.js                Client-side API — direct Gemini + Notion via Worker proxy
worker/
  notion-proxy.js       Cloudflare Worker code (user deploys once)
```

## localStorage Keys

- `app_pin` — login password
- `gemini_api_key` — from aistudio.google.com/apikey
- `notion_api_key` — Notion integration token
- `worker_url` — Cloudflare Worker URL (e.g., `https://notion-proxy.xxx.workers.dev`)
- `notion_db_id` — Notion database ID (default: `2e15059d-f30e-805c-8cbe-f6a5abba6b15`)

## Key Behaviors

- First visit shows Settings screen to enter all keys (stored in localStorage)
- PIN auth is simple string comparison — no HMAC, no tokens, no expiry
- Gemini API called directly from browser (model: `gemini-2.5-flash-lite`, 15 RPM free tier)
- Notion API called via Cloudflare Worker CORS proxy (~20 lines, 100K req/day free)
- Conversation allows up to 2 follow-ups per question before auto-advancing; AI says "NEXT" when done
- System prompt is concise: AI gives 1-2 sentence responses, moves on quickly
- User can interrupt AI speech by tapping mic (stops TTS, starts listening)
- Speech recognition runs in continuous mode — user taps mic to stop recording
- "Next" button skips to the next question; becomes "Finish" on last question
- "End" button in header saves whatever answers exist and finishes session
- Page titles are AI-generated 3-6 word summaries (falls back to date-based title)
- TTS rate is 1.2x for faster playback
- Long answers split at sentence boundaries to avoid Notion's 2000-char block limit
- Answers backed up to sessionStorage before saving
- Notion pages limited to 100 blocks per request; overflow appended via PATCH
- Retry logic on 429/502 with exponential backoff (8s, 16s)

## Deploying Changes

Push to `github.com/jhmin0602/voice-reflection` → GitHub Pages auto-deploys.
Live at: `https://jhmin0602.github.io/voice-reflection/`
