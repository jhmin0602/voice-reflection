// Client-side API — direct Gemini calls + Notion via Cloudflare Worker proxy

const GEMINI_MODEL = "gemini-2.5-flash-lite";

const DAILY_QUESTION_KEYS = [
  "Priority today",
  "What I worked on",
  "What felt high-impact",
  "What felt draining / inefficient",
  "What I learned or realized",
  "Gratitude",
];

const WEEKLY_QUESTION_KEYS = [
  "What I worked on this week",
  "What felt high-impact",
  "What felt draining or inefficient",
  "Decisions I'm postponing",
  "Upcoming pressures",
  "What to stop or deprioritize",
  "Leverage moves for next week",
  "Strategic risks or blind spots",
  "Tenure reframe",
];

const AI_REVIEW_SYSTEM = `You are a strategic advisor for a tenure-track assistant professor in BME at NUS.
Given their weekly reflection answers, generate a structured PI review. Use this format:

## Week Review

## 1. What you did
Categorize their work into: Core technical, Infrastructure, People & leadership, Transition load.
Use bullet points under each.

## 2. High-impact work
### Clear wins
- bullet points
### Subtle wins
- bullet points

## 3. What drained you
Analyze the drains and suggest mitigations.

## 4. Postponed decisions
Analyze urgency and suggest action.

## 5. Strategic risks
Identify 1-2 risks with analysis.

## 6. Tenure framing
> Write a 2-3 sentence tenure narrative for this week.

## 7. Stop or deprioritize
### Stop now
- items
### Pause
- items

Be direct, concise, and strategic. No fluff.`;

