# Voice Reflection Web App

Pure static web app on GitHub Pages. No build step — vanilla HTML/CSS/JS. All API calls from the browser.

## Architecture

- **Frontend**: `index.html`, `css/`, `js/` — single-page app with 6 screens (Settings → PIN → Setup → Cards → Saving → Done)
- **AI**: Gemini 2.5 Flash Lite called directly from browser (CORS supported)
- **Storage**: Notion database via Cloudflare Worker CORS proxy
- **Voice**: Web Speech API (SpeechRecognition only, no TTS), text fallback available
- **Auth**: Client-side PIN comparison (stored in localStorage)
- **Keys**: All API keys stored in localStorage, entered once via Settings screen

## File Map

```
index.html              Single-page app shell (6 screens)
css/style.css           Dark theme, mobile-first, card-based layout
js/
  app.js                Session controller — card recording, summarization, save
  questions.js          Question definitions (daily + weekly)
  speech.js             Web Speech API wrapper (STT only, continuous mode)
  ui.js                 DOM manipulation — card building, swipe nav, dot indicators
  api.js                Client-side API — Gemini summarize + title gen, Notion via Worker proxy
worker/
  notion-proxy.js       Cloudflare Worker code (user deploys once)
```

## UX Flow

1. Settings → PIN → Setup (type + date selection)
2. **Cards screen**: swipeable horizontal cards, one per question
   - Card shows question text + big record button
   - Tap to start recording, tap again to stop
   - AI summarizes the transcript via Gemini → shows summary on card
   - "Redo" button to re-record
   - "Type instead" fallback for no-mic devices
3. Final card: "Save All" button → saves summaries to Notion
4. Page titles prefixed with 🌅 (daily) or 📅 (weekly)

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
- Card-based UI: each question is a full-screen swipeable card (CSS scroll-snap)
- Voice transcript is cleaned up by Gemini `summarizeAnswer()` call per card
- Answers stored as `{ raw, summary }` — summary is used for Notion, raw is backup
- Users can freely navigate between cards (swipe, Back/Next buttons)
- Save card shows progress (X / N answered) and enables save when ≥1 answer exists
- "Redo" clears a card answer and resets to idle state
- Text fallback: textarea + "Summarize" button for no-mic devices
- Page titles are AI-generated 3-6 word summaries with emoji prefix (falls back to date-based title)
- Long answers split at sentence boundaries to avoid Notion's 2000-char block limit
- Answers backed up to sessionStorage before saving
- Notion pages limited to 100 blocks per request; overflow appended via PATCH
- Retry logic on 429/502 with exponential backoff (8s, 16s)

## Deploying Changes

Push to `github.com/jhmin0602/voice-reflection` → GitHub Pages auto-deploys.
Live at: `https://jhmin0602.github.io/voice-reflection/`
