import { api } from "sdk";

export default async function (query, ctx) {
  const data = query.data || "";
  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;

  // Immediately acknowledge callback query
  await api.answerCallbackQuery({
    callback_query_id: query.id,
    text: "Acknowledged!"
  });

  if (data === "cmd:ping") {
    await api.editMessageText({
      chat_id: chatId,
      message_id: messageId,
      text: "🏓 **Pong!** Latency is near zero in-datacenter.",
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "⬅️ Back", callback_data: "cmd:back" }]
        ]
      }
    });
  }

  if (data === "cmd:help" || data === "cmd:back") {
    await api.editMessageText({
      chat_id: chatId,
      message_id: messageId,
      text: "👋 **Welcome to your Telegram Serverless Bot!**",
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
