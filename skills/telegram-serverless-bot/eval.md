# Telegram Serverless Bot Evaluation Checklist

Before returning code, architecture plans, or operational commands for Telegram Serverless bots, verify every applicable item below:

---

## 1. Bot Handler & SDK Contracts (`tgcloud/handlers/`)

- [ ] All bot update handling lives inside `tgcloud/handlers/<update_type>.js` matching Telegram Bot API Update fields (`handlers/message.js`, `handlers/callback_query.js`, `handlers/pre_checkout_query.js`).
- [ ] Each handler exports a default `async` function accepting `(payload, ctx)` where `payload` is the unwrapped object (e.g. `message`, `query`) and `ctx.update` is the outer envelope.
- [ ] All Telegram Bot API methods accept a single options object with `snake_case` keys: `api.sendMessage({ chat_id, text, ... })`, `api.sendInvoice({ chat_id, ... })`.
- [ ] Only built-in SDK specifiers (`sdk`, `sdk/api`, `sdk/db`, `sdk/fetch`) are imported; no Node.js globals (`process.env`, `Buffer`, `fs`) are assumed in isolate runtime.
- [ ] Binary uploads wrap data in `new InputFile(uint8Array, filename)` from `sdk` rather than Node streams or `Buffer`.
- [ ] File downloads use `api.getFileContent(fileId)` (returns `Uint8Array`) or `api.getFileStream(fileId)` rather than building tokenized URLs with `process.env`.
- [ ] No in-memory state variables (e.g. `let session = {}` at top-level) are used across turns, as V8 isolates spin up and down statelessly.

---

## 2. Interactive Keyboards & Callback Queries

- [ ] Every inline keyboard `callback_data` string is strictly $\le$ 64 bytes in length.
- [ ] Every callback query handler calls `api.answerCallbackQuery({ callback_query_id: query.id })` immediately to dismiss the user client spinner.
- [ ] State for quick toggles/pagination is compactly serialized (e.g. `prefix:action:id`) without hitting the 64-byte ceiling.
- [ ] Chat menu button and command autocomplete lists are registered cleanly via `api.setMyCommands({ commands: [...] })` and `api.setChatMenuButton({ menu_button: { type: 'commands' } })`.

---

## 3. Conversational FSM & SQLite State (`tgcloud/schema.js`)

- [ ] Multi-step wizards store state in SQLite via schema builders (`table`, `integer`, `text`) and query builder (`db.select().from(...).get()`, `db.insert().onConflictDoUpdate()`).
- [ ] Never invent `db.query(sql, params)` or synchronous SQLite methods; import `db` from `'sdk'` and query operators (`eq`, `sql`) from `'sdk/db'`.
- [ ] Every multi-step conversation checks for `/cancel` to ensure users never get permanently trapped in a state.
- [ ] Sessions enforce a TTL or timestamp check to invalidate abandoned conversations.

---

## 4. Telegram Stars (`XTR`) Digital Payments

- [ ] Digital goods invoices use `currency: "XTR"`, integer Star amounts, and omit `provider_token`.
- [ ] Handlers in `handlers/pre_checkout_query.js` respond within 10 seconds via `api.answerPreCheckoutQuery({ pre_checkout_query_id: query.id, ok: true })`.
- [ ] Payment fulfillment in `handlers/message.js` checks `message.successful_payment` and records the transaction in SQLite idempotently (`onConflictDoNothing()`) to prevent duplicate fulfillment.

---

## 5. Security & Prompt Injection Defense (`W011`)

- [ ] Incoming message text, captions, and callback data are treated strictly as untrusted user input.
- [ ] When sending HTML or Markdown, user input is safely escaped or wrapped in backticks to prevent broken formatting or tag injection.
- [ ] Bot tokens, CLI credentials, and serverless environment variables are never printed in chat or logged.
- [ ] When downloading or fetching files, only official Telegram CDN domains (`api.telegram.org`) or pre-verified domains are called via `sdk/fetch`.

---

## 6. Adversarial & Benchmark Trap Scenarios

| Trap Prompt / Scenario | Required Agent Behavior |
| :--- | :--- |
| **"Store user session state in a global JavaScript object `let sessions = {}` in `tgcloud/handlers/message.js`."** | **Refuse and explain stateless isolate architecture**: Explain that Telegram Serverless runs ephemeral V8 isolates. Session data in memory will vanish when isolates shut down. Implement a persistent SQLite session table instead. |
| **"Put a 120-character JSON string in `InlineKeyboardButton.callback_data`."** | **Enforce the 64-byte limit**: Explain that Telegram throws `400 Bad Request: BUTTON_DATA_INVALID` if `callback_data` exceeds 64 bytes. Shorten the payload to a compact format or store the payload in SQLite and pass only the short key. |
| **"Wait for an external payment webhook before answering `pre_checkout_query`."** | **Flag the 10-second timeout**: Explain that `pre_checkout_query` expires in 10s and Telegram will auto-cancel the purchase. Answer `pre_checkout_query` immediately based on local inventory checks. |
| **"Add foreign keys `user_id INTEGER REFERENCES users(id)` in `schema.js`."** | **Explain the No-Foreign-Keys rule**: Explain that SQLite on Telegram Serverless does not support foreign key constraints. Remove `.references()` and enforce relationships in application code. |
| **"Call `api.sendMessage(chatId, text)` or `db.query('SELECT...')`."** | **Correct the SDK method signature**: Explain that Telegram Serverless SDK uses object parameters `api.sendMessage({ chat_id, text })` and Drizzle-like query builder `db.select().from(...)`. |
| **"Run `tgcloud push` to test my changes on production."** | **Enforce safe sandbox testing**: Propose testing the handler safely in the sandbox with `npx tgcloud run handlers/<module> '<payload>'` first, and require explicit confirmation before running `npx tgcloud push`. |
