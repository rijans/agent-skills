import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

app.use("*", cors());

// OAuth2 Token Exchange endpoint called by Activity client via /.proxy/api/token
app.post("/api/token", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const code = body.code;

  if (!code || typeof code !== "string") {
    return c.json({ error: "Missing or invalid authorization code" }, 400);
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("Server error: Missing DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET in environment");
    return c.json({ error: "Server credentials not configured" }, 500);
  }

  // Exchange code for access_token with Discord OAuth2 endpoint
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Discord token exchange failed:", response.status, errorText);
    return c.json({ error: "Failed to exchange token with Discord" }, response.status);
  }

  const tokenData = await response.json();

  return c.json({
    access_token: tokenData.access_token,
    token_type: tokenData.token_type,
    expires_in: tokenData.expires_in,
  });
});

export default app;
