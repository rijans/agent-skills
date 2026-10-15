# Authoritative Platform Sources & References

This index provides links to authoritative documentation and contracts for Telegram Serverless bots.

---

## 1. Telegram Official Documentation

- **Telegram Serverless Overview**: [https://core.telegram.org/bots/serverless](https://core.telegram.org/bots/serverless)
- **Telegram Bot API Reference**: [https://core.telegram.org/bots/api](https://core.telegram.org/bots/api)
- **Telegram Bot Features (Keyboards, Commands, Inline Mode)**: [https://core.telegram.org/bots/features](https://core.telegram.org/bots/features)
- **Telegram Stars (XTR) Documentation**: [https://core.telegram.org/bots/payments-stars](https://core.telegram.org/bots/payments-stars)
- **Telegram Bot Payments API**: [https://core.telegram.org/bots/payments](https://core.telegram.org/bots/payments)

---

## 2. Serverless Runtime & SDK Modules

- `sdk/api`: Telegram Bot API wrapper exposing methods like `sendMessage`, `sendPhoto`, `sendInvoice`, `answerCallbackQuery`, and `answerPreCheckoutQuery`.
- `sdk/db`: Built-in SQLite interface providing `db.query(sql, params)` and declarative schema helpers (`table`, `integer`, `text`, `blob`).
- `sdk/fetch`: Standard `fetch` implementation for outbound HTTPS calls.
- `tgcloud`: Official CLI tool (`@tgcloud/cli`) for authentication, diffing, running sandbox tests, and deploying.
