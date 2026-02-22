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

  /**
   * Single Gemini call with retry on 429. Waits 20s then retries once.
   * Returns { ok, text } or { ok: false, error }.
   */
  async _gemini(body) {
    const apiKey = localStorage.getItem("gemini_api_key");
    if (!apiKey) return { ok: false, error: "Gemini API key not configured" };

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        );
        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          return { ok: true, text: text?.trim() || "" };
        }
        if ((res.status === 429 || res.status === 502) && attempt === 0) {
          await new Promise((r) => setTimeout(r, 20000));
          continue;
        }
        const err = await res.json().catch(() => ({}));
        return { ok: false, error: err.error?.message || `Gemini error ${res.status}` };
      } catch (e) {
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 10000));
          continue;
        }
        return { ok: false, error: "Network error" };
      }
    }
  },

  /**
   * Batch cleanup: one Gemini call to clean up all raw voice transcripts.
   * @param {Object} answers - { key: "raw text", ... }
   * @returns { ok, answers: { key: "cleaned text", ... } }
   */
  async batchCleanup(answers) {
    const entries = Object.entries(answers).filter(([, v]) => v);
    if (entries.length === 0) return { ok: true, answers };

    const numbered = entries
      .map(([key, val], i) => `[${i + 1}] ${key}\n${val}`)
      .join("\n\n");

    const prompt = `Clean up these voice transcriptions for a reflection journal. Fix grammar and filler words, but preserve the original meaning and tone. Return each answer in the same numbered format.

${numbered}`;

    const result = await this._gemini({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 2048 },
    });

    if (!result.ok || !result.text) return { ok: false, error: result.error };

    // Parse numbered responses back into object
    const cleaned = { ...answers };
    const sections = result.text.split(/\[\d+\]\s*/);
    sections.shift(); // remove empty first element

    entries.forEach(([key], i) => {
      if (sections[i]) {
        // Remove the key label if the model echoed it back
        let text = sections[i].trim();
        if (text.toLowerCase().startsWith(key.toLowerCase())) {
          text = text.slice(key.length).replace(/^\s*\n/, "").trim();
        }
        cleaned[key] = text || answers[key];
      }
    });

    return { ok: true, answers: cleaned };
  },

  async saveDaily(title, dateStr, answers) {
    const notionKey = localStorage.getItem("notion_api_key");
    const dbId = localStorage.getItem("notion_db_id");
    if (!notionKey || !dbId) return { ok: false, error: "Notion not configured" };

    const pageTitle = (await this._generateTitle(answers, "daily")) || title;

    const children = [
      { object: "block", type: "heading_2", heading_2: { rich_text: [{ text: { content: "Daily Log" } }] } },
    ];

    DAILY_QUESTION_KEYS.forEach((key, i) => {
      children.push({
        object: "block",
        type: "heading_3",
        heading_3: { rich_text: [{ text: { content: `${i + 1}. ${key}` } }] },
      });
      const answerText = answers[key] || "";
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
    const notionKey = localStorage.getItem("notion_api_key");
    const dbId = localStorage.getItem("notion_db_id");
    if (!notionKey || !dbId) return { ok: false, error: "Notion not configured" };

    // Generate AI review
    const answersText = Object.entries(answers)
      .map(([k, v]) => `**${k}:** ${v}`)
      .join("\n");

    const reviewResult = await this._gemini({
      system_instruction: { parts: [{ text: AI_REVIEW_SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: `Here are my weekly reflection answers:\n\n${answersText}` }] }],
      generationConfig: { maxOutputTokens: 3000 },
    });

    if (!reviewResult.ok || !reviewResult.text) {
      return { ok: false, error: reviewResult.error || "AI review generation failed" };
    }
    const aiReview = reviewResult.text;

    const pageTitle = (await this._generateTitle(answers, "weekly")) || title;

    // Build Notion blocks
    const children = [];

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
      const answerText = answers[key] || "";
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
      const answerText = answers[key] || "";
      for (const chunk of this._splitText(answerText)) {
        children.push({
          object: "block",
          type: "paragraph",
          paragraph: { rich_text: [{ text: { content: chunk } }] },
        });
      }
    });

    children.push({ object: "block", type: "divider", divider: {} });
    children.push({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: [{ text: { content: "AI review" } }] },
    });
    children.push(...this._parseReviewToBlocks(aiReview));

    return this._createNotionPage(dbId, notionKey, pageTitle, dateStr, "Weekly", children);
  },

  async _generateTitle(answers, type) {
    const emoji = type === "weekly" ? "\u{1F4C5}" : "\u{1F305}";
    const summary = Object.entries(answers)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v.slice(0, 200)}`)
      .join("\n");

    const result = await this._gemini({
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
    });

    return result.ok && result.text ? `${emoji} ${result.text}` : null;
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
