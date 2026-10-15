# Raw TL Calls, RPC Errors & Flood Wait Management

This guide covers executing low-level MTProto methods using `tg.call()`, resolving `InputPeer` objects, and handling RPC errors and flood waits with `tl.RpcError`.

---

## 1. Executing Raw MTProto Methods (`tg.call`)

When higher-level convenience helpers do not expose a specific Telegram feature (e.g. checking username availability, querying reaction counts, administrative logs), execute raw TL RPC calls directly:

```typescript
import { TelegramClient } from '@mtcute/node'

const tg = new TelegramClient({
  apiId: 123456,
  apiHash: 'abcdef...',
  storage: 'userbot',
})

// Check username availability
const isAvailable = await tg.call({
  _: 'account.checkUsername',
  username: 'my_awesome_bot',
})

console.log('Is username available:', isAvailable)
```

### Fetching Full Channel Info & Chat History

```typescript
// 1. Resolve peer to get access hash
const peer = await tg.resolvePeer('telegram')

// 2. Query message history
const history = await tg.call({
  _: 'messages.getHistory',
  peer,
  offsetId: 0,
  offsetDate: 0,
  addOffset: 0,
  limit: 20,
  maxId: 0,
  minId: 0,
  hash: 0n,
})

console.log(`Fetched ${history.messages.length} messages.`)
```

---

## 2. Resolving InputPeers

In Telegram's MTProto protocol, raw API methods cannot accept arbitrary string usernames or raw numeric IDs directly. They require an `InputPeer` object containing both the entity ID and an `access_hash` token granted by Telegram:

```typescript
// Resolve username, phone, or ID to InputPeer
const inputPeer = await tg.resolvePeer('@durov')

// Resolves to:
// { _: 'inputPeerUser', userId: 12345, accessHash: 1234567890123456789n }
```

`mtcute` automatically caches access hashes in your SQLite storage driver, so subsequent queries do not make redundant network calls.

---

## 3. Handling RPC Errors & `tl.RpcError`

All errors returned by Telegram servers are instances of `tl.RpcError`. Use `tl.RpcError.is()` to test error codes type-safely.

```typescript
import { tl } from '@mtcute/node'

try {
  await tg.call({
    _: 'channels.joinChannel',
    channel: await tg.resolvePeer('@some_channel'),
  })
} catch (err) {
  if (tl.RpcError.is(err, 'FLOOD_WAIT_%d')) {
    console.warn(`Rate-limited! Must wait ${err.seconds} seconds before joining.`)
    await new Promise((r) => setTimeout(r, err.seconds * 1000))
  } else if (tl.RpcError.is(err, 'CHANNEL_PRIVATE')) {
    console.error('Cannot join: channel is private and requires an invite link.')
  } else if (tl.RpcError.is(err, 'CHANNELS_TOO_MUCH')) {
    console.error('Account has reached the maximum number of joined channels (500/1000).')
  } else {
    throw err
  }
}
```

---

## 4. Automatic Flood Wait Handling (`floodSleepThreshold`)

Telegram will reject requests with `FLOOD_WAIT_X` if a client makes too many requests in a short window.

By default, `TelegramClient` can automatically pause and wait when the delay is within reasonable bounds:

```typescript
const tg = new TelegramClient({
  apiId: 123456,
  apiHash: 'abcdef...',
  storage: 'userbot',
  // Automatically sleep on FLOOD_WAIT if delay is <= 120 seconds.
  // Throws FLOOD_WAIT if delay is > 120 seconds.
  floodSleepThreshold: 120,
})
```

---

## 5. Resilient Scraping Loop with Exponential Backoff

When bulk-processing channels or users, combine peer resolution with jittered delay:

```typescript
import { tl } from '@mtcute/node'

async function safeBatchProcess(tg: TelegramClient, targets: string[]) {
  for (const target of targets) {
    let attempts = 0
    let success = false

    while (!success && attempts < 3) {
      try {
        attempts++
        const peer = await tg.resolvePeer(target)
        console.log(`Processed: ${target}`)
        success = true

        // Polite delay between queries (300-800ms)
        const jitter = 300 + Math.random() * 500
        await new Promise((r) => setTimeout(r, jitter))
      } catch (err) {
        if (tl.RpcError.is(err, 'FLOOD_WAIT_%d')) {
          console.warn(`Flood wait hit for ${target}. Sleeping ${err.seconds}s...`)
          await new Promise((r) => setTimeout(r, (err.seconds + 1) * 1000))
        } else if (tl.RpcError.is(err, 'USERNAME_NOT_OCCUPIED')) {
          console.warn(`Username ${target} does not exist. Skipping.`)
          break
        } else {
          console.error(`Unexpected error on ${target}:`, err)
          break
        }
      }
    }
  }
}
```
