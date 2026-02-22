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

const SYSTEM_PROMPT = `You are a warm, concise reflection coach for Prof. Jihong Min, an assistant professor in BME at NUS working toward tenure.

You are conducting a {reflection_type} reflection session via voice. Rules:
1. When you receive "ASK: [question]", rephrase it naturally in one short sentence.
2. When you receive "FOLLOW_UP: [topic]: [answer]", acknowledge briefly (one sentence) then say NEXT on its own line.
3. Only ask a follow-up instead of NEXT if the answer was truly empty or unclear. Don't dig deep.
4. If the user says "move on", "next", "skip", or anything similar, immediately say NEXT.
5. Keep ALL responses to 1-2 short sentences. This is spoken aloud on a phone.
6. Be a thoughtful peer, not an interviewer. Don't over-probe or over-praise.
7. Never use bullet points, markdown, or lists.

IMPORTANT: Say NEXT (the word "NEXT") on its own line when ready to move to the next question. You should say NEXT after most follow-ups.`;
