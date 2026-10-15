import PostalMime from "postal-mime";

export default {
  /**
   * Cloudflare Email Routing Worker that parses incoming emails
   * and saves PDF/image attachments directly to Cloudflare R2 storage.
   *
   * @param {import("@cloudflare/workers-types").ForwardableEmailMessage} message
   * @param {object} env
   * @param {ExecutionContext} ctx
   */
  async email(message, env, ctx) {
    // 1. Guard against memory exhaustion
    const MAX_SIZE = 15 * 1024 * 1024; // 15MB
    if (message.rawSize > MAX_SIZE) {
      console.warn(`[REJECT] Email size ${message.rawSize} bytes exceeds ${MAX_SIZE} byte limit.`);
      message.setReject("552 5.3.4 Message exceeds maximum size allowed");
      return;
    }

    // 2. Parse MIME structure using postal-mime
    const parser = new PostalMime();
    const email = await parser.parse(message.raw);

    const fromAddress = email.from?.address || message.from;
    const subject = email.subject || "No Subject";
    const attachments = email.attachments || [];

    console.log(`[INBOUND INVOICE] From: ${fromAddress} | Attachments: ${attachments.length}`);

    // 3. Process attachments and stream to R2
    let savedCount = 0;
    for (const attachment of attachments) {
      const isInvoiceType =
        attachment.mimeType.includes("pdf") ||
        attachment.mimeType.startsWith("image/") ||
        (attachment.filename && attachment.filename.toLowerCase().endsWith(".pdf"));

      if (!isInvoiceType) {
        continue;
      }

      const safeName = (attachment.filename || "invoice.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const storageKey = `invoices/${timestamp}_${safeName}`;

      console.log(`[R2 UPLOAD] Storing attachment: ${storageKey} (${attachment.content.byteLength} bytes)`);

      if (env.INVOICES_BUCKET) {
        await env.INVOICES_BUCKET.put(storageKey, attachment.content, {
          httpMetadata: {
            contentType: attachment.mimeType,
          },
          customMetadata: {
            sender: fromAddress,
            subject: subject,
            receivedAt: new Date().toISOString(),
          },
        });
        savedCount++;
      }
    }

    console.log(`[DONE] Successfully archived ${savedCount} invoice attachment(s) to R2.`);
  },
};
