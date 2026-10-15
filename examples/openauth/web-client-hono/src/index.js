import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { authClient } from "./client.js";
import { subjects } from "./subjects.js";

const app = new Hono();
const REDIRECT_URI = process.env.REDIRECT_URI || "http://localhost:3001/callback";

// 1. Public Home
app.get("/", (c) => {
  const token = getCookie(c, "access_token");
  if (token) {
    return c.html(`
      <h1>OpenAuth Web Client</h1>
      <p>Active session detected.</p>
      <a href="/dashboard">Go to Dashboard</a> | <a href="/logout">Log Out</a>
    `);
  }

  return c.html(`
    <h1>OpenAuth Web Client</h1>
    <p>Sign in using the self-hosted OpenAuth server.</p>
    <a href="/login"><button style="padding: 10px 18px; cursor: pointer;">Sign In with OpenAuth</button></a>
  `);
});

// 2. Start Authorization Flow
app.get("/login", async (c) => {
  const { url } = await authClient.authorize(REDIRECT_URI, "code");
  return c.redirect(url);
});

// 3. OAuth Callback & Code Exchange
app.get("/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) {
    return c.text("Missing authorization code", 400);
  }

  const tokens = await authClient.exchange(code, REDIRECT_URI);
  if (tokens.err) {
    return c.text(`Token exchange failed: ${tokens.err}`, 400);
  }

  // Persist tokens in HTTP-only cookies
  setCookie(c, "access_token", tokens.access, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: 3600,
  });

  setCookie(c, "refresh_token", tokens.refresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: 2592000,
  });

  return c.redirect("/dashboard");
});

// 4. Protected Dashboard (With Token Rotation Handling)
app.get("/dashboard", async (c) => {
  const accessToken = getCookie(c, "access_token");
  const refreshToken = getCookie(c, "refresh_token");

  if (!accessToken) {
    return c.redirect("/login");
  }

  // Verify token & pass refresh token for automatic rotation
  const verified = await authClient.verify(subjects, accessToken, {
    refresh: refreshToken,
  });

  if (verified.err) {
    deleteCookie(c, "access_token");
    deleteCookie(c, "refresh_token");
    return c.redirect("/login");
  }

  // CRITICAL: Update cookies if token was refreshed during verification
  if (verified.tokens) {
    setCookie(c, "access_token", verified.tokens.access, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      path: "/",
      maxAge: 3600,
    });
    setCookie(c, "refresh_token", verified.tokens.refresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      path: "/",
      maxAge: 2592000,
    });
  }

  const user = verified.subject.properties;
  return c.html(`
    <h1>Protected Dashboard</h1>
    <p>Logged in as: <strong>${user.email}</strong></p>
    <p>User ID: <code>${user.userID}</code></p>
    <hr />
    <a href="/logout">Log Out</a>
  `);
});

// 5. Logout
app.get("/logout", (c) => {
  deleteCookie(c, "access_token");
  deleteCookie(c, "refresh_token");
  return c.redirect("/");
});

const PORT = Number(process.env.CLIENT_PORT) || 3001;

if (process.env.NODE_ENV !== "test") {
  console.log(`Web client running on http://localhost:${PORT}`);
  serve({ fetch: app.fetch, port: PORT });
}
