import api from "sdk/api";
import db from "sdk/db";

export default async function (ctx) {
  const update = ctx.update;
  if (!update) return;

  // Phase 1: Handle command to purchase digital goods
  if (update.message?.text?.startsWith("/buy")) {
    const chatId = update.message.chat.id;
    return api.sendInvoice(chatId, {
      title: "⭐ Premium Pass (100 Stars)",
      description: "Unlock premium bot commands and priority compute for 30 days.",
      payload: "order:premium_pass",
      currency: "XTR",
      prices: [{ label: "Premium Pass", amount: 100 }]
    });
  }

  // Phase 2: Pre-checkout query verification (<10s window)
  if (update.pre_checkout_query) {
    const query = update.pre_checkout_query;
    if (query.invoice_payload === "order:premium_pass") {
      return api.answerPreCheckoutQuery(query.id, { ok: true });
    }
    return api.answerPreCheckoutQuery(query.id, {
      ok: false,
      error_message: "Item unavailable."
    });
  }

  // Phase 3: Successful payment fulfillment
  if (update.message?.successful_payment) {
    const payment = update.message.successful_payment;
    const chatId = update.message.chat.id;
    const userId = update.message.from.id;

    // Record order in SQLite
    db.query(
      `INSERT INTO star_orders (charge_id, user_id, amount_stars, product_id, status, created_at)
       VALUES (?, ?, ?, ?, 'paid', ?)`,
      [
        payment.telegram_payment_charge_id,
        userId,
        payment.total_amount,
        payment.invoice_payload,
        Math.floor(Date.now() / 1000)
      ]
    );

    return api.sendMessage(
      chatId,
      `🎉 **Thank you!** Received **${payment.total_amount} Telegram Stars**.\nCharge ID: \`${payment.telegram_payment_charge_id}\``,
      { parse_mode: "Markdown" }
    );
  }
}
