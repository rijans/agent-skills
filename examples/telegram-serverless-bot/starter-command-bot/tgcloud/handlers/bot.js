import api from "sdk/api";

export default async function (ctx) {
  const update = ctx.update;
  if (!update) return;

  // 1. Text command handling
  if (update.message?.text) {
    const text = update.message.text.trim();
    const chatId = update.message.chat.id;

    if (text.startsWith("/start")) {
      return api.sendMessage(
        chatId,
        "👋 **Welcome to your Telegram Serverless Bot!**\n\nRunning in instant V8 JavaScript isolates with zero server management.",
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "⚡ Check Ping", callback_data: "cmd:ping" },
                { text: "ℹ️ Help", callback_data: "cmd:help" }
              ],
              [
                { text: "📖 Telegram Serverless Docs", url: "https://core.telegram.org/bots/serverless" }
              ]
            ]
          }
        }
      );
    }

    if (text.startsWith("/help")) {
      return api.sendMessage(
        chatId,
        "ℹ️ **Commands:**\n/start - Open main menu\n/help - Show this help\n/ping - Measure isolate response",
        { parse_mode: "Markdown" }
      );
    }

    if (text.startsWith("/ping")) {
      return api.sendMessage(chatId, "🏓 Pong! Handler executed in Telegram V8 isolate.");
    }
  }

  // 2. Inline keyboard callback query handling
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message?.chat?.id;
    const messageId = cb.message?.message_id;

    // Immediately acknowledge callback query
    await api.answerCallbackQuery(cb.id, { text: "Acknowledged!" });

    if (cb.data === "cmd:ping") {
      await api.editMessageText("🏓 **Pong!** Latency is near zero in-datacenter.", {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "⬅️ Back", callback_data: "cmd:back" }]
          ]
        }
      });
    }

    if (cb.data === "cmd:help" || cb.data === "cmd:back") {
      await api.editMessageText("👋 **Welcome to your Telegram Serverless Bot!**", {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⚡ Check Ping", callback_data: "cmd:ping" },
              { text: "ℹ️ Help", callback_data: "cmd:help" }
            ]
          ]
        }
      });
    }
  }
}
