// API wrappers for Netlify serverless functions

const API = {
  _getToken() {
    return sessionStorage.getItem("auth_token");
  },

  _headers() {
    return {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + (this._getToken() || ""),
    };
  },

  async authenticate(pin) {
    const res = await fetch("/.netlify/functions/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json();
    if (res.ok && data.token) {
      sessionStorage.setItem("auth_token", data.token);
      return { ok: true };
    }
    return { ok: false, error: data.error || "Authentication failed" };
  },

  async chat(conversationHistory, systemPrompt) {
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const res = await fetch("/.netlify/functions/chat", {
        method: "POST",
        headers: this._headers(),
        body: JSON.stringify({ conversationHistory, systemPrompt }),
      });
      if (res.status === 401) {
        return { ok: false, authExpired: true };
      }
      const data = await res.json();
      if (res.ok) {
        return { ok: true, message: data.message };
      }
      // Rate limited (502) — wait and retry
      if (res.status === 502 && attempt < maxRetries - 1) {
        const wait = (attempt + 1) * 8000; // 8s, 16s
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      return { ok: false, error: data.error || "Chat request failed" };
    }
  },

  async saveDaily(title, dateStr, answers) {
    const res = await fetch("/.netlify/functions/save-daily", {
      method: "POST",
      headers: this._headers(),
      body: JSON.stringify({ title, dateStr, answers }),
    });
    if (res.status === 401) {
      return { ok: false, authExpired: true };
    }
    const data = await res.json();
    if (res.ok) {
      return { ok: true, url: data.url };
    }
    return { ok: false, error: data.error || "Save failed" };
  },

  async saveWeekly(title, dateStr, answers) {
    const res = await fetch("/.netlify/functions/save-weekly", {
      method: "POST",
      headers: this._headers(),
      body: JSON.stringify({ title, dateStr, answers }),
    });
    if (res.status === 401) {
      return { ok: false, authExpired: true };
    }
    const data = await res.json();
    if (res.ok) {
      return { ok: true, url: data.url };
    }
    return { ok: false, error: data.error || "Save failed" };
  },
};
