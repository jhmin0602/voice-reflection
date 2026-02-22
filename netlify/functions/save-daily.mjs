// Create daily reflection page in Notion
import { verifyToken } from "./auth.mjs";

const DAILY_QUESTION_KEYS = [
  "Priority today",
  "What I worked on",
  "What felt high-impact",
  "What felt draining / inefficient",
  "What I learned or realized",
  "Gratitude",
];

const NOTION_DB_ID = "2e15059d-f30e-805c-8cbe-f6a5abba6b15";

/** Split text at sentence boundaries to stay under Notion's 2000-char block limit */
function splitText(text, maxLen = 1900) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    let splitAt = remaining.lastIndexOf(". ", maxLen);
    if (splitAt === -1) splitAt = remaining.lastIndexOf(" ", maxLen);
    if (splitAt === -1) splitAt = maxLen;
    else splitAt += 1; // include the period/space
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

/** Generate a short summary title from answers using Gemini */
async function generateTitle(answers, geminiKey) {
  try {
    const summary = Object.entries(answers)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v.slice(0, 200)}`)
      .join("\n");
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Summarize this daily reflection in 3-6 words as a short page title. Output ONLY the title, no quotes or extra punctuation.\n\n${summary}`,
                },
              ],
            },
          ],
          generationConfig: { maxOutputTokens: 20 },
        }),
      }
    );
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch (e) {
    return null;
  }
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  if (!verifyToken(event.headers.authorization)) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  const { title, dateStr, answers } = JSON.parse(event.body || "{}");
  const notionKey = process.env.NOTION_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!notionKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "Notion key not configured" }) };
  }

  // Generate summary title (falls back to date-based title)
  const pageTitle = (geminiKey && (await generateTitle(answers, geminiKey))) || title;

  // Build page children blocks
  const children = [
    {
      object: "block",
      type: "heading_2",
      heading_2: { rich_text: [{ text: { content: "Daily Log" } }] },
    },
  ];

  DAILY_QUESTION_KEYS.forEach((key, i) => {
    children.push({
      object: "block",
      type: "heading_3",
      heading_3: { rich_text: [{ text: { content: `${i + 1}. ${key}` } }] },
    });
    const answerText = answers[key] || "";
    for (const chunk of splitText(answerText)) {
      children.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ text: { content: chunk } }] },
      });
    }
  });

  const payload = {
    parent: { database_id: NOTION_DB_ID },
    properties: {
      Name: { title: [{ text: { content: pageTitle } }] },
      Date: { date: { start: dateStr } },
      Type: { select: { name: "Daily" } },
    },
    children,
  };

  try {
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionKey}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (data.id) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: data.url }),
      };
    } else {
      console.error("Notion error:", data);
      return { statusCode: 502, body: JSON.stringify({ error: "Notion API error", detail: data }) };
    }
  } catch (err) {
    console.error("save-daily error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal error" }) };
  }
}
