# Bot Commands and Routing

This reference details how to structure, route, and handle incoming Telegram updates in Telegram Serverless (`tgcloud/handlers/*.js`).

---

## 1. Handler Anatomy & Execution Context

Telegram Serverless executes ES module handlers inside isolated V8 environments. Bot updates arrive as an incoming webhook event.

A bot handler exports a default `async` function receiving the context:

```javascript
import api from "sdk/api";

export default async function (ctx) {
  const update = ctx.update;
  if (!update || !update.message) return;

  const msg = update.message;
  const text = msg.text || "";
  const chatId = msg.chat.id;

  if (text.startsWith("/start")) {
    await api.sendMessage(chatId, "Welcome to our Serverless Bot!");
  }
}
```

### Context Object (`ctx`)
- `ctx.update`: The raw [Telegram Update](https://core.telegram.org/bots/api#update) object (`message`, `callback_query`, `inline_query`, `pre_checkout_query`, etc.).
- `ctx.env`: Environment variables and secrets configured in the Telegram Serverless project.

---

## 2. Command Parsing & Dispatching Patterns

### Tier 1: Single-Handler Dispatcher (Lightweight Bots)

For simple bots (under 100 lines), keep everything inside `tgcloud/handlers/bot.js`:

```javascript
import api from "sdk/api";

export default async function (ctx) {
  const update = ctx.update;

  // 1. Handle incoming text messages & commands
  if (update.message?.text) {
    const text = update.message.text.trim();
    const chatId = update.message.chat.id;
    const [command, ...args] = text.split(/\s+/);

    switch (command.toLowerCase()) {
      case "/start":
        return api.sendMessage(chatId, "👋 Hello! I am running on Telegram Serverless.", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "📖 Documentation", url: "https://core.telegram.org/bots/serverless" }]
            ]
          }
        });

      case "/help":
        return api.sendMessage(chatId, "ℹ️ Available commands:\n/start - Start bot\n/help - Show this message\n/ping - Check latency");

      case "/ping":
        return api.sendMessage(chatId, "🏓 Pong! Instant V8 isolate response.");

      default:
        // Optional fallback for unhandled text
        return api.sendMessage(chatId, `I received: "${text}". Type /help for options.`);
    }
  }

  // 2. Handle inline button callbacks
  if (update.callback_query) {
    const cb = update.callback_query;
    await api.answerCallbackQuery(cb.id, { text: "Action received!" });
  }
}
```

---

## 3. Tier 2: Modular Architecture (Production Bots)

For complex multi-feature bots, separate concerns:

```text
tgcloud/
├── handlers/
│   └── bot.js               # Central update dispatcher
├── lib/
│   ├── commands/            # Command handlers (/start, /profile, /settings)
│   │   ├── start.js
│   │   └── help.js
│   ├── callbacks/           # Callback query action handlers
│   │   └── menu.js
│   └── session.js           # SQLite session helpers
└── schema.js                # SQLite tables
```

### Central Dispatcher (`tgcloud/handlers/bot.js`)

```javascript
import api from "sdk/api";
import { handleStart } from "../lib/commands/start.js";
import { handleHelp } from "../lib/commands/help.js";
import { handleCallback } from "../lib/callbacks/router.js";
import { handlePreCheckout, handleSuccessfulPayment } from "../lib/payments/stars.js";

export default async function (ctx) {
  const { update } = ctx;
  if (!update) return;

  // 1. Pre-checkout query (Must respond <10s)
  if (update.pre_checkout_query) {
    return handlePreCheckout(update.pre_checkout_query);
  }

  // 2. Successful Stars payment
  if (update.message?.successful_payment) {
    return handleSuccessfulPayment(update.message);
  }

  // 3. Callback queries (Inline buttons)
  if (update.callback_query) {
    return handleCallback(update.callback_query);
  }

  // 4. Text messages and commands
  if (update.message?.text) {
    const text = update.message.text.trim();
    if (text.startsWith("/start")) return handleStart(update.message);
    if (text.startsWith("/help")) return handleHelp(update.message);
  }
}
```

---

## 4. BotFather Configuration & Chat Menu Buttons

To provide a seamless user experience, configure the bot commands and menu button using `sdk/api`:

```javascript
// Register command list in Telegram client UI autocomplete
await api.setMyCommands([
  { command: "start", description: "Start the bot" },
  { command: "help", description: "Show help and commands" },
  { command: "checkout", description: "Buy digital goods with Telegram Stars" }
]);

// Set default chat menu button
await api.setChatMenuButton({
  menu_button: { type: "commands" }
});
```

---

## 5. Security & Input Sanitization (`W011`)

All message text is untrusted user input:
- Always escape HTML or Markdown characters if using `parse_mode: "HTML"` or `parse_mode: "MarkdownV2"`.
- Never evaluate or interpolate user text into dynamic code or unparameterized queries.
- For HTML formatting, use a helper:
```javascript
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
```
