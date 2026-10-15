import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();
app.use("*", cors());

// In-memory rooms and synchronized counters
const roomCounters = new Map();

// OAuth2 Token Exchange
app.post("/api/token", async (c) => {
  const { code } = await c.req.json().catch(() => ({}));
  if (!code) return c.json({ error: "Missing code" }, 400);

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: process.env.DISCORD_CLIENT_ID || "",
    client_secret: process.env.DISCORD_CLIENT_SECRET || "",
  });

  const res = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  if (!res.ok) {
    return c.json({ error: "Token exchange failed" }, res.status);
  }

  const data = await res.json();
  return c.json({ access_token: data.access_token });
});

// REST Fallback for Room Counter State
app.get("/api/room/:roomId", (c) => {
  const roomId = c.req.param("roomId");
  const count = roomCounters.get(roomId) || 0;
  return c.json({ roomId, count });
});

app.post("/api/room/:roomId/increment", async (c) => {
  const roomId = c.req.param("roomId");
  const current = roomCounters.get(roomId) || 0;
  const updated = current + 1;
  roomCounters.set(roomId, updated);
  return c.json({ roomId, count: updated });
});

export default app;
