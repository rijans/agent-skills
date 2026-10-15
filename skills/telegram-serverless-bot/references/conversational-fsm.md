# Conversational FSM and Multi-Step Dialogs

Because Telegram Serverless executes in stateless V8 isolates that spin up and down on demand, in-memory state (`let userState = {}`) is lost between webhook events.

Multi-step conversational wizards (registration forms, surveys, booking flows, checkout steps) must persist state in the built-in SQLite database using the query builder (`db` from `sdk`, schema from `sdk/db`).

---

## 1. Standard SQLite Session Schema (`tgcloud/schema.js`)

Define a session table in `tgcloud/schema.js`:

```javascript
import { table, integer, text, sql } from "sdk/db";

export const userSessions = table("user_sessions", {
  userId: integer("user_id").primaryKey(),
  state: text("state").notNull(),            // e.g. "onboarding", "booking", "feedback"
  step: text("step").notNull(),              // e.g. "ask_name", "ask_email"
  payload: text("payload"),                  // JSON string with collected intermediate data
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const members = table("members", {
  userId: integer("user_id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});
```

---

## 2. Reusable Session Helpers (`tgcloud/lib/session.js`)

All queries are asynchronous and must be `await`ed:

```javascript
import { db } from "sdk";
import { eq } from "sdk/db";
import { userSessions } from "../schema.js";

const SESSION_TTL_SECONDS = 3600; // 1 hour expiration

export async function getSession(userId) {
  const row = await db.select()
    .from(userSessions)
    .where(eq(userSessions.userId, userId))
    .get();

  if (!row) return null;

  // Check TTL
  const now = Math.floor(Date.now() / 1000);
  const updatedUnix = row.updatedAt instanceof Date ? Math.floor(row.updatedAt.getTime() / 1000) : Number(row.updatedAt);

  if (now - updatedUnix > SESSION_TTL_SECONDS) {
    await clearSession(userId);
    return null;
  }

  let data = {};
  try {
    data = row.payload ? JSON.parse(row.payload) : {};
  } catch {}

  return {
    state: row.state,
    step: row.step,
    data
  };
}

export async function setSession(userId, state, step, data = {}) {
  const payloadStr = JSON.stringify(data);

  await db.insert(userSessions)
    .values({
      userId,
      state,
      step,
      payload: payloadStr,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userSessions.userId,
      set: {
        state,
        step,
        payload: payloadStr,
        updatedAt: new Date(),
      },
    })
    .run();
}

export async function clearSession(userId) {
  await db.delete(userSessions)
    .where(eq(userSessions.userId, userId))
    .run();
}
```

---

## 3. Implementing a 2-Step Registration Wizard (`handlers/message.js`)

### Step Transitions
1. `ask_name`: Collect full name
2. `ask_email`: Collect email -> Validate format -> Insert into `members` -> Clear session.

### Handler Implementation

```javascript
// tgcloud/handlers/message.js
import { api, db } from "sdk";
import { getSession, setSession, clearSession } from "../lib/session.js";
import { members } from "../schema.js";

export default async function (message, ctx) {
  if (typeof message.text !== "string" || !message.from) return;

  const userId = message.from.id;
  const chatId = message.chat.id;
  const text = message.text.trim();

  // 1. Allow the user to cancel at any time
  if (text === "/cancel" || text.toLowerCase() === "cancel") {
    await clearSession(userId);
    return api.sendMessage({
      chat_id: chatId,
      text: "❌ Wizard cancelled. Type /join to start onboarding."
    });
  }

  // 2. Start command
  if (text === "/join" || text === "/start") {
    await setSession(userId, "onboarding", "ask_name", {});
    return api.sendMessage({
      chat_id: chatId,
      text: "👋 Welcome to onboarding!\nWhat is your full name? (Send /cancel to abort)"
    });
  }

  // 3. Check active conversational state
  const session = await getSession(userId);
  if (!session || session.state !== "onboarding") {
    return api.sendMessage({
      chat_id: chatId,
      text: "Type /join to register or /help for commands."
    });
  }

  // Step 1: Handling Name
  if (session.step === "ask_name") {
    if (text.length < 2 || text.length > 40) {
      return api.sendMessage({
        chat_id: chatId,
        text: "⚠️ Please enter a valid name (2-40 characters):"
      });
    }

    await setSession(userId, "onboarding", "ask_email", { name: text });
    return api.sendMessage({
      chat_id: chatId,
      text: `Nice to meet you, ${text}!\nNow please enter your email address:`
    });
  }

  // Step 2: Handling Email
  if (session.step === "ask_email") {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(text)) {
      return api.sendMessage({
        chat_id: chatId,
        text: "⚠️ Invalid email format. Please enter a valid email address (e.g. user@example.com):"
      });
    }

    const { name } = session.data;

    // Save final record to SQLite
    await db.insert(members)
      .values({
        userId,
        name,
        email: text,
      })
      .onConflictDoNothing()
      .run();

    // Clear ephemeral session
    await clearSession(userId);

    return api.sendMessage({
      chat_id: chatId,
      text: `🎉 **Registration Complete!**\n\nName: ${name}\nEmail: \`${text}\``,
      parse_mode: "Markdown"
    });
  }
}
```

---

## 4. Best Practices for Serverless FSMs

1. **Always Offer a `/cancel` Option**: Users can get stuck in a state if they enter bad inputs or change their mind. Always check for `/cancel` at the top of the message handler.
2. **Include Timestamps & TTLs**: Old abandoned sessions should expire automatically after a set period (e.g. 1 hour) so users aren't trapped in a step weeks later.
3. **Atomic Upserts**: Use `.onConflictDoUpdate({ target: userSessions.userId, set: ... })` to prevent duplicate primary key crashes during concurrent messages.
