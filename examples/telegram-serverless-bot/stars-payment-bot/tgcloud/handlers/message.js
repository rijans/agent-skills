import { api, db } from "sdk";
import { starOrders } from "../schema.js";

export default async function (message, ctx) {
  const chatId = message.chat.id;

  // 1. Process successful payment fulfillment
  if (message.successful_payment) {
    const payment = message.successful_payment;
    const userId = message.from.id;
    const chargeId = payment.telegram_payment_charge_id;

    // Idempotent write: onConflictDoNothing prevents duplicate crediting on update retries
    const [claimed] = await db.insert(starOrders)
      .values({
        chargeId,
        userId,
        amountStars: payment.total_amount,
        productId: payment.invoice_payload,
        status: "paid",
      })
      .onConflictDoNothing()
      .returning()
      .run();

    if (claimed) {
      return api.sendMessage({
        chat_id: chatId,
        text: `🎉 **Thank you!** Received **${payment.total_amount} Telegram Stars**.\nCharge ID: \`${chargeId}\``,
        parse_mode: "Markdown"
      });
    }
    return;
  }

  // 2. Command to purchase digital goods with Stars
  if (message.text?.startsWith("/buy")) {
    return api.sendInvoice({
      chat_id: chatId,
      title: "⭐ Premium Pass (100 Stars)",
      description: "Unlock premium bot commands and priority compute for 30 days.",
      payload: "order:premium_pass",
      currency: "XTR",
      prices: [{ label: "Premium Pass", amount: 100 }]
    });
  }
}