const API = {
  authenticate(pin) {
    const stored = localStorage.getItem("app_pin");
    if (!stored) return { ok: false, error: "No PIN configured" };
    if (pin === stored) return { ok: true };
    return { ok: false, error: "Invalid PIN" };
  },

  async summarizeAnswer(questionPrompt, rawTranscript) {
    const apiKey = localStorage.getItem("gemini_api_key");
    if (!apiKey) return { ok: false, error: "Gemini API key not configured" };

    const prompt = `You are cleaning up a voice transcription for a reflection journal.

Question asked: "${questionPrompt}"
Raw voice transcript: "${rawTranscript}"

Rewrite the transcript into clear, concise sentences. Fix grammar and filler words, but preserve the original meaning and tone. Output ONLY the cleaned-up text, nothing else.`;

    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: { maxOutputTokens: 512 },
            }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const summary = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!summary) return { ok: false, error: "Empty response from Gemini" };
          return { ok: true, summary: summary.trim() };
        }

        if ((res.status === 429 || res.status === 502) && attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, (attempt + 1) * 8000));
          continue;
        }

        const err = await res.json().catch(() => ({}));
        return { ok: false, error: err.error?.message || "Gemini API error" };
      } catch (e) {
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, (attempt + 1) * 4000));
          continue;
        }
        return { ok: false, error: "Network error" };
      }
    }
  },

  async saveDaily(title, dateStr, answers) {
    const geminiKey = localStorage.getItem("gemini_api_key");
    const notionKey = localStorage.getItem("notion_api_key");
    const dbId = localStorage.getItem("notion_db_id");
    if (!notionKey || !dbId) return { ok: false, error: "Notion not configured" };

    const flatAnswers = this._flattenAnswers(answers);
    const pageTitle = (geminiKey && (await this._generateTitle(flatAnswers, geminiKey, "daily"))) || title;

    const children = [
      { object: "block", type: "heading_2", heading_2: { rich_text: [{ text: { content: "Daily Log" } }] } },
    ];

    DAILY_QUESTION_KEYS.forEach((key, i) => {
      children.push({
        object: "block",
        type: "heading_3",
        heading_3: { rich_text: [{ text: { content: `${i + 1}. ${key}` } }] },
      });
      const answerText = flatAnswers[key] || "";
      for (const chunk of this._splitText(answerText)) {
        children.push({
          object: "block",
          type: "paragraph",
          paragraph: { rich_text: [{ text: { content: chunk } }] },
        });
      }
    });

    return this._createNotionPage(dbId, notionKey, pageTitle, dateStr, "Daily", children);
  },

  async saveWeekly(title, dateStr, answers) {
    const geminiKey = localStorage.getItem("gemini_api_key");
    const notionKey = localStorage.getItem("notion_api_key");
    const dbId = localStorage.getItem("notion_db_id");
    if (!notionKey || !dbId) return { ok: false, error: "Notion not configured" };
    if (!geminiKey) return { ok: false, error: "Gemini API key needed for weekly review" };

    const flatAnswers = this._flattenAnswers(answers);

    // Generate AI review
    const answersText = Object.entries(flatAnswers)
      .map(([k, v]) => `**${k}:** ${v}`)
      .join("\n");

    let aiReview;
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: AI_REVIEW_SYSTEM }] },
              contents: [{ role: "user", parts: [{ text: `Here are my weekly reflection answers:\n\n${answersText}` }] }],
              generationConfig: { maxOutputTokens: 3000 },
            }),
          }
        );
        if (res.ok) {
          const data = await res.json();
          aiReview = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!aiReview) return { ok: false, error: "Empty AI review response" };
          break;
        }
        if ((res.status === 429 || res.status === 502) && attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, (attempt + 1) * 8000));
          continue;
        }
        return { ok: false, error: "AI review generation failed" };
      } catch (e) {
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, (attempt + 1) * 4000));
          continue;
        }
        return { ok: false, error: "AI review network error" };
      }
    }

    const pageTitle = (await this._generateTitle(flatAnswers, geminiKey, "weekly")) || title;

    // Build Notion blocks
    const children = [];

    // Check-in section (first 5 questions)
    children.push({
      object: "block",
      type: "heading_2",
      heading_2: { rich_text: [{ text: { content: "Weekly PI Check-in" } }] },
    });

    WEEKLY_QUESTION_KEYS.slice(0, 5).forEach((key, i) => {
      children.push({
        object: "block",
        type: "heading_3",
        heading_3: { rich_text: [{ text: { content: `${i + 1}. ${key}` } }] },
      });
      const answerText = flatAnswers[key] || "";
      const sentences = answerText.split(". ").filter((s) => s.trim());
      for (const sentence of sentences) {
        for (const chunk of this._splitText(sentence.trim())) {
          children.push({
            object: "block",
            type: "bulleted_list_item",
            bulleted_list_item: { rich_text: [{ text: { content: chunk } }] },
          });
        }
      }
    });

    children.push({ object: "block", type: "divider", divider: {} });

    // Context
    children.push({
      object: "block",
      type: "heading_3",
      heading_3: { rich_text: [{ text: { content: "Context" } }] },
    });
    for (const ctx of [
      "Role: Assistant Professor in BME at NUS",
      "Research: bioelectronics, wearable & ingestible electrochemical sensing",
      "Goal: tenure-safe differentiation and efficiency",
    ]) {
      children.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: [{ text: { content: ctx } }] },
      });
    }

    children.push({ object: "block", type: "divider", divider: {} });

    // Strategic tasks (questions 6-9)
    children.push({
      object: "block",
      type: "heading_3",
      heading_3: { rich_text: [{ text: { content: "Tasks" } }] },
    });

    const labels = ["A", "B", "C", "D"];
    WEEKLY_QUESTION_KEYS.slice(5, 9).forEach((key, i) => {
      children.push({
        object: "block",
        type: "heading_3",
        heading_3: { rich_text: [{ text: { content: `${labels[i]}. ${key}` } }] },
      });
      const answerText = flatAnswers[key] || "";
      for (const chunk of this._splitText(answerText)) {
        children.push({
          object: "block",
          type: "paragraph",
          paragraph: { rich_text: [{ text: { content: chunk } }] },
        });
      }
    });

    // AI Review section
    children.push({ object: "block", type: "divider", divider: {} });
    children.push({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: [{ text: { content: "AI review" } }] },
    });
    children.push(...this._parseReviewToBlocks(aiReview));

    return this._createNotionPage(dbId, notionKey, pageTitle, dateStr, "Weekly", children);
  },

  /** Flatten answers from { key: { raw, summary } } to { key: string } */
  _flattenAnswers(answers) {
    const flat = {};
    for (const [key, val] of Object.entries(answers)) {
      if (typeof val === "string") {
        flat[key] = val;
      } else if (val && val.summary) {
        flat[key] = val.summary;
      } else if (val && val.raw) {
        flat[key] = val.raw;
      } else {
        flat[key] = "";
      }
    }
    return flat;
  },

  async _generateTitle(answers, geminiKey, type) {
    const emoji = type === "weekly" ? "\u{1F4C5}" : "\u{1F305}";
    try {
      const summary = Object.entries(answers)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v.slice(0, 200)}`)
        .join("\n");
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `Summarize this ${type} reflection in 3-6 words as a short page title. Output ONLY the title, no quotes or extra punctuation.\n\n${summary}`,
                  },
                ],
              },
            ],
            generationConfig: { maxOutputTokens: 20 },
          }),
        }
      );
      const data = await res.json();
      const title = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      return title ? `${emoji} ${title}` : null;
    } catch (e) {
      return null;
    }
  },

  _splitText(text, maxLen = 1900) {
    if (!text || text.length <= maxLen) return [text || ""];
    const chunks = [];
    let remaining = text;
    while (remaining.length > maxLen) {
      let splitAt = remaining.lastIndexOf(". ", maxLen);
      if (splitAt === -1) splitAt = remaining.lastIndexOf(" ", maxLen);
      if (splitAt === -1) splitAt = maxLen;
      else splitAt += 1;
      chunks.push(remaining.slice(0, splitAt).trim());
      remaining = remaining.slice(splitAt).trim();
    }
    if (remaining) chunks.push(remaining);
    return chunks;
  },

  _parseReviewToBlocks(reviewText) {
    const blocks = [];
    const lines = reviewText.trim().split("\n");

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      if (line.startsWith("## ")) {
        blocks.push({
          object: "block",
          type: "heading_2",
          heading_2: { rich_text: [{ text: { content: line.slice(3) } }] },
        });
      } else if (line.startsWith("### ")) {
        blocks.push({
          object: "block",
          type: "heading_3",
          heading_3: { rich_text: [{ text: { content: line.slice(4) } }] },
        });
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        for (const chunk of this._splitText(line.slice(2))) {
          blocks.push({
            object: "block",
            type: "bulleted_list_item",
            bulleted_list_item: { rich_text: [{ text: { content: chunk } }] },
          });
        }
      } else if (line.startsWith("> ")) {
        for (const chunk of this._splitText(line.slice(2))) {
          blocks.push({
            object: "block",
            type: "quote",
            quote: { rich_text: [{ text: { content: chunk } }] },
          });
        }
      } else {
        for (const chunk of this._splitText(line)) {
          blocks.push({
            object: "block",
            type: "paragraph",
            paragraph: { rich_text: [{ text: { content: chunk } }] },
          });
        }
      }
    }
    return blocks;
  },

  async _notionFetch(path, method, body) {
    const workerUrl = localStorage.getItem("worker_url");
    const notionKey = localStorage.getItem("notion_api_key");
    if (!workerUrl || !notionKey) throw new Error("Notion proxy not configured");

    const url = workerUrl.replace(/\/$/, "") + path;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${notionKey}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  },

  async _createNotionPage(dbId, notionKey, pageTitle, dateStr, type, children) {
    try {
      const payload = {
        parent: { database_id: dbId },
        properties: {
          Name: { title: [{ text: { content: pageTitle } }] },
          Date: { date: { start: dateStr } },
          Type: { select: { name: type } },
        },
        children: children.slice(0, 100),
      };

      const data = await this._notionFetch("/v1/pages", "POST", payload);

      if (!data.id) {
        console.error("Notion API response:", data);
        return { ok: false, error: data.message || "Notion API error" };
      }

      // Append overflow blocks (Notion limits 100 per request)
      if (children.length > 100) {
        await this._notionFetch(`/v1/blocks/${data.id}/children`, "PATCH", {
          children: children.slice(100, 200),
        });
      }

      return { ok: true, url: data.url };
    } catch (e) {
      return { ok: false, error: e.message || "Save failed" };
    }
  },
};
