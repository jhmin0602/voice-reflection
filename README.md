# Voice Reflection

Voice-driven daily and weekly reflection web app. An AI coach asks structured questions, probes deeper with follow-ups, then saves everything to Notion.

Built for Android Chrome — works from a phone with no local server needed.

## Setup

1. Fork/clone this repo
2. Connect to [Netlify](https://app.netlify.com) (import from Git)
3. Set environment variables in Netlify dashboard:

| Variable | Source |
|----------|--------|
| `APP_PIN` | Your chosen password |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) (free) |
| `NOTION_API_KEY` | Your Notion integration token |

4. Deploy — no build step needed

## How It Works

1. **Login** — enter password
2. **Setup** — pick Daily or Weekly + date
3. **Chat** — AI asks questions, you respond by voice or text, AI probes deeper
4. **Save** — creates a structured Notion page (weekly includes AI-generated strategic review)

## Stack

- **Frontend**: Vanilla HTML/CSS/JS (no framework, no build)
- **Voice**: Web Speech API (Chrome)
- **AI**: Gemini 2.5 Flash via Netlify Functions
- **Storage**: Notion API
- **Hosting**: Netlify (static site + serverless functions)

## Changing the Password

1. Netlify dashboard → Site configuration → Environment variables
2. Edit `APP_PIN`
3. Deploys → Trigger deploy → Clear cache and deploy
