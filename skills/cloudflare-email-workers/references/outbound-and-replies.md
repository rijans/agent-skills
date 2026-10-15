# Outbound Replies and RFC 5322 Threading

This reference details how to send outbound transactional emails and construct properly threaded conversation replies using Cloudflare's `send_email` binding, `EmailMessage` from `cloudflare:email`, and `mimetext`.

---

## 1. Wrangler Configuration (`send_email` Binding)

To enable outbound email sending in your Worker:

```jsonc
// wrangler.jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "email-responder",
  "main": "src/index.ts",
  "compatibility_date": "2026-10-01",
  "compatibility_flags": ["nodejs_compat"],
  "send_email": [
    {
      "name": "EMAIL"
    }
  ]
}
```

> [!IMPORTANT]
> The sender domain must be configured and active on your Cloudflare account. Sending from unverified external domains (e.g. `@gmail.com` or `@yahoo.com`) will result in rejection by Cloudflare's mail transfer agent.

---

## 2. Generating RFC 5322 Compliant Messages with `mimetext`

Hand-crafting raw email strings with boundary delimiters, `\r\n` line endings, and 76-character base64 line wrapping frequently breaks in mail clients.

Use [**`mimetext`**](https://github.com/muratgozel/mimetext) to construct standards-compliant multipart emails:

```bash
npm install mimetext
```

### Building a Multipart (Text + HTML) Email

```typescript
import { createMimeMessage } from "mimetext";

export function buildWelcomeEmail(recipient: string, name: string): string {
  const msg = createMimeMessage();

  msg.setSender({ name: "Support Team", addr: "support@yourdomain.com" });
  msg.setRecipient(recipient);
  msg.setSubject("Welcome to our service!");

  // Plain-text alternative for screen readers and text clients
  msg.addMessage({
    contentType: "text/plain",
    data: `Hello ${name},\n\nThank you for signing up!\n\nBest,\nSupport Team`,
  });

  // Rich HTML version
  msg.addMessage({
    contentType: "text/html",
    data: `<h1>Hello ${name},</h1><p>Thank you for signing up!</p><p>Best,<br>Support Team</p>`,
  });

  return msg.asRaw();
}
```

---

## 3. RFC 5322 Threading Rules for Conversation Replies

For email clients (Gmail, Apple Mail, Outlook) to group incoming replies into the **same conversation thread**, an email reply MUST adhere to three rules:

1. **`In-Reply-To` Header**: Must contain the `Message-ID` of the inbound email (e.g. `<abc123xyz@mail.gmail.com>`).
2. **`References` Header**: Must contain the original `Message-ID` (or chain of message IDs).
3. **`Subject` Prefix**: Should begin with `Re: ` prepended to the original subject.

### Threaded Auto-Reply Implementation

```typescript
import { createMimeMessage } from "mimetext";
import { EmailMessage } from "cloudflare:email";
import { ForwardableEmailMessage } from "@cloudflare/workers-types";

export interface Env {
  EMAIL: SendEmail;
}

export default {
  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
    const originalMessageId = message.headers.get("Message-ID");
    const originalSubject = message.headers.get("Subject") || "Inquiry";

    // 1. Construct reply email with threading headers
    const replyMime = createMimeMessage();
    replyMime.setSender({ name: "AI Support Agent", addr: "support@yourdomain.com" });
    replyMime.setRecipient(message.from);

    // Threading Header 1: In-Reply-To
    if (originalMessageId) {
      replyMime.setHeader("In-Reply-To", originalMessageId);
      // Threading Header 2: References
      replyMime.setHeader("References", originalMessageId);
    }

    // Threading Header 3: Re: subject prefix
    const replySubject = originalSubject.toLowerCase().startsWith("re:")
      ? originalSubject
      : `Re: ${originalSubject}`;
    replyMime.setSubject(replySubject);

    // Reply content
    replyMime.addMessage({
      contentType: "text/plain",
      data: `Hi there,\n\nWe received your inquiry regarding "${originalSubject}". Our AI agent is reviewing it now.\n\nBest,\nSupport Team`,
    });

    // 2. Wrap in EmailMessage from cloudflare:email
    const replyEmail = new EmailMessage(
      "support@yourdomain.com",
      message.from,
      replyMime.asRaw()
    );

    // 3. Send using message.reply() or env.EMAIL.send()
    await message.reply(replyEmail);
  },
};
```

---

## 4. `message.reply()` vs. `env.EMAIL.send()`

| Method | Context | Use Case |
|---|---|---|
| **`message.reply(replyEmail)`** | Inside `email()` handler only | Replying directly to the active inbound message event. Uses the inbound message context. |
| **`env.EMAIL.send(replyEmail)`** | Any handler (`fetch`, `scheduled`, `queue`, `email`) | Triggering outbound emails independently (e.g. password resets, scheduled summaries, webhook notifications). |
