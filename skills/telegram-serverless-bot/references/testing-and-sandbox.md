# Testing, Sandboxing, and Safe Operations

This reference outlines how to test bot handlers using mock Telegram updates, debug common Bot API errors, and deploy safely to Telegram Serverless.

---

## 1. Operational Separation of Concerns

Always maintain strict separation between offline code analysis, sandbox execution, and live production deployment:

```text
[Local Verification]    -> node --check tgcloud/handlers/*.js
[Local Diff]            -> npx @tgcloud/cli diff
[Sandbox Test Update]   -> npx @tgcloud/cli run handlers/bot.js --input ./mock-updates/start-command.json
[Production Migrate]    -> npx @tgcloud/cli migrate (Requires User Approval!)
[Production Deploy]     -> npx @tgcloud/cli push    (Requires User Approval!)
```

---

## 2. Testing in Sandbox with `tgcloud run`

You can test any bot handler in a remote sandbox environment without waiting for real users to send Telegram messages.

Pass a mock update JSON file via `--input`:

```bash
# 1. Test /start command
npx @tgcloud/cli run handlers/bot.js --input ./mock-updates/start-command.json

# 2. Test button click callback
npx @tgcloud/cli run handlers/bot.js --input ./mock-updates/callback-query.json

# 3. Test pre-checkout payment approval
npx @tgcloud/cli run handlers/bot.js --input ./mock-updates/pre-checkout-query.json
```

---

## 3. Mock Telegram Update Fixtures

### `mock-updates/start-command.json`

```json
{
  "update": {
    "update_id": 1000001,
    "message": {
      "message_id": 42,
      "from": {
        "id": 9990001,
        "is_bot": false,
        "first_name": "DevTester",
        "username": "devtester"
      },
      "chat": {
        "id": 9990001,
        "first_name": "DevTester",
        "type": "private"
      },
      "date": 1729000000,
      "text": "/start"
    }
  }
}
```

### `mock-updates/callback-query.json`

```json
{
  "update": {
    "update_id": 1000002,
    "callback_query": {
      "id": "query_test_12345",
      "from": {
        "id": 9990001,
        "first_name": "DevTester"
      },
      "message": {
        "message_id": 42,
        "chat": {
          "id": 9990001,
          "type": "private"
        }
      },
      "data": "menu:stats"
    }
  }
}
```

---

## 4. Troubleshooting Common Bot Runtime Errors

### 1. `409 Conflict: terminated by other getUpdates request; make sure that only one bot instance is running`
- **Cause**: Long-polling (like a local test script running `grammY` or `telegraf`) is actively querying Telegram while Telegram Serverless webhook is configured.
- **Fix**: Stop the local long-polling script or remove the old webhook before testing.

### 2. `400 Bad Request: BUTTON_DATA_INVALID`
- **Cause**: The `callback_data` string exceeds the strict 64-byte UTF-8 limit.
- **Fix**: Shorten the prefix and action identifiers (e.g. `cfg:tgl:notif` instead of `configuration_menu:toggle_action:notifications_enabled`).

### 3. `400 Bad Request: query is too old and response timeout expired or query ID is invalid`
- **Cause**: Bot took longer than ~30 seconds to call `api.answerCallbackQuery(id)`.
- **Fix**: Call `api.answerCallbackQuery` at the very beginning of the callback handler before running database queries or external HTTP requests.

### 4. `Pre-Checkout Timeout (>10s)`
- **Cause**: Handler did not return `api.answerPreCheckoutQuery(id, { ok: true })` within 10 seconds.
- **Fix**: Avoid expensive network fetches inside the pre-checkout handler. Verify order validity purely against local SQLite data.

---

## 5. Live Production Deployment Checklist

Before deploying:
1. Run syntax check: `node --check tgcloud/handlers/bot.js`
2. Run `tgcloud diff` to inspect changes.
3. If SQLite schema changed in `tgcloud/schema.js`, request user permission and run:
   ```bash
   npx @tgcloud/cli migrate
   ```
4. Request explicit user permission and deploy to production:
   ```bash
   npx @tgcloud/cli push
   ```
