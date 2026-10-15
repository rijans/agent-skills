# Keyboards and Callback Queries

This reference covers interactive buttons, menus, and the 64-byte callback data constraint in Telegram Serverless.

---

## 1. Inline Keyboards vs. Reply Keyboards

Telegram supports two keyboard types:

| Type | Display Location | Use Case | Webhook Update |
|---|---|---|---|
| **Inline Keyboard** (`inline_keyboard`) | Directly attached beneath a specific message | Menus, pagination, toggles, external links, Mini App launchers | `update.callback_query` |
| **Reply Keyboard** (`keyboard`) | Replaces the user's regular text keyboard at bottom | Persistent navigation, phone/location sharing, quick replies | `update.message.text` |

---

## 2. Inline Keyboards & Mini App Launchers

### Construction

```javascript
import api from "sdk/api";

export async function sendMainMenu(chatId) {
  return api.sendMessage(chatId, "🎮 **Main Menu**\nChoose an option below:", {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "📊 Stats", callback_data: "menu:stats" },
          { text: "⚙️ Settings", callback_data: "menu:settings" }
        ],
        [
          // Mini App launcher button
          { text: "🚀 Open Mini App", web_app: { url: "https://app12345.tgcloud.ai/" } }
        ],
        [
          { text: "🔗 Channel", url: "https://t.me/telegram" }
        ]
      ]
    }
  });
}
```

---

## 3. The 64-Byte Callback Data Constraint

> [!IMPORTANT]
> Telegram enforces a strict **maximum length of 64 bytes (UTF-8)** on `callback_data`.
> Exceeding 64 bytes throws a Bot API error (`400 Bad Request: BUTTON_DATA_INVALID`).

### Recommended Compact Serialization Pattern

Use delimited short strings: `<module>:<action>:<id>:<extra>`

```javascript
// Examples of compact payloads well within 64 bytes:
// "shop:buy:prod_42"       -> 16 bytes
// "page:users:2"           -> 12 bytes
// "fsm:cancel"             -> 10 bytes
// "settings:toggle:notify" -> 22 bytes

export function parseCallbackData(data) {
  const parts = (data || "").split(":");
  return {
    module: parts[0] || "",
    action: parts[1] || "",
    id: parts[2] || "",
    extra: parts.slice(3).join(":")
  };
}
```

---

## 4. Handling Callback Queries

### Rule #1: Immediate Acknowledgment

Whenever a `callback_query` update arrives, you **must** call `api.answerCallbackQuery` immediately:
- Without this call, the user's Telegram client shows a loading spinner on the button for up to 30 seconds.
- You can optionally display an ephemeral notification or alert box.

```javascript
import api from "sdk/api";

export async function handleCallbackQuery(cb) {
  const data = cb.data || "";
  const chatId = cb.message?.chat?.id;
  const messageId = cb.message?.message_id;

  // 1. Acknowledge immediately (with optional toast or popup alert)
  await api.answerCallbackQuery(cb.id, {
    text: "Updated!",
    show_alert: false // true renders a modal popup dialog
  });

  // 2. Route the action
  if (data === "menu:stats") {
    await api.editMessageText("📊 **Live Serverless Stats**\nIsolate cold start: ~5ms\nUptime: 99.99%", {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "⬅️ Back", callback_data: "menu:back" }]
        ]
      }
    });
  }
}
```

---

## 5. Inline Keyboard Pagination Recipe

A common requirement is paginating lists (e.g. products, items, search results):

```javascript
export function buildPaginationKeyboard(items, currentPage, totalPages, prefix) {
  const buttons = items.map((item) => [
    { text: item.name, callback_data: `${prefix}:view:${item.id}` }
  ]);

  const navRow = [];
  if (currentPage > 1) {
    navRow.push({ text: "⬅️ Prev", callback_data: `${prefix}:p:${currentPage - 1}` });
  }
  navRow.push({ text: `${currentPage} / ${totalPages}`, callback_data: `${prefix}:noop` });
  if (currentPage < totalPages) {
    navRow.push({ text: "Next ➡️", callback_data: `${prefix}:p:${currentPage + 1}` });
  }

  buttons.push(navRow);
  return { inline_keyboard: buttons };
}
```
