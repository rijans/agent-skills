import { api, db } from "sdk";
import { getSession, setSession, clearSession } from "../lib/fsm.js";
import { members } from "../schema.js";

export default async function (message, ctx) {
  if (typeof message.text !== "string" || !message.from) return;

  const text = message.text.trim();
  const userId = message.from.id;
  const chatId = message.chat.id;

  // Handle global commands
  if (text === "/cancel") {
    await clearSession(userId);
    return api.sendMessage({
      chat_id: chatId,
      text: "❌ Cancelled. Type /join to start onboarding."
    });
  }

  if (text === "/join" || text === "/start") {
    await setSession(userId, "onboarding", "ask_name", {});
    return api.sendMessage({
      chat_id: chatId,
      text: "👋 Welcome to the onboarding wizard!\nWhat is your full name? (Type /cancel to abort)"
    });
  }

  // Check active conversational state
  const session = await getSession(userId);
  if (!session || session.state !== "onboarding") {
    return api.sendMessage({
      chat_id: chatId,
      text: "Type /join to register or /help for commands."
    });
  }

  // Step 1: Receiving name
  if (session.step === "ask_name") {
    if (text.length < 2 || text.length > 40) {
      return api.sendMessage({
        chat_id: chatId,
        text: "⚠️ Please provide a valid name (2-40 characters):"
      });
    }
    await setSession(userId, "onboarding", "ask_email", { name: text });
    return api.sendMessage({
      chat_id: chatId,
      text: `Nice to meet you, ${text}!\nNow, please enter your email address:`
    });
  }

  // Step 2: Receiving email
  if (session.step === "ask_email") {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(text)) {
      return api.sendMessage({
        chat_id: chatId,
        text: "⚠️ Please enter a valid email address (e.g., alex@example.com):"
      });
    }

    const { name } = session.data;

    // Persist final record in SQLite
    await db.insert(members)
      .values({
        userId,
        name,
        email: text,
      })
      .onConflictDoNothing()
      .run();

    // Clean up session
    await clearSession(userId);

    return api.sendMessage({
      chat_id: chatId,
      text: `🎉 **Welcome aboard, ${name}!**\nYour profile has been saved to SQLite.\nEmail: \`${text}\``,
      parse_mode: "Markdown"
    });
  }
}
