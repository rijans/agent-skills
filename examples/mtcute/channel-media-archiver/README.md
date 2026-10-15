# mtcute Channel Media Archiver

High-performance streaming media archiver for Telegram channels, groups, and discussions using [`@mtcute/node`](https://www.npmjs.com/package/@mtcute/node).

## Why This Matters

Standard Telegram Bot API limits file downloads to 20MB. In contrast, `mtcute` connects directly via MTProto 2.0, enabling streaming downloads of files up to **2GB** (or **4GB** for Telegram Premium accounts) directly to disk using `tg.downloadToFile()` with zero Out-Of-Memory (OOM) heap crashes.

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with API_ID, API_HASH, and TARGET_CHANNEL
   ```

3. **Start the archiver**:
   ```bash
   npm start
   ```
