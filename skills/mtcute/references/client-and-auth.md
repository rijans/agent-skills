# Client Configuration, Storage & Authentication

This guide covers initializing the `TelegramClient`, configuring session storage backends, authenticating users and bots, and exporting session strings for containerized or ephemeral deployments.

---

## 1. Initializing `TelegramClient`

In Node.js, import `TelegramClient` from `@mtcute/node`:

```typescript
import { TelegramClient } from '@mtcute/node'

export const tg = new TelegramClient({
  apiId: Number.parseInt(process.env.API_ID || '0', 10),
  apiHash: process.env.API_HASH || '',
  storage: 'my-account', // Creates my-account.session (SQLite)
  floodSleepThreshold: 60, // Automatically sleep on flood waits <= 60s
  logLevel: process.env.NODE_ENV === 'production' ? 1 : 2, // 1: error, 2: warn, 3: info, 4: debug
})
```

### Key Configuration Options

| Option | Type | Description |
| :--- | :--- | :--- |
| `apiId` | `number` | **Required**. Telegram application API ID from [my.telegram.org](https://my.telegram.org). |
| `apiHash` | `string` | **Required**. 32-character hexadecimal application hash. |
| `storage` | `string \| StorageDriver` | Path to session file (creates SQLite DB) or a custom storage driver instance. |
| `floodSleepThreshold` | `number` | Maximum seconds to automatically sleep on `FLOOD_WAIT` errors (default: `60`). |
| `initConnection` | `Partial<tl.raw.RawInitConnection>` | Override client device model, system version, app version, and system language code. |
| `transport` | `string \| TransportFactory` | Transport protocol (default: intermediate TCP). |

---

## 2. Session Storage Options

### Persistent Storage: SQLite (`SqliteStorage`)

For server applications and long-running daemons, use SQLite persistence. In `@mtcute/node`, passing a file path string automatically instantiates `SqliteStorage`:

```typescript
import { TelegramClient, SqliteStorage } from '@mtcute/node'

// Both declarations are equivalent:
const tg1 = new TelegramClient({
  apiId: 123456,
  apiHash: 'abcdef...',
  storage: 'data/account.session',
})

const tg2 = new TelegramClient({
  apiId: 123456,
  apiHash: 'abcdef...',
  storage: new SqliteStorage('data/account.session'),
})
```

> **Warning**: SQLite creates companion files (`.session-wal`, `.session-shm`). Add `*.session*` to `.gitignore` to prevent committing sensitive keys.

### Ephemeral Storage: `MemoryStorage`

For serverless functions, tests, or short-lived ephemeral workers, use in-memory storage from `@mtcute/core`:

```typescript
import { TelegramClient } from '@mtcute/node'
import { MemoryStorage } from '@mtcute/core'

const tg = new TelegramClient({
  apiId: 123456,
  apiHash: 'abcdef...',
  storage: new MemoryStorage(),
})
```

---

## 3. User Authentication Flows

The `.start()` method manages the complete authorization workflow.

### Interactive Terminal Login (Default)

Running `await tg.start()` without parameters will prompt for the phone number, login code, and 2FA password in the interactive terminal:

```typescript
import { TelegramClient } from '@mtcute/node'

const tg = new TelegramClient({
  apiId: 123456,
  apiHash: 'abcdef...',
  storage: 'userbot',
})

async function run() {
  const user = await tg.start()
  console.log(`Successfully authenticated as @${user.username} (${user.id})`)
}

run().catch(console.error)
```

### Programmatic / Headless Login with Custom Callbacks

Provide explicit callback functions for headless servers, web dashboards, or REST auth endpoints:

```typescript
const user = await tg.start({
  phone: async () => process.env.TELEGRAM_PHONE || '+1234567890',
  code: async () => {
    // E.g. fetch code from SMS receiver, webhook, or console prompt
    return await promptUserForOtpCode()
  },
  password: async (hint) => {
    // Called only if 2FA (cloud password) is enabled on the account
    console.log(`2FA Hint: ${hint}`)
    return process.env.TELEGRAM_2FA_PASSWORD || ''
  },
})
```

### QR Code Login

Authenticate by scanning a QR code from an existing Telegram app session:

```typescript
import qrcode from 'qrcode-terminal'

const user = await tg.start({
  qrCode: (url) => {
    console.log('Scan this QR code with Telegram Settings > Devices > Link Desktop Device:')
    qrcode.generate(url, { small: true })
  },
})
```

---

## 4. Bot Token Authentication

To connect as an official bot via MTProto (bypassing HTTP Bot API restrictions while using bot privileges):

```typescript
const bot = await tg.start({
  botToken: process.env.BOT_TOKEN, // E.g. "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
})

console.log(`Bot logged in: @${bot.username}`)
```

---

## 5. String Sessions for Ephemeral / Container Environments

When deploying to stateless platforms (Docker, Railway, Fly.io, Kubernetes) where persistent local disk is unavailable, export the authorized session to a base64 string.

### Exporting the Session (Run Once Locally)

```typescript
import { TelegramClient } from '@mtcute/node'

const tg = new TelegramClient({
  apiId: Number(process.env.API_ID),
  apiHash: process.env.API_HASH!,
  storage: 'temp-session',
})

async function exportToken() {
  await tg.start()
  const sessionString = await tg.exportSession()
  console.log('\n--- STORE THIS IN YOUR PRODUCTION .ENV ---')
  console.log(`SESSION_STRING="${sessionString}"`)
  console.log('-------------------------------------------\n')
  await tg.close()
}

exportToken()
```

### Importing Session in Production

Pass the session string directly to `.start({ session })` using `MemoryStorage` or SQLite:

```typescript
import { TelegramClient } from '@mtcute/node'
import { MemoryStorage } from '@mtcute/core'

const tg = new TelegramClient({
  apiId: Number(process.env.API_ID),
  apiHash: process.env.API_HASH!,
  storage: new MemoryStorage(),
})

async function main() {
  const user = await tg.start({
    session: process.env.SESSION_STRING,
  })
  console.log(`Booted ephemeral client as @${user.username}`)
}
```

---

## 6. Graceful Shutdown & Socket Cleanup

Always close client connections on process shutdown to release database locks and notify the MTProto gateway:

```typescript
async function shutdown() {
  console.log('\nShutting down TelegramClient gracefully...')
  try {
    await tg.close()
    console.log('Session closed safely.')
    process.exit(0)
  } catch (err) {
    console.error('Error during shutdown:', err)
    process.exit(1)
  }
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
```
