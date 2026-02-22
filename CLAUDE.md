# Voice Reflection Web App

Static web app hosted on Netlify. No build step — vanilla HTML/CSS/JS + serverless functions.

## Architecture

- **Frontend**: `index.html`, `css/`, `js/` — single-page app with 5 screens (PIN → Setup → Chat → Saving → Done)
- **Backend**: `netlify/functions/` — 4 serverless functions (auth, chat, save-daily, save-weekly)
- **AI**: Gemini 2.0 Flash (free tier) for conversation coaching + weekly AI review generation
- **Storage**: Notion database `2e15059d-f30e-805c-8cbe-f6a5abba6b15`
- **Voice**: Web Speech API (SpeechRecognition + SpeechSynthesis), text fallback available

## File Map

```
index.html              Single-page app shell (5 screens)
css/style.css           Dark theme, mobile-first
js/
  app.js                State machine — session flow, question loop
  questions.js          Question definitions + system prompt
  speech.js             Web Speech API wrapper (STT + TTS)
  ui.js                 DOM manipulation, screen transitions
  api.js                Fetch wrappers for serverless functions
netlify/functions/
  auth.mjs              Password → HMAC token (daily rotation)
  chat.mjs              Gemini conversation proxy
  save-daily.mjs        Notion daily page creation
  save-weekly.mjs       AI review generation + Notion weekly page
```

## Environment Variables (Netlify dashboard)

- `APP_PIN` — login password
- `GEMINI_API_KEY` — from aistudio.google.com/apikey
- `NOTION_API_KEY` — Notion integration token

## Key Behaviors

- Password auth uses HMAC-SHA256 tokens that rotate daily (accepts yesterday for midnight grace)
- Conversation allows up to 4 follow-ups per question before moving on; Claude says "NEXT" when topic is explored
- Weekly page title format: `... Week of Mon DD` (auto-computes Monday from any date in that week)
- Daily page title format: `... Mon DD`
- Long answers split at sentence boundaries to avoid Notion's 2000-char block limit
- Answers backed up to sessionStorage before saving
- Notion pages limited to 100 blocks per request; overflow appended via PATCH

## Deploying Changes

Push to `github.com/jhmin0602/voice-reflection` — Netlify auto-deploys on push.
To change password: update `APP_PIN` in Netlify env vars → Trigger deploy.
