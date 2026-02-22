# Voice Reflection

Voice-driven daily and weekly reflection web app. An AI coach asks structured questions, probes deeper with follow-ups, then saves everything to Notion.

Built for Android Chrome — works from a phone with no local server needed.

## Setup

### 1. Deploy the Cloudflare Worker (one-time)

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages → Create
2. Paste the code from `worker/notion-proxy.js` and deploy
3. Copy the worker URL (e.g., `https://notion-proxy.xxx.workers.dev`)

### 2. Enable GitHub Pages

1. Push this repo to GitHub
2. Settings → Pages → Source: Deploy from branch → Branch: master, folder: / (root)
3. Site will be live at `https://<user>.github.io/voice-reflection/`

### 3. First-time app setup

On first visit, the app shows a Settings screen. Enter:

| Field | Source |
|-------|--------|
| PIN | Your chosen password |
| Gemini API Key | [Google AI Studio](https://aistudio.google.com/apikey) (free) |
| Notion API Key | Your Notion integration token |
| Cloudflare Worker URL | From step 1 above |
| Notion Database ID | Pre-filled with default |

All keys are stored in your browser's localStorage — never sent to any server except their respective APIs.

## How It Works

1. **Login** — enter password
2. **Setup** — pick Daily or Weekly + date
3. **Chat** — AI asks questions, you respond by voice or text, AI probes deeper
4. **Save** — creates a structured Notion page (weekly includes AI-generated strategic review)

## Stack

- **Frontend**: Vanilla HTML/CSS/JS (no framework, no build)
- **Voice**: Web Speech API (Chrome)
- **AI**: Gemini 2.5 Flash Lite (called directly from browser)
- **Storage**: Notion API via Cloudflare Worker CORS proxy
- **Hosting**: GitHub Pages (free)

## Changing the Password

Open the app → Setup screen → click "Settings" → update the PIN.
