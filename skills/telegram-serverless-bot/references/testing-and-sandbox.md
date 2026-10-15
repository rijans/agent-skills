# Testing, Sandboxing, and Safe Operations

This reference outlines how to test bot handlers using mock Telegram updates, debug common Bot API errors, and deploy safely to Telegram Serverless.

---

## 1. Operational Separation of Concerns

Always maintain strict separation between offline code analysis, sandbox execution, and live production deployment:

```text
[Local Verification]    -> node --check tgcloud/handlers/*.js
[Local Diff]            -> npx @tgcloud/cli diff
[Sandbox Test]          -> npx @tgcloud/cli run handlers/message '<payload>' [--ctx '<ctx>']
[Production Migrate]    -> npx @tgcloud/cli migrate (Requires User Approval!)
[Production Deploy]     -> npx @tgcloud/cli push    (Requires User Approval!)
```

---

## 2. Testing in Sandbox with `tgcloud run`

Telegram Serverless lets you run any handler in a live cloud isolate sandbox without waiting for real Telegram users to message your bot.

Syntax:
```bash
npx tgcloud run <module> [input] [--ctx <ctx>]
```

Where:
- `<module>`: Qualified module path without extension (`handlers/message`, `handlers/callback_query`, `handlers/pre_checkout_query`).
- `[input]`: JSON or JSON5 string passed as the unwrapped 1st argument to the handler (`Message`, `CallbackQuery`, etc.).
- `--ctx <ctx>`: Optional JSON/JSON5 string passed as `ctx` (containing `ctx.update`).

### Examples

```bash
# 1. Test /start command in handlers/message
npx tgcloud run handlers/message '{ chat: { id: 12345678 }, from: { id: 12345678 }, text: "/start" }' \
  --ctx '{ update: { update_id: 1000001 } }'

# 2. Test button callback in handlers/callback_query
npx tgcloud run handlers/callback_query '{ id: "cb_test_1", data: "cmd:ping", message: { chat: { id: 12345678 }, message_id: 42 } }'

# 3. Test pre-checkout payment approval in handlers/pre_checkout_query
npx tgcloud run handlers/pre_checkout_query '{ id: "pcq_1", currency: "XTR", total_amount: 100, invoice_payload: "order:premium_pass" }'
```

> [!WARNING]
> `tgcloud run` bundles your local `tgcloud/` modules and executes them against your **real database and real Bot API**. If your handler calls `api.sendMessage` or `db.delete`, that message will actually be sent and database changes will persist.

---

## 3. Mock Telegram Update Fixtures

Store reusable JSON test payloads under `mock-updates/` for fast regression testing:

### Example: Testing from File with Shell Expansion

```bash
npx tgcloud run handlers/message "$(cat mock-updates/start-command.json)"
```

---

## 4. Troubleshooting Common Bot Runtime Errors

### 1. `409 Conflict: terminated by other getUpdates request; make sure that only one bot instance is running`
- **Cause**: A local test script or long-polling process (`grammY`, `telegraf`, `python-telegram-bot`) is actively polling Telegram while Telegram Serverless webhook is active.
- **Fix**: Stop the local long-polling process.

### 2. `400 Bad Request: BUTTON_DATA_INVALID`
- **Cause**: The `callback_data` string exceeds the strict 64-byte UTF-8 limit.
- **Fix**: Shorten the prefix and identifiers (e.g. `cfg:tgl:notif` instead of `configuration_menu:toggle_action:notifications_enabled`).

### 3. `400 Bad Request: query is too old and response timeout expired or query ID is invalid`
- **Cause**: Bot took longer than ~30 seconds to call `api.answerCallbackQuery({ callback_query_id })`.
- **Fix**: Call `api.answerCallbackQuery` immediately at the start of `handlers/callback_query.js`.

### 4. `Pre-Checkout Timeout (>10s)`
- **Cause**: Handler did not return `api.answerPreCheckoutQuery({ pre_checkout_query_id, ok: true })` within 10 seconds.
- **Fix**: Avoid network fetches inside `handlers/pre_checkout_query.js`. Verify order validity purely against local SQLite data.

### 5. `400 Bad Request: can't parse entities`
- **Cause**: Using `parse_mode: "Markdown"` or `"MarkdownV2"` with unescaped special characters (e.g. `_` inside user names or IDs).
- **Fix**: Wrap variables in backticks (`` `item_${id}` ``) or switch to `parse_mode: "HTML"` with `escapeHtml()`.

---

## 5. Live Production Deployment Checklist

Before deploying:
1. Run syntax check:
   ```bash
   node --check tgcloud/handlers/message.js
   node --check tgcloud/handlers/callback_query.js
   node --check tgcloud/schema.js
   ```
2. Run `npx tgcloud diff` to review local changes against deployed revision.
3. If SQLite schema changed in `tgcloud/schema.js`, request user authorization and run:
   ```bash
   npx tgcloud migrate --dry-run
   npx tgcloud migrate --safe
   ```
4. Request explicit user permission and deploy to production:
   ```bash
   npx tgcloud push
   ```
