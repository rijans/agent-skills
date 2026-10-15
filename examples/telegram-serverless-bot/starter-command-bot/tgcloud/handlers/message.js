import { api } from "sdk";

export default async function (message, ctx) {
  if (typeof message.text !== "string") return;

  const text = message.text.trim();
  const chatId = message.chat.id;

  if (text.startsWith("/start")) {
    return api.sendMessage({
      chat_id: chatId,
      text: "👋 **Welcome to your Telegram Serverless Bot!**\n\nRunning in instant V8 JavaScript isolates with zero server management.",
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
    });
  }

  if (text.startsWith("/help")) {
    return api.sendMessage({
      chat_id: chatId,
      text: "ℹ️ **Commands:**\n/start - Open main menu\n/help - Show this help\n/ping - Measure isolate response",
      parse_mode: "Markdown"
    });
  }

  if (text.startsWith("/ping")) {
    return api.sendMessage({
      chat_id: chatId,
      text: "🏓 Pong! Handler executed in Telegram V8 isolate."
    });
  }
}
