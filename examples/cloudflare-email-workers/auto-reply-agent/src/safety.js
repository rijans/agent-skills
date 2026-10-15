/**
 * Evaluates whether an incoming email was automatically generated
 * (e.g. vacation notices, bounce messages, mailer-daemon, auto-replies)
 * to prevent catastrophic infinite auto-responder loops.
 *
 * @param {Headers} headers
 * @param {string} fromAddress
 * @returns {boolean}
 */
export function isAutomatedEmail(headers, fromAddress) {
  // 1. Check RFC 3834 Auto-Submitted header
  const autoSubmitted = headers.get("Auto-Submitted")?.toLowerCase();
  if (autoSubmitted && autoSubmitted !== "no") {
    return true;
  }

  // 2. Check Precedence header
  const precedence = headers.get("Precedence")?.toLowerCase();
  if (precedence && ["bulk", "list", "junk", "auto_reply"].includes(precedence)) {
    return true;
  }

  // 3. Check X-Autoreply headers
  if (headers.get("X-Autoreply") || headers.get("X-Autorespond")) {
    return true;
  }

  // 4. Known automated senders
  const from = (fromAddress || "").toLowerCase();
  const automatedBots = [
    "mailer-daemon@",
    "postmaster@",
    "no-reply@",
    "noreply@",
    "donotreply@",
    "bounce@",
  ];

  return automatedBots.some((bot) => from.includes(bot));
}
