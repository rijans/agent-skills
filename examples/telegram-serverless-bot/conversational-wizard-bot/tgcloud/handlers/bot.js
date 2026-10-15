import api from "sdk/api";
import db from "sdk/db";
import { getSession, setSession, clearSession } from "../lib/fsm.js";

export default async function (ctx) {
  const update = ctx.update;
  if (!update || !update.message?.text) return;

  const msg = update.message;
  const text = msg.text.trim();
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  // Handle global commands
  if (text === "/cancel") {
    clearSession(userId);
    return api.sendMessage(chatId, "❌ Cancelled. Type /join to start onboarding.");
  }

  if (text === "/join" || text === "/start") {
    setSession(userId, "onboarding", "ask_name", {});
    return api.sendMessage(
      chatId,
      "👋 Welcome to the onboarding wizard!\nWhat is your full name? (Type /cancel to abort)"
    );
  }

  // Check active conversational state
  const session = getSession(userId);
  if (!session || session.state !== "onboarding") {
    return api.sendMessage(chatId, "Type /join to register or /help for commands.");
  }

  // Step 1: Receiving name
  if (session.step === "ask_name") {
    if (text.length < 2 || text.length > 40) {
      return api.sendMessage(chatId, "⚠️ Please provide a valid name (2-40 characters):");
    }
    setSession(userId, "onboarding", "ask_email", { name: text });
    return api.sendMessage(chatId, `Nice to meet you, ${text}!\nNow, please enter your email address:`);
  }

  // Step 2: Receiving email
  if (session.step === "ask_email") {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(text)) {
      return api.sendMessage(chatId, "⚠️ Please enter a valid email address (e.g., alex@example.com):");
    }

    const { name } = session.data;

    // Persist final record in SQLite
    db.query(
      "INSERT INTO members (user_id, name, email, created_at) VALUES (?, ?, ?, ?)",
      [userId, name, text, Math.floor(Date.now() / 1000)]
    );

    // Clean up session
    clearSession(userId);

    return api.sendMessage(
      chatId,
      `🎉 **Welcome aboard, ${name}!**\nYour profile has been saved to SQLite.\nEmail: \`${text}\``,
      { parse_mode: "Markdown" }
    );
  }
}
