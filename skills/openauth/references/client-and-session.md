# Client Verification and Session Management

This reference details how client applications (Next.js, Hono, Astro, Cloudflare Workers, Node.js) connect to an OpenAuth server to authorize users, exchange authorization codes, and verify JWT tokens with automatic refresh rotation.

---

## 1. Initializing the Client

Import `createClient` from `@openauthjs/openauth/client`:

```typescript
// client.ts
import { createClient } from "@openauthjs/openauth/client";

export const authClient = createClient({
  clientID: "web-app",
  issuer: process.env.AUTH_ISSUER_URL || "https://auth.example.com",
});
```

---

## 2. Authorization Flow (`client.authorize`)

When a user visits `/login` or clicks a sign-in button:

### SSR Flow (Code Flow)

```typescript
// Redirect user to the OpenAuth issuer server
const { url } = await authClient.authorize(
  "https://myapp.com/callback",
  "code"
);

return Response.redirect(url, 302);
```

### SPA / Mobile Flow with PKCE

For public clients (SPAs, mobile apps) that cannot safely hold client secrets:

```typescript
const { challenge, url } = await authClient.authorize(
  "https://myapp.com/callback",
  "code",
  { pkce: true }
);

// Store the PKCE verifier in a secure, HTTP-only cookie or local session
setCookie("pkce_verifier", challenge.verifier, { httpOnly: true, secure: true });

return Response.redirect(url, 302);
```

---

## 3. Code Exchange on Callback (`client.exchange`)

When the user completes authentication, OpenAuth redirects back to your redirect URI with `?code=...`:

```typescript
// Route: /callback
export async function handleCallback(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return new Response("Missing authorization code", { status: 400 });
  }

  // Retrieve PKCE verifier if PKCE was used
  const pkceVerifier = getCookie(request, "pkce_verifier");

  // Exchange code for access & refresh tokens
  const exchanged = await authClient.exchange(
    code,
    "https://myapp.com/callback",
    pkceVerifier
  );

  if (exchanged.err) {
    return new Response(`Authentication failed: ${exchanged.err}`, { status: 400 });
  }

  // Store tokens in secure HTTP-only cookies
  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    `access_token=${exchanged.tokens.access}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600`
  );
  headers.append(
    "Set-Cookie",
    `refresh_token=${exchanged.tokens.refresh}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`
  );
  headers.set("Location", "/dashboard");

  return new Response(null, { status: 302, headers });
}
```

---

## 4. Session Verification & The Token Rotation Trap

> [!CAUTION]
> **The Refresh Token Rotation Trap**:
> When an access token expires, `client.verify(subjects, token, { refresh })` automatically exchanges the refresh token with the issuer and issues a brand-new token pair (`verified.tokens`).
> 
> **You MUST persist `verified.tokens` to your HTTP-only cookies in your response.** If you fail to save the rotated tokens, the old refresh token becomes invalid, and the user will be abruptly logged out on their subsequent request!

### Complete Hono Auth Middleware Pattern

```typescript
// middleware/auth.ts
import { createMiddleware } from "hono/factory";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { authClient } from "../client";
import { subjects } from "../subjects";

export const requireAuth = createMiddleware(async (c, next) => {
  const accessToken = getCookie(c, "access_token");
  const refreshToken = getCookie(c, "refresh_token");

  if (!accessToken) {
    return c.redirect("/login");
  }

  // Verify access token with subjects schema & optional refresh fallback
  const verified = await authClient.verify(subjects, accessToken, {
    refresh: refreshToken,
  });

  if (verified.err) {
    deleteCookie(c, "access_token");
    deleteCookie(c, "refresh_token");
    return c.redirect("/login");
  }

  // CRITICAL: Persist rotated tokens if refresh occurred
  if (verified.tokens) {
    setCookie(c, "access_token", verified.tokens.access, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
      maxAge: 3600,
    });
    setCookie(c, "refresh_token", verified.tokens.refresh, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
      maxAge: 2592000,
    });
  }

  // Attach verified user subject to request context
  c.set("user", verified.subject.properties);
  await next();
});
```

---

## 5. Next.js App Router Verification Pattern

In Next.js 14+ Server Components and Route Handlers:

```typescript
// lib/session.ts
import { cookies } from "next/headers";
import { authClient } from "./client";
import { subjects } from "./subjects";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;
  const refreshToken = cookieStore.get("refresh_token")?.value;

  if (!accessToken) return null;

  const verified = await authClient.verify(subjects, accessToken, {
    refresh: refreshToken,
  });

  if (verified.err) return null;

  // If rotated tokens are present in Server Action / Route Handler context:
  if (verified.tokens) {
    cookieStore.set("access_token", verified.tokens.access, {
      httpOnly: true,
      secure: true,
      path: "/",
      maxAge: 3600,
    });
    cookieStore.set("refresh_token", verified.tokens.refresh, {
      httpOnly: true,
      secure: true,
      path: "/",
      maxAge: 2592000,
    });
  }

  return verified.subject.properties;
}
```
