# mtcute Starter Userbot

Minimal, high-performance Telegram userbot starter using [`@mtcute/node`](https://www.npmjs.com/package/@mtcute/node) and [`@mtcute/dispatcher`](https://www.npmjs.com/package/@mtcute/dispatcher).

## Features

- **SQLite Session Persistence**: Session auth tokens and peer entity caches are automatically saved to `data/userbot.session`.
- **Dispatcher Filters**: Handles `/ping` and `/echo` commands across `/` and `.` prefixes.
- **Graceful Shutdown**: Intercepts `SIGINT`/`SIGTERM` to flush SQLite transactions and disconnect cleanly.
- **Dual Mode**: Can run as an interactive user account (with phone/2FA prompts) or with an official `BOT_TOKEN`.

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your API_ID and API_HASH from https://my.telegram.org
   ```

3. **Start userbot**:
   ```bash
   npm start
   ```
   On first run, follow the terminal prompts to enter your phone number, Telegram login code, and cloud 2FA password (if enabled). Subsequent launches will resume automatically from the saved SQLite session.
