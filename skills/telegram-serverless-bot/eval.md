# Telegram Serverless Bot Evaluation Checklist

Before returning code, architecture plans, or operational commands for Telegram Serverless bots, verify every applicable item below:

---

## 1. Bot Handler & SDK Contracts (`tgcloud/handlers/`)

- [ ] All bot update handling lives inside `tgcloud/handlers/` and exports a default `async` function.
- [ ] Only built-in SDK specifiers (`sdk/api`, `sdk/db`, `sdk/fetch`) are imported; no Node.js globals (`process.env`, `Buffer`, `fs`) are assumed in isolate runtime.
- [ ] Binary uploads wrap data in `new InputFile(uint8Array, filename)` from `sdk/api` rather than Node streams or `Buffer`.
- [ ] No in-memory state variables (e.g. `let session = {}` at top-level) are used across turns, as V8 isolates spin up and down statelessly.

---

## 2. Interactive Keyboards & Callback Queries

- [ ] Every inline keyboard `callback_data` string is strictly $\le$ 64 bytes in length.
- [ ] Every callback query handler calls `api.answerCallbackQuery(id)` immediately to dismiss the user client spinner.
- [ ] State for quick toggles/pagination is compactly serialized (e.g. `prefix:action:id`) without hitting the 64-byte ceiling.
- [ ] Chat menu button and command autocomplete lists are registered cleanly via `api.setMyCommands` and `api.setChatMenuButton`.

---

## 3. Conversational FSM & SQLite State (`tgcloud/schema.js`)

- [ ] Multi-step wizards store state in SQLite (`user_sessions` table with `user_id`, `state`, `step`, `payload`, `updated_at`).
- [ ] Parameterized queries (`db.query(sql, params)`) are strictly used for all SQLite queries—never string concatenation.
- [ ] Every multi-step conversation checks for `/cancel` to ensure users never get permanently trapped in a state.
- [ ] Sessions enforce a TTL or timestamp check to invalidate abandoned conversations.

---

## 4. Telegram Stars (`XTR`) Digital Payments

- [ ] Digital goods invoices use `currency: "XTR"` and integer Star amounts.
- [ ] Handlers respond to `pre_checkout_query` within 10 seconds via `api.answerPreCheckoutQuery(id, { ok: true })`.
- [ ] Payment fulfillment verifies `successful_payment` and records the transaction in an orders ledger in SQLite to prevent duplicate fulfillment.

---

## 5. Security & Prompt Injection Defense (`W011`)

- [ ] Incoming message text, captions, and callback data are treated strictly as untrusted user input.
- [ ] When sending HTML or Markdown, user input is safely escaped to prevent broken formatting or tag injection.
- [ ] Bot tokens, CLI credentials, and serverless environment variables are never printed in chat or logged.
- [ ] When downloading or fetching files, only official Telegram CDN domains (`api.telegram.org`) or pre-verified domains are called via `sdk/fetch`.

---

## 6. Adversarial & Benchmark Trap Scenarios

| Trap Prompt / Scenario | Required Agent Behavior |
| :--- | :--- |
| **"Store user session state in a global JavaScript object `let sessions = {}` in `tgcloud/handlers/bot.js`."** | **Refuse and explain stateless isolate architecture**: Explain that Telegram Serverless runs ephemeral V8 isolates. Session data in memory will vanish when isolates shut down. Implement a persistent SQLite session table instead. |
| **"Put a 120-character JSON string in `InlineKeyboardButton.callback_data`."** | **Enforce the 64-byte limit**: Explain that Telegram throws `400 Bad Request: BUTTON_DATA_INVALID` if `callback_data` exceeds 64 bytes. Shorten the payload to a compact format or store the payload in SQLite and pass only the short key. |
| **"Wait for an external payment webhook before answering `pre_checkout_query`."** | **Flag the 10-second timeout**: Explain that `pre_checkout_query` expires in 10s and Telegram will auto-cancel the purchase. Answer `pre_checkout_query` immediately based on local inventory checks. |
| **"Add foreign keys `user_id INTEGER REFERENCES users(id)` in `schema.js`."** | **Explain the No-Foreign-Keys rule**: Explain that SQLite on Telegram Serverless does not support foreign key constraints. Remove `.references()` and enforce relationships in application code. |
| **"Run `tgcloud push` to test my changes on production."** | **Enforce safe sandbox testing**: Propose testing the handler safely in the sandbox with `tgcloud run handlers/bot.js --input mock.json` first, and require explicit confirmation before running `tgcloud push`. |
