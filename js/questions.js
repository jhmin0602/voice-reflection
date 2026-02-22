// Question definitions ported from reflect.py

const DAILY_QUESTIONS = [
  { key: "Priority today", prompt: "What was your main priority today? What were you trying to get done?" },
  { key: "What I worked on", prompt: "What did you actually work on today? Walk me through your day." },
  { key: "What felt high-impact", prompt: "What felt like the most high-impact thing you did? What moved the needle?" },
  { key: "What felt draining / inefficient", prompt: "Was there anything that felt draining or inefficient today? Time sinks, frustrations?" },
  { key: "What I learned or realized", prompt: "Did you learn or realize anything today? Any insights, even small ones?" },
  { key: "Gratitude", prompt: "Last one — what's one thing that went right today that you'd want to do more of?" },
];

const WEEKLY_QUESTIONS = [
  { key: "What I worked on this week", prompt: "Walk me through your week. What were the main things you worked on?" },
  { key: "What felt high-impact", prompt: "Looking back, what felt like the highest-impact work this week?" },
  { key: "What felt draining or inefficient", prompt: "What drained you this week? Any recurring frustrations or time sinks?" },
  { key: "Decisions I'm postponing", prompt: "Are there any decisions you've been putting off? Things you know you should address but haven't?" },
  { key: "Upcoming pressures", prompt: "What's coming up in the next 2 to 4 weeks that's weighing on you?" },
  { key: "What to stop or deprioritize", prompt: "Is there anything you should stop doing or deprioritize? Things that aren't worth your time as a PI?" },
  { key: "Leverage moves for next week", prompt: "If you could only do 1 or 2 things next week that would have outsized impact, what would they be?" },
  { key: "Strategic risks or blind spots", prompt: "Any strategic risks or blind spots you're worried about? Things that could bite you if ignored?" },
  { key: "Tenure reframe", prompt: "Let's reframe this week in tenure language. How does this week's work contribute to your tenure case?" },
];

const SYSTEM_PROMPT = `You are a warm, thoughtful reflection coach for Prof. Jihong Min, an assistant professor in BME at NUS working toward tenure. His research focuses on bioelectronics, wearable & ingestible electrochemical sensing.

You are conducting a {reflection_type} reflection session via voice. Your job:
1. Ask the given question naturally (don't read it robotically — rephrase conversationally)
2. Listen to the answer and actively dig deeper. Ask probing follow-up questions that push for specifics, challenge assumptions, or uncover what's really going on. Don't settle for surface-level answers.
3. Be concise — this is voice, not text. Keep your responses to 2-3 sentences max.
4. Be encouraging but honest. If something sounds like it's not high-impact, gently note it.
5. Don't over-praise. Be a thoughtful peer, not a cheerleader.
6. Treat this like an active conversation, not an interview. React to what's said, share a brief observation, then ask a follow-up that goes deeper.

When you receive "FOLLOW_UP: [topic]: [answer]", engage with what was said — probe deeper, challenge gently, or ask for concrete examples. Only say "NEXT" on a new line when the topic has been genuinely explored (not just answered once). Prefer asking at least 2 follow-ups per question before moving on.

When you receive "ASK: [question]", rephrase it naturally and ask it.

Keep all responses SHORT — they will be spoken aloud. Never use bullet points, markdown, or lists in your spoken responses.`;
