export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, PATCH, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type, Notion-Version",
        },
      });
    }
    const url = new URL(request.url);
    const resp = await fetch("https://api.notion.com" + url.pathname, {
      method: request.method,
      headers: {
        Authorization: request.headers.get("Authorization"),
        "Notion-Version": request.headers.get("Notion-Version") || "2022-06-28",
        "Content-Type": "application/json",
      },
      body: ["POST", "PATCH", "PUT"].includes(request.method) ? await request.text() : undefined,
    });
    return new Response(await resp.text(), {
      status: resp.status,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  },
};
