import { createMimeMessage } from "mimetext";
import { EmailMessage } from "cloudflare:email";
import { isAutomatedEmail } from "./safety.js";

export default {
  /**
   * Cloudflare Email Routing Worker handler
   *
   * @param {import("@cloudflare/workers-types").ForwardableEmailMessage} message
   * @param {object} env
   * @param {ExecutionContext} ctx
   */
  async email(message, env, ctx) {
    const from = message.from;
    const to = message.to;
    const subject = message.headers.get("Subject") || "Inquiry";
    const messageId = message.headers.get("Message-ID");

    console.log(`[INBOUND EMAIL] From: ${from} | To: ${to} | Subject: "${subject}"`);

    // 1. Mandatory Loop Protection: Never reply to automated responders or mailer-daemons
    if (isAutomatedEmail(message.headers, from)) {
      console.log(`[LOOP GUARD] Skipping auto-reply for automated message from ${from}`);
      return;
    }

    // 2. Build Threaded RFC 5322 Reply with mimetext
    const replyMime = createMimeMessage();
    const senderAddr = to.includes("@") ? to : "support@yourdomain.com";

    replyMime.setSender({ name: "AI Support Assistant", addr: senderAddr });
    replyMime.setRecipient(from);

    // Threading headers
    if (messageId) {
      replyMime.setHeader("In-Reply-To", messageId);
      replyMime.setHeader("References", messageId);
    }

    // Threading subject prefix
    const replySubject = subject.toLowerCase().startsWith("re:")
      ? subject
      : `Re: ${subject}`;
    replyMime.setSubject(replySubject);

    // Plain text reply body
    replyMime.addMessage({
      contentType: "text/plain",
      data: [
        `Hi there,`,
        ``,
        `Thank you for contacting us regarding "${subject}".`,
        `This is an automated confirmation that our AI support system has received your inquiry.`,
        `A member of our team or our triage agent will follow up shortly.`,
        ``,
        `Best regards,`,
        `Customer Support Team`,
      ].join("\n"),
    });

    // 3. Send threaded reply via cloudflare:email
    try {
      const replyEmail = new EmailMessage(senderAddr, from, replyMime.asRaw());
      await message.reply(replyEmail);
      console.log(`[OUTBOUND EMAIL] Threaded reply sent to ${from}`);
    } catch (err) {
      console.error(`[OUTBOUND ERROR] Failed to send reply to ${from}:`, err);
    }
  },
};
