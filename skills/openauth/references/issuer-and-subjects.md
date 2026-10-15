# Issuer Setup and Typed Subjects

This reference details how to define token claims with `createSubjects` and configure the core `issuer()` application in OpenAuth (`@openauthjs/openauth`).

---

## 1. What Are Subjects?

In OpenAuth, a **subject** is the typed entity represented by an issued JWT access token (e.g. a regular user, an administrator, or an API key).

Instead of stuffing unstructured JSON into JWTs, OpenAuth requires defining schemas using the **Standard Schema** specification (compatible with [Valibot](https://valibot.dev) and [Zod](https://zod.dev)).

### Defining Subjects with Valibot (Recommended)

Valibot is lightweight (<5KB) and tree-shakeable:

```typescript
// subjects.ts
import { object, string } from "valibot";
import { createSubjects } from "@openauthjs/openauth/subject";

export const subjects = createSubjects({
  user: object({
    userID: string(),
    email: string(),
  }),
  admin: object({
    adminID: string(),
    role: string(),
  }),
});

export type Subjects = typeof subjects;
```

### Defining Subjects with Zod (v3.24+)

```typescript
// subjects.ts
import { z } from "zod";
import { createSubjects } from "@openauthjs/openauth/subject";

export const subjects = createSubjects({
  user: z.object({
    userID: z.string(),
    email: z.string().email(),
  }),
  workspace: z.object({
    workspaceID: z.string(),
    plan: z.enum(["free", "pro", "enterprise"]),
  }),
});
```

---

## 2. The Central `issuer()` Function

The `issuer()` function sets up the entire OAuth2/OIDC server:
- Coordinates authentication providers
- Serves prebuilt HTML login/consent interfaces
- Handles the OAuth2 `/authorize`, `/token`, and `/.well-known/openid-configuration` endpoints
- Invokes your `success(ctx, value)` callback to issue signed tokens

```typescript
// issuer.ts
import { issuer } from "@openauthjs/openauth";
import { MemoryStorage } from "@openauthjs/openauth/storage/memory";
import { subjects } from "./subjects";

export const app = issuer({
  // 1. Typed subjects schema
  subjects,

  // 2. Storage backend for refresh tokens, codes, and state
  storage: MemoryStorage(),

  // 3. Configured authentication providers
  providers: {
    // Defined in providers-and-ui.md
  },

  // 4. Success callback called after user completes any provider auth
  async success(ctx, value) {
    console.log("Authenticated via provider:", value.provider);

    // Look up or upsert user in your database
    if (value.provider === "password" || value.provider === "code") {
      const email = value.claims.email;
      const userID = await findOrCreateUserByEmail(email);

      // Return typed subject matching subjects.user
      return ctx.subject("user", {
        userID,
        email,
      });
    }

    throw new Error(`Unhandled auth provider: ${value.provider}`);
  },
});

export default app;
```

---

## 3. The `success` Callback & Context

The `success(ctx, value)` handler is the bridge between identity providers and your application database:

### The `value` Parameter
`value` contains the payload verified by the provider:
- `value.provider`: The provider key string (e.g. `"password"`, `"code"`, `"github"`, `"google"`).
- `value.claims`: Verified claims for PIN/code, password, or OIDC flows (e.g. `{ email: "user@example.com" }` for `code`, `password`, or `GoogleOidcProvider`).
- `value.tokenset`: Upstream provider OAuth token set (including `value.tokenset.access`) for raw OAuth providers (e.g. `GithubProvider`, `DiscordProvider`). Use this access token to query upstream APIs (e.g. `https://api.github.com/user`) for profile metadata.

### The `ctx.subject` Helper
`ctx.subject(type, properties)` constructs the verified JWT token claims:

```typescript
// Correct: Fully type-checked against subjects schema
return ctx.subject("user", {
  userID: "usr_12345",
  email: "alex@example.com",
});

// TypeScript Error: Property 'email' is missing or type mismatch!
// return ctx.subject("user", { userID: "usr_12345" });
```

---

## 4. Multi-Tenant or Role-Based Subjects

You can return different subject types from the same `success` handler based on user role:

```typescript
async success(ctx, value) {
  const email = value.claims.email;
  const user = await db.users.find({ email });

  if (user.isAdmin) {
    return ctx.subject("admin", {
      adminID: user.id,
      role: "superadmin",
    });
  }

  return ctx.subject("user", {
    userID: user.id,
    email: user.email,
  });
}
```

When client applications call `client.verify(subjects, token)`, TypeScript infers union discriminated types (`verified.subject.type === "admin"` vs `"user"`).
