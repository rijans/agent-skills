# Conversational FSM and Multi-Step Dialogs

Because Telegram Serverless executes in stateless V8 isolates that spin up and down on demand, in-memory state (`let userState = {}`) will be lost between webhook events.

Multi-step conversational wizards (registration forms, surveys, booking flows, checkout steps) must persist state in the built-in SQLite database (`sdk/db`).

---

## 1. Standard SQLite Session Schema

Define a clean session table in `tgcloud/schema.js`:

```javascript
import { table, integer, text } from "sdk/db";

export const user_sessions = table("user_sessions", {
  user_id: integer("user_id").primaryKey(),
  state: text("state").notNull(),            // e.g. "onboarding", "booking", "feedback"
  step: text("step").notNull(),              // e.g. "awaiting_name", "awaiting_date"
  payload: text("payload"),                  // JSON string with collected intermediate data
  updated_at: integer("updated_at").notNull() // Unix timestamp in seconds
});
```

---

## 2. Reusable Session Helpers (`tgcloud/lib/session.js`)

```javascript
import db from "sdk/db";

const SESSION_TTL_SECONDS = 3600; // 1 hour expiration

export function getSession(userId) {
  const row = db.query(
    "SELECT state, step, payload, updated_at FROM user_sessions WHERE user_id = ?",
    [userId]
  )[0];

  if (!row) return null;

  // Check TTL
  const now = Math.floor(Date.now() / 1000);
  if (now - row.updated_at > SESSION_TTL_SECONDS) {
    clearSession(userId);
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

export function setSession(userId, state, step, data = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payloadStr = JSON.stringify(data);

  db.query(
    `INSERT INTO user_sessions (user_id, state, step, payload, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       state = excluded.state,
       step = excluded.step,
       payload = excluded.payload,
       updated_at = excluded.updated_at`,
    [userId, state, step, payloadStr, now]
  );
}

export function clearSession(userId) {
  db.query("DELETE FROM user_sessions WHERE user_id = ?", [userId]);
}
```

---

## 3. Implementing a 3-Step Registration Wizard

### Step Transitions
1. `REGISTER_AWAITING_NAME`
2. `REGISTER_AWAITING_EMAIL`
3. Completed -> Saved to main `users` table -> Session cleared.

### Handler Implementation

```javascript
import api from "sdk/api";
import db from "sdk/db";
import { getSession, setSession, clearSession } from "../lib/session.js";

export async function handleWizardText(msg) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();

  // Allow the user to cancel at any time
  if (text === "/cancel" || text.toLowerCase() === "cancel") {
    clearSession(userId);
    return api.sendMessage(chatId, "❌ Wizard cancelled. Type /register to start over.");
  }

  const session = getSession(userId);
  if (!session || session.state !== "registration") return false;

  // Step 1: Handling Name
  if (session.step === "awaiting_name") {
    if (text.length < 2 || text.length > 50) {
      return api.sendMessage(chatId, "⚠️ Please enter a valid name (2-50 characters):");
    }

    setSession(userId, "registration", "awaiting_email", { name: text });
    return api.sendMessage(chatId, `Thanks, ${text}! Now please enter your email address:`);
  }

  // Step 2: Handling Email
  if (session.step === "awaiting_email") {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(text)) {
      return api.sendMessage(chatId, "⚠️ Invalid email format. Please enter a valid email address (or /cancel):");
    }

    const { name } = session.data;

    // Save final record to SQLite
    db.query(
      "INSERT INTO registered_users (user_id, name, email, created_at) VALUES (?, ?, ?, ?)",
      [userId, name, text, Math.floor(Date.now() / 1000)]
    );

    // Clear ephemeral session
    clearSession(userId);

    return api.sendMessage(
      chatId,
      `🎉 **Registration Complete!**\n\nName: ${name}\nEmail: ${text}`,
      { parse_mode: "Markdown" }
    );
  }

  return false;
}
```

---

## 4. Best Practices for Serverless FSMs

1. **Always Offer a `/cancel` Option**: Users can get stuck in a state if they enter bad inputs or change their mind. Always check for `/cancel` at the top of the message dispatcher.
2. **Include Timestamps & TTLs**: Old abandoned sessions should expire automatically after a set period (e.g. 1 hour) so users aren't trapped in a step weeks later.
3. **Use Reply Keyboard with Cancel**: When asking for freeform text, attach a single-button reply keyboard `[[ { text: "❌ Cancel" } ]]` to make exiting intuitive on mobile.
