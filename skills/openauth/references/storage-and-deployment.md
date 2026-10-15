# Storage Adapters and Serverless Deployment

OpenAuth is built on Hono and can be deployed to any runtime environment: Cloudflare Workers, Node.js, Bun, or AWS Lambda.

---

## 1. Storage Backend Adapters

OpenAuth stores ephemeral authorization codes, refresh tokens, and password records. The storage adapter dictates persistence across serverless executions.

### Storage Options Matrix

| Storage Adapter | Target Runtime | Persistence Model | Use Case |
|---|---|---|---|
| **`MemoryStorage`** | Node.js, Bun | In-memory `Map` | Local development, automated unit tests. **Never for serverless production.** |
| **`CloudflareStorage`** | Cloudflare Workers | Cloudflare KV | Production edge deployments with global replication and zero infrastructure. |
| **`DynamoStorage`** | AWS Lambda | AWS DynamoDB | High-scale AWS deployments managed via SST or AWS CDK. |

### Configuring Cloudflare KV Storage

```typescript
// issuer.ts (Cloudflare Workers)
import { issuer } from "@openauthjs/openauth";
import { CloudflareStorage } from "@openauthjs/openauth/storage/cloudflare";
import { subjects } from "./subjects";

export interface Env {
  AUTH_KV: KVNamespace;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const app = issuer({
      subjects,
      storage: CloudflareStorage({
        namespace: env.AUTH_KV,
      }),
      providers: {
        // ...
      },
      async success(ctx, value) {
        // ...
      },
    });

    return app.fetch(request, env, ctx);
  },
};
```

---

## 2. Deployment Recipe A: Cloudflare Workers

Cloudflare Workers provides sub-10ms global edge latency for authentication.

### `wrangler.jsonc`

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "openauth-server",
  "main": "src/index.ts",
  "compatibility_date": "2026-10-01",
  "compatibility_flags": ["nodejs_compat"],
  "kv_namespaces": [
    {
      "binding": "AUTH_KV",
      "id": "your-kv-namespace-id"
    }
  ]
}
```

Deploying:
```bash
npx wrangler kv namespace create AUTH_KV
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler deploy
```

---

## 3. Deployment Recipe B: Bun

Bun natively supports Hono applications via `{ fetch: app.fetch }`:

```typescript
// server.ts
import { issuer } from "@openauthjs/openauth";
import { MemoryStorage } from "@openauthjs/openauth/storage/memory";
import { subjects } from "./subjects";

const app = issuer({
  subjects,
  storage: MemoryStorage(),
  providers: { /* ... */ },
  success: async (ctx, value) => { /* ... */ },
});

export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
};
```

Running in Bun:
```bash
bun run server.ts
```

---

## 4. Deployment Recipe C: Node.js (Docker / VPS)

Using `@hono/node-server` to run on any Node.js environment:

```typescript
// server.ts
import { serve } from "@hono/node-server";
import { issuer } from "@openauthjs/openauth";
import { MemoryStorage } from "@openauthjs/openauth/storage/memory";
import { subjects } from "./subjects";

const app = issuer({
  subjects,
  storage: MemoryStorage(),
  providers: { /* ... */ },
  success: async (ctx, value) => { /* ... */ },
});

const port = Number(process.env.PORT) || 3000;
console.log(`OpenAuth server running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
```

---

## 5. Deployment Recipe D: AWS Lambda

Using `hono/aws-lambda` and DynamoDB for serverless AWS deployments:

```typescript
// lambda.ts
import { handle } from "hono/aws-lambda";
import { issuer } from "@openauthjs/openauth";
import { DynamoStorage } from "@openauthjs/openauth/storage/dynamo";
import { subjects } from "./subjects";

const app = issuer({
  subjects,
  storage: DynamoStorage({
    table: process.env.AUTH_DYNAMO_TABLE!,
  }),
  providers: { /* ... */ },
  success: async (ctx, value) => { /* ... */ },
});

export const handler = handle(app);
```

---

## 6. Production Security Checklist

1. **Custom Auth Domain**: Deploy auth under a dedicated subdomain (e.g. `auth.yourdomain.com`).
2. **Cookie Scoping**: Use `SameSite=Lax` and `Secure=true` for all auth session cookies to prevent CSRF attacks.
3. **KV Expiration TTL**: Cloudflare KV storage keys are automatically marked with expiration timestamps by OpenAuth to prevent storage leaks.
4. **CORS Allowlist**: Do not allow wildcard CORS (`*`) on client-facing callback endpoints.
