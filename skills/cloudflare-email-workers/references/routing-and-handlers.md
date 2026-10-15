# Routing Rules and Handlers

This reference explains how to configure Cloudflare Email Routing Workers, intercept incoming emails via the `email()` handler, forward to external destinations, and reject unauthorized senders.

---

## 1. The `email(message, env, ctx)` Handler Lifecycle

When an email arrives at a custom domain configured with Cloudflare Email Routing and a Worker rule, Cloudflare boots a V8 isolate and invokes the `email()` method on the default export:

```typescript
// src/index.ts
import { ForwardableEmailMessage } from "@cloudflare/workers-types";

export interface Env {
  SUPPORT_EMAIL: string;
}

export default {
  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`Email from: ${message.from} to: ${message.to}`);
    console.log(`Subject: ${message.headers.get("subject")}`);

    // Inspect recipient address and route accordingly
    if (message.to.startsWith("billing@")) {
      await message.forward("finance-team@internal.company.com");
      return;
    }

    if (message.to.startsWith("security@")) {
      await message.forward("secops@internal.company.com");
      return;
    }

    // Default catch-all forwarding
    await message.forward(env.SUPPORT_EMAIL);
  },

  // Workers can simultaneously handle HTTP and Email traffic
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return new Response("Email Worker is active", { status: 200 });
  },
};
```

---

## 2. The `ForwardableEmailMessage` Interface

The `message` argument implements the `ForwardableEmailMessage` interface:

| Property / Method | Type | Description |
|---|---|---|
| **`message.from`** | `string` | The envelope sender email address (e.g. `customer@gmail.com`). |
| **`message.to`** | `string` | The envelope recipient address on your custom domain (e.g. `support@yourdomain.com`). |
| **`message.headers`** | `Headers` | Standard Fetch `Headers` object representing email headers (e.g. `message.headers.get("subject")`). |
| **`message.raw`** | `ReadableStream` | The raw RFC 5322 byte stream containing the complete email, MIME parts, and attachments. |
| **`message.rawSize`** | `number` | Byte length of the raw email message. |
| **`message.forward()`** | `(rcptTo, headers?) => Promise<void>` | Forwards the raw email to a verified destination address, optionally modifying or appending headers. |
| **`message.reply()`** | `(replyMessage) => Promise<void>` | Sends a reply email directly to the sender. |
| **`message.setReject()`** | `(reason: string) => void` | Rejects the email during SMTP conversation with a bounce message. |

---

## 3. Forwarding to Verified Destinations (`message.forward`)

Cloudflare Email Routing requires that any destination email address passed to `message.forward()` must be a **verified destination address** configured in the Cloudflare Dashboard:

```typescript
// Forwarding with custom audit headers
const newHeaders = new Headers(message.headers);
newHeaders.set("X-Filtered-By", "Cloudflare-AI-Worker");
newHeaders.set("X-Original-Recipient", message.to);

await message.forward("verified-team-inbox@example.com", newHeaders);
```

> [!NOTE]
> If `message.forward()` is called with an unverified destination email address, Cloudflare throws an exception.

---

## 4. Rejecting Spam and Prohibited Senders (`message.setReject`)

To reject unwanted, blocklisted, or unauthenticated emails:

```typescript
// Check blocklist or spam score
const isSpamSender = await env.BLOCKLIST_KV.get(message.from);

if (isSpamSender) {
  // Sets SMTP rejection response: 550 5.7.1 Message rejected by recipient policy
  message.setReject("550 5.7.1 Sender address is blocklisted");
  return;
}
```

---

## 5. Wrangler Configuration (`wrangler.jsonc`)

To configure and deploy an Email Worker:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "email-router",
  "main": "src/index.ts",
  "compatibility_date": "2026-10-01",
  "compatibility_flags": ["nodejs_compat"]
}
```

Deploying:
```bash
npx wrangler deploy
```

Once deployed, go to **Cloudflare Dashboard** $\rightarrow$ **Email Routing** $\rightarrow$ **Routing Rules** and add a rule pointing to your deployed Worker.
