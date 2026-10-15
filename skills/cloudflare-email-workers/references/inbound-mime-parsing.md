# Inbound MIME Parsing and Attachment Extraction

This reference details how to parse raw RFC 5322 email streams using `postal-mime`, extract plain text / HTML content, and archive attachments to Cloudflare R2 object storage without exceeding V8 isolate memory limits.

---

## 1. Why `postal-mime`?

Traditional Node.js email parsing packages (such as `mailparser` or `emailjs`) rely on Node `stream.Readable`, heavy Buffer transformations, or C++ native modules that either fail to compile in Cloudflare Workers or crash with Out-Of-Memory errors.

[**`postal-mime`**](https://github.com/postalsys/postal-mime) is a lightweight, zero-dependency parser written for web standards and modern V8 engines. It directly accepts browser / Workers `ReadableStream` or `ArrayBuffer` inputs.

### Installation

```bash
npm install postal-mime
```

---

## 2. Parsing the Raw Email Stream

Pass `message.raw` directly to `PostalMime.parse()`:

```typescript
import PostalMime from "postal-mime";
import { ForwardableEmailMessage } from "@cloudflare/workers-types";

export interface Env {
  ATTACHMENTS_BUCKET: R2Bucket;
}

export default {
  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
    // 1. Memory guard: check email size before parsing
    const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
    if (message.rawSize > MAX_SIZE_BYTES) {
      console.warn(`Email exceeds ${MAX_SIZE_BYTES} bytes (${message.rawSize}). Rejecting.`);
      message.setReject("552 5.3.4 Message size exceeds maximum allowed limit");
      return;
    }

    // 2. Parse raw stream with postal-mime
    const parser = new PostalMime();
    const email = await parser.parse(message.raw);

    console.log("Parsed Subject:", email.subject);
    console.log("Sender Name:", email.from.name);
    console.log("Sender Address:", email.from.address);
    console.log("Plain Text Body:", email.text?.slice(0, 100));
  },
};
```

---

## 3. Parsed Email Schema

`postal-mime` returns a clean, typed representation of the email:

```typescript
interface ParsedEmail {
  headers: Array<{ key: string; value: string }>;
  from: { name: string; address: string };
  to: Array<{ name: string; address: string }>;
  cc?: Array<{ name: string; address: string }>;
  bcc?: Array<{ name: string; address: string }>;
  subject?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
  date?: string;
  text?: string;        // Clean plain text body without HTML tags
  html?: string;        // Raw HTML body content
  attachments: Array<{
    filename?: string;
    mimeType: string;
    disposition?: "attachment" | "inline";
    related?: boolean;
    contentId?: string;
    content: ArrayBuffer; // Binary content of the attachment
  }>;
}
```

---

## 4. Archiving Attachments to Cloudflare R2

When handling inbound invoices, photos, or documents, upload attachment buffers directly to Cloudflare R2:

```typescript
// Archiving attachments to Cloudflare R2
for (const attachment of email.attachments) {
  const safeFilename = (attachment.filename || "unnamed-file").replace(/[^a-zA-Z0-9._-]/g, "_");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const storageKey = `inbound/${timestamp}_${safeFilename}`;

  console.log(`Saving attachment to R2: ${storageKey} (${attachment.mimeType})`);

  await env.ATTACHMENTS_BUCKET.put(storageKey, attachment.content, {
    httpMetadata: {
      contentType: attachment.mimeType,
    },
    customMetadata: {
      sender: email.from.address,
      subject: email.subject || "No Subject",
      receivedAt: new Date().toISOString(),
    },
  });
}
```

---

## 5. Storing Extracted Inquiries in Cloudflare D1 or KV

To record metadata or feed incoming tickets into an AI triage queue:

```typescript
// Example: Insert metadata into Cloudflare D1 SQL database
await env.DB.prepare(`
  INSERT INTO incoming_emails (sender, recipient, subject, body_snippet, created_at)
  VALUES (?, ?, ?, ?, datetime('now'))
`).bind(
  email.from.address,
  message.to,
  email.subject || "No Subject",
  email.text ? email.text.slice(0, 500) : null
).run();
```
