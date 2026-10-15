# Bot Commands and Routing

This reference details how to structure, route, and handle incoming Telegram updates in Telegram Serverless (`tgcloud/handlers/<update_type>.js`).

---

## 1. Handler Architecture & Execution Context

Telegram Serverless executes ES module handlers inside isolated V8 environments.
- Handlers live in a **flat directory**: `tgcloud/handlers/<update_type>.js`.
- Each filename corresponds directly to a [Telegram Bot API `Update` field](https://core.telegram.org/bots/api#update):
  - `handlers/message.js` -> incoming messages and commands (`/start`, `/help`)
  - `handlers/callback_query.js` -> inline keyboard button clicks
  - `handlers/pre_checkout_query.js` -> Telegram Stars checkout approvals
  - `handlers/inline_query.js` -> inline bot queries (`@bot ...`)
- **Selective Activation**: Telegram Serverless configures webhook `allowed_updates` automatically based on which handler files exist and are non-empty.

### Handler Export Signature & Arguments

Every handler exports a default `async` function with two parameters:

```javascript
import { api } from "sdk";

export default async function (payload, ctx) {
  // payload: The unwrapped entity for this update type (Message, CallbackQuery, PreCheckoutQuery)
  // ctx.update: The outer envelope containing update_id
}
```

In `tgcloud/handlers/message.js`:
- The 1st argument is a [`Message`](https://core.telegram.org/bots/api#message) object (`message.text`, `message.chat.id`, `message.from.id`).
- The 2nd argument `ctx` contains `ctx.update` (`ctx.update.update_id`).

---

## 2. Text Commands & Dispatching (`handlers/message.js`)

In Telegram Serverless, Bot API methods accept a **single options object** with `snake_case` properties matching the official Telegram Bot API parameters.

```javascript
// tgcloud/handlers/message.js
import { api } from "sdk";

export default async function (message, ctx) {
  // Always guard against non-text messages (e.g. photos, stickers)
  if (typeof message.text !== "string") return;

  const text = message.text.trim();
  const chatId = message.chat.id;
  const [command, ...args] = text.split(/\s+/);

  switch (command.toLowerCase()) {
    case "/start":
      return api.sendMessage({
        chat_id: chatId,
        text: "👋 **Welcome to your Telegram Serverless Bot!**\n\nInstant V8 isolate execution with zero server management.",
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⚡ Ping", callback_data: "cmd:ping" },
              { text: "ℹ️ Help", callback_data: "cmd:help" }
            ],
            [
              { text: "📖 Telegram Serverless Docs", url: "https://core.telegram.org/bots/serverless" }
            ]
          ]
        }
      });

    case "/help":
      return api.sendMessage({
        chat_id: chatId,
        text: "ℹ️ **Available Commands:**\n/start - Open welcome menu\n/help - Show this help\n/ping - Measure isolate response",
        parse_mode: "Markdown"
      });

    case "/ping":
      return api.sendMessage({
        chat_id: chatId,
        text: "🏓 Pong! Handler executed in Telegram V8 isolate."
      });

    default:
      return api.sendMessage({
        chat_id: chatId,
        text: `I received: "${text}". Send /help to see available commands.`
      });
  }
}
```

---

## 3. Modular Architecture for Production Bots

For complex bots, separate domain logic cleanly under `tgcloud/lib/`:

```text
tgcloud/
├── handlers/
│   ├── message.js               # Message update entrypoint
│   ├── callback_query.js        # Inline button entrypoint
│   └── pre_checkout_query.js    # Stars checkout approval entrypoint
├── lib/
│   ├── commands/                # Command handlers (/start, /profile, /settings)
│   │   ├── start.js
│   │   └── help.js
│   ├── callbacks/               # Callback query action handlers
│   │   └── router.js
│   └── session.js               # SQLite session helpers
└── schema.js                    # Persistent SQLite tables
```

### Clean Delegation in `tgcloud/handlers/message.js`

```javascript
import { api } from "sdk";
import { handleStart } from "../lib/commands/start.js";
import { handleHelp } from "../lib/commands/help.js";
import { handleFsmStep } from "../lib/fsm.js";

export default async function (message, ctx) {
  if (typeof message.text !== "string") return;

  const text = message.text.trim();

  if (text.startsWith("/start")) return handleStart(message);
  if (text.startsWith("/help")) return handleHelp(message);

  // Check if user is in an active multi-step conversation
  const handled = await handleFsmStep(message);
  if (handled) return;

  await api.sendMessage({
    chat_id: message.chat.id,
    text: "Unknown command. Send /help for options."
  });
}
```

---

## 4. Bot UI Configuration: Autocomplete Commands & Menu Button

Configure your bot's autocomplete commands list and client menu button via `api`:

```javascript
import { api } from "sdk";

export async function setupBotUi() {
  // 1. Register commands in Telegram client autocomplete list
  await api.setMyCommands({
    commands: [
      { command: "start", description: "Open main menu" },
      { command: "help", description: "Show available commands" },
      { command: "buy", description: "Buy digital pass with Telegram Stars" }
    ]
  });

  // 2. Set default bottom menu button to show commands list
  await api.setChatMenuButton({
    menu_button: { type: "commands" }
  });
}
```

---

## 5. Security & Input Sanitization (`W011`)

All message text is untrusted user input:
- Always escape HTML special characters when using `parse_mode: "HTML"`.
- When using `parse_mode: "Markdown"`, unescaped characters like `_` in user data will cause Telegram to return `400 Bad Request: can't parse entities`. Either wrap variable outputs in inline code backticks (e.g. `` `user_${id}` ``) or use HTML mode with `escapeHtml`:

```javascript
export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
```
