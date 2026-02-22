// Gemini conversation proxy
import { verifyToken } from "./auth.mjs";

/** Convert conversation history from {role: "user"/"assistant"} to Gemini format */
function toGeminiContents(history) {
  return history.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  if (!verifyToken(event.headers.authorization)) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  const { conversationHistory, systemPrompt } = JSON.parse(event.body || "{}");

  if (!conversationHistory || !systemPrompt) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing fields" }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "API key not configured" }) };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: toGeminiContents(conversationHistory),
          generationConfig: { maxOutputTokens: 1024 },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", data);
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "Gemini API error", detail: data.error?.message }),
      };
    }

    const message = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!message) {
      console.error("Unexpected Gemini response:", data);
      return { statusCode: 502, body: JSON.stringify({ error: "Empty response from Gemini" }) };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    };
  } catch (err) {
    console.error("Chat function error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal error" }) };
  }
}
