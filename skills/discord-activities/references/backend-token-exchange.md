# Backend OAuth2 Token Exchange

This reference details how to implement the secure `/api/token` exchange route on your backend to convert the client-side authorization code into an access token without exposing your application's `client_secret`.

---

## 1. The OAuth2 Token Exchange Protocol

Discord's OAuth2 token endpoint expects a `POST` request with `Content-Type: application/x-www-form-urlencoded`:

- **Endpoint**: `https://discord.com/api/v10/oauth2/token` (or `https://discord.com/api/oauth2/token`)
- **Method**: `POST`
- **Body Parameters**:
  - `grant_type`: `"authorization_code"`
  - `code`: The authorization code obtained from `discordSdk.commands.authorize()`
  - `client_id`: Your Discord Application Client ID
  - `client_secret`: Your Discord Application Client Secret

### Response Schema

```json
{
  "access_token": "6j4k2l...",
  "token_type": "Bearer",
  "expires_in": 604800,
  "refresh_token": "8m9n0p...",
  "scope": "identify guilds guilds.members.read"
}
```

---

## 2. Recipe A: Node.js & Bun with Hono

A lightweight, portable server implemented in [Hono](https://hono.dev):

```typescript
// server/src/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono();

app.use("*", cors());

app.post("/api/token", async (c) => {
  const { code } = await c.req.json<{ code?: string }>();

  if (!code) {
    return c.json({ error: "Missing authorization code" }, 400);
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("Missing DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET on server");
    return c.json({ error: "Server misconfiguration" }, 500);
  }

  // Build form-urlencoded payload
  const body = new URLSearchParams({
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
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Discord token exchange failed:", response.status, errorText);
    return c.json({ error: "Failed to exchange token with Discord" }, response.status);
  }

  const data = await response.json();

  // Return access_token to client for discordSdk.commands.authenticate()
  return c.json({
    access_token: data.access_token,
    token_type: data.token_type,
    expires_in: data.expires_in,
  });
});

export default app;
```

---

## 3. Recipe B: Cloudflare Workers Edge Adapter

Deploying the backend to Cloudflare Workers with zero server management:

```typescript
// worker/src/index.ts
export interface Env {
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/token" && request.method === "POST") {
      let body: { code?: string };
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
      }

      if (!body.code) {
        return new Response(JSON.stringify({ error: "Missing code parameter" }), { status: 400 });
      }

      const params = new URLSearchParams({
        grant_type: "authorization_code",
        code: body.code,
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
      });

      const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      });

      if (!tokenRes.ok) {
        return new Response(await tokenRes.text(), { status: tokenRes.status });
      }

      const data = await tokenRes.json();
      return new Response(
        JSON.stringify({ access_token: data.access_token }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response("Not Found", { status: 404 });
  },
};
```

---

## 4. Security Rules

1. **Never Log the Code or Secret**: Do not print `body.code` or `DISCORD_CLIENT_SECRET` in application logs.
2. **Codes Are Single-Use**: If a client sends the same code twice (e.g. on React strict-mode double rendering), Discord will return `400 Bad Request: invalid_grant`. Cache user sessions or deduplicate authorization calls on the frontend.
3. **Store `client_secret` in Secret Stores**: Always configure secrets via `.env` (gitignored), Cloudflare Secrets (`wrangler secret put DISCORD_CLIENT_SECRET`), or your cloud provider's secret manager.
