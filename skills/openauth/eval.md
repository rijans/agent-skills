# Evaluation & Benchmark Suite: `openauth`

This document defines the evaluation criteria, positive/negative trigger boundaries, and adversarial benchmark scenarios for the `openauth` agent skill.

---

## 1. Intent Matching & Trigger Boundaries

### Positive Triggers (Activate Skill)
- "Set up a self-hosted auth server using OpenAuth on Cloudflare Workers"
- "How do I configure PasswordUI or CodeUI with @openauthjs/openauth?"
- "Define user subjects and JWT tokens using createSubjects in Valibot/Zod"
- "Implement SSR session verification and token refresh with OpenAuth client"
- "Add GitHub and Google OAuth providers to OpenAuth issuer"
- "Migrate from Clerk/Auth0 to self-hosted OpenAuth on AWS Lambda with DynamoDB"

### Negative Triggers (Do Not Activate Skill)
- "Configure Clerk authentication in a Next.js 14 app" $\rightarrow$ Route to Next.js / Clerk documentation.
- "Build a Telegram mini-app login" $\rightarrow$ Route to `use-telegram-serverless`.
- "Configure Discord Activities OAuth2 handshake" $\rightarrow$ Route to `discord-activities`.
- "Set up stateful Express session with Redis store" $\rightarrow$ Generic Node/Express session workflow.

---

## 2. Core Quality Rubrics

| Category | Passing Standard (Score: 5/5) | Failing Standard (Score: 0/5) |
|---|---|---|
| **Subjects Typing** | Uses `createSubjects` with modern standard-schema validators (Valibot or Zod v3.24+). Type inference flows to `ctx.subject()`. | Hand-rolls ad-hoc JWT payloads without `createSubjects` or uses unsupported schema syntax. |
| **Token Refresh** | Protects SSR routes by checking `verified.tokens` on `client.verify()` and persisting updated cookies when tokens rotate. | Calls `client.verify()`, ignores returned rotated tokens, and lets the session fail on the next request. |
| **Storage Architecture** | Recommends `CloudflareStorage` (KV) or `DynamoStorage` for serverless production; restricts `MemoryStorage` to local dev. | Uses `MemoryStorage` in Cloudflare Workers or Lambda production, causing intermittent auth state loss. |
| **Security & Secrets** | Strictly confines `clientSecret` and signing keys to backend environment variables; enforces redirect URI checks. | Leaks provider secrets in client-side Vite/Next.js environment variables or commits them. |
| **Runtime Portability** | Correctly binds `issuer()` (Hono app) to the target runtime (direct export for Workers/Bun, `@hono/node-server` for Node). | Assumes Express middleware without adapter or tries to use Node-specific HTTP modules on Cloudflare. |

---

## 3. Adversarial Traps & Benchmark Scenarios

### Trap Scenario 1: Token Refresh Cookie Persistence
- **Prompt**: *"Write an SSR middleware in Hono that validates user sessions using OpenAuth `createClient`."*
- **Failure**: The agent validates `client.verify(subjects, accessToken, { refresh })` but ignores `verified.tokens`. When the access token expires, the token is refreshed by the issuer, but the browser cookie is not updated, causing subsequent requests to fail with `401 Unauthorized`.
- **Pass Criteria**: The agent explicitly inspects if `verified.tokens` exists and updates the `accessToken` and `refreshToken` HTTP-only cookies in the response before proceeding to the next handler.

### Trap Scenario 2: Serverless In-Memory Storage Trap
- **Prompt**: *"Deploy an OpenAuth issuer to Cloudflare Workers with email OTP codes."*
- **Failure**: The agent configures `storage: MemoryStorage()` inside a Cloudflare Worker script. Verification codes sent to users vanish between isolate restarts or multi-region edge requests, preventing users from ever completing authentication.
- **Pass Criteria**: The agent warns that `MemoryStorage` cannot be used in serverless production and implements `CloudflareStorage({ namespace: env.AUTH_KV })` with KV namespace bindings.

### Trap Scenario 3: Missing PKCE Verifier on Exchange
- **Prompt**: *"Implement the client login and callback route for a SPA/SSR app using OpenAuth."*
- **Failure**: The agent generates a PKCE authorization URL with `client.authorize(redirectURI, "code", { pkce: true })` but discards the generated `verifier`. In the callback route, calling `client.exchange(code, redirectURI)` fails because the OpenAuth server demands the matching code verifier.
- **Pass Criteria**: The agent persists the PKCE `verifier` in a secure, temporary cookie or session store and passes it as the third argument to `client.exchange(code, redirectURI, verifier)`.

### Trap Scenario 4: Standard Schema Incompatibility in `createSubjects`
- **Prompt**: *"Define my user subjects schema for OpenAuth with Zod."*
- **Failure**: The agent uses legacy schema configurations or raw TypeScript interfaces instead of passing Standard Schema-compatible objects to `createSubjects`, causing compilation errors in `@openauthjs/openauth/subject`.
- **Pass Criteria**: The agent imports `createSubjects` from `@openauthjs/openauth/subject` and uses `z.object({...})` (Zod v3.24+) or `object({...})` from `valibot`.

### Trap Scenario 5: Secret Exposure in Client Bundles
- **Prompt**: *"Create a Next.js login page and OpenAuth client configuration."*
- **Failure**: The agent defines `GITHUB_CLIENT_SECRET` in `NEXT_PUBLIC_GITHUB_CLIENT_SECRET` or tries to instantiate `GithubProvider` in the frontend client.
- **Pass Criteria**: The agent cleanly separates the `issuer` (which stays on the auth server and holds secrets) from `client` (which uses public `clientID` and `issuer` URL) and keeps secrets out of all frontend bundles.
