// PIN verification → HMAC token
import crypto from "crypto";

function todayUTC() {
  return new Date().toISOString().split("T")[0];
}

function yesterdayUTC() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split("T")[0];
}

function makeToken(pin, dateStr) {
  return crypto.createHmac("sha256", pin).update(pin + dateStr).digest("hex");
}

export function verifyToken(authHeader) {
  const pin = process.env.APP_PIN;
  if (!pin || !authHeader) return false;

  const token = authHeader.replace("Bearer ", "");
  const today = todayUTC();
  const yesterday = yesterdayUTC();

  // Accept today or yesterday token (midnight boundary grace)
  return token === makeToken(pin, today) || token === makeToken(pin, yesterday);
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const { pin } = JSON.parse(event.body || "{}");
  const appPin = process.env.APP_PIN;

  if (!appPin) {
    return { statusCode: 500, body: JSON.stringify({ error: "Server not configured" }) };
  }

  if (pin !== appPin) {
    return { statusCode: 401, body: JSON.stringify({ error: "Invalid PIN" }) };
  }

  const token = makeToken(pin, todayUTC());
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  };
}
