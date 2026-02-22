// Create weekly reflection page in Notion with AI review
import { verifyToken } from "./auth.mjs";

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

const NOTION_DB_ID = "2e15059d-f30e-805c-8cbe-f6a5abba6b15";

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

/** Split text at sentence boundaries for Notion's 2000-char limit */
function splitText(text, maxLen = 1900) {
  if (text.length <= maxLen) return [text];
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
}

/** Parse markdown AI review into Notion blocks */
function parseReviewToBlocks(reviewText) {
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
      const content = line.slice(2);
      for (const chunk of splitText(content)) {
        blocks.push({
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: { rich_text: [{ text: { content: chunk } }] },
        });
      }
    } else if (line.startsWith("> ")) {
      const content = line.slice(2);
      for (const chunk of splitText(content)) {
        blocks.push({
          object: "block",
          type: "quote",
          quote: { rich_text: [{ text: { content: chunk } }] },
        });
      }
    } else {
      for (const chunk of splitText(line)) {
        blocks.push({
          object: "block",
          type: "paragraph",
          paragraph: { rich_text: [{ text: { content: chunk } }] },
        });
      }
    }
  }

  return blocks;
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
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!notionKey || !anthropicKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "Keys not configured" }) };
  }

  // ── Step 1: Generate AI review ──
  const answersText = Object.entries(answers)
    .map(([k, v]) => `**${k}:** ${v}`)
    .join("\n");

  let aiReview;
  try {
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        system: AI_REVIEW_SYSTEM,
        messages: [
          {
            role: "user",
            content: `Here are my weekly reflection answers:\n\n${answersText}`,
          },
        ],
      }),
    });

    const claudeData = await claudeRes.json();
    if (!claudeRes.ok) {
      console.error("Claude API error:", claudeData);
      return { statusCode: 502, body: JSON.stringify({ error: "AI review generation failed" }) };
    }
    aiReview = claudeData.content[0].text;
  } catch (err) {
    console.error("AI review error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "AI review error" }) };
  }

  // ── Step 2: Build Notion page ──
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
    const answerText = answers[key] || "";
    // Split into bullet items by sentence
    const sentences = answerText.split(". ").filter((s) => s.trim());
    for (const sentence of sentences) {
      for (const chunk of splitText(sentence.trim())) {
        children.push({
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: { rich_text: [{ text: { content: chunk } }] },
        });
      }
    }
  });

  // Divider
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

  // Strategic tasks (questions 6-9, labeled A-D)
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
    for (const chunk of splitText(answerText)) {
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

  const reviewBlocks = parseReviewToBlocks(aiReview);
  children.push(...reviewBlocks);

  // ── Step 3: Post to Notion ──
  // Notion limits children to 100 blocks per request
  const payload = {
    parent: { database_id: NOTION_DB_ID },
    properties: {
      Name: { title: [{ text: { content: title } }] },
      Date: { date: { start: dateStr } },
      Type: { select: { name: "Weekly" } },
    },
    children: children.slice(0, 100),
  };

  try {
    const notionRes = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${notionKey}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const notionData = await notionRes.json();
    if (!notionData.id) {
      console.error("Notion error:", notionData);
      return { statusCode: 502, body: JSON.stringify({ error: "Notion API error", detail: notionData }) };
    }

    // If there are more than 100 blocks, append the rest
    if (children.length > 100) {
      const remaining = children.slice(100);
      await fetch(`https://api.notion.com/v1/blocks/${notionData.id}/children`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${notionKey}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ children: remaining.slice(0, 100) }),
      });
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: notionData.url }),
    };
  } catch (err) {
    console.error("save-weekly error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal error" }) };
  }
}
