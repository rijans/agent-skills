# Runtime & SDK Reference (`sdk`, `sdk/api`, `sdk/fetch`)

Read this reference for **Route 3 (Build or Modify a Bot)**, **Route 9 (Full-Stack Build)**, or when reviewing backend modules in **Route 1**.

Authoritative sources:
- [Projects & Modules](https://core.telegram.org/bots/serverless#projects-and-modules)
- [The SDK](https://core.telegram.org/bots/serverless#the-sdk)
- [Telegram Bot API](https://core.telegram.org/bots/api)

---

## 1. V8 Isolate Runtime Contract

Telegram Serverless executes backend code in a lightweight, isolated **V8 sandbox**—**not** a Node.js server.

| Feature / Capability | Telegram Serverless V8 Sandbox | Common Pitfall to Avoid |
| :--- | :--- | :--- |
| **Module System** | Standard ES Modules (`import` / `export`) | Do not use CommonJS (`require`, `module.exports`). |
| **Local Imports** | Relative paths inside `tgcloud/` **must** end with `.js` (`import { fmt } from '../lib/fmt.js'`) | Bare paths (`../lib/fmt`) or importing outside `tgcloud/` will fail. |
| **SDK Imports** | `sdk`, `sdk/db`, `sdk/api`, `sdk/fetch` | Do not import `npm` packages in `tgcloud/`; there is no runtime `node_modules`. |
| **Binary Data** | Standard `Uint8Array`, `ArrayBuffer`, `TextEncoder`, `TextDecoder` | Do not use Node's `Buffer` (`Buffer.from` does not exist). |
| **Filesystem & OS** | None (ephemeral isolate) | Do not import `fs`, `path`, `os`, `child_process`, or `process`. |
| **State Persistence** | SQLite via `db` from `sdk` | Global variables in a module do **not** reliably persist across invocations. |
| **Environment Vars** | None documented at runtime (`TGCLOUD_TOKEN` is CLI-only) | Do not use `process.env` or invent `sdk.secrets`. |

---

## 2. Update Handlers (`tgcloud/handlers/<update_type>.js`)

- `tgcloud/handlers/` is **flat** (no subdirectories).
- Each filename matches a [Telegram Bot API `Update` field](https://core.telegram.org/bots/api#update).
- **Selective Activation**: An update type is routed to your bot **only if `tgcloud/handlers/<update_type>.js` exists and is non-empty**. Missing or empty handler files tell Telegram not to spin up an isolate for that update type.

### Handler Signature & Context

Every handler exports a `default async function (payload, ctx)`:

- **`payload`** (1st argument): The **unwrapped inner object** for that update type—**not** the outer `Update` envelope!
  - In `handlers/message.js`, the 1st argument is a [`Message`](https://core.telegram.org/bots/api#message).
  - In `handlers/callback_query.js`, the 1st argument is a [`CallbackQuery`](https://core.telegram.org/bots/api#callbackquery).
  - In `handlers/inline_query.js`, the 1st argument is an [`InlineQuery`](https://core.telegram.org/bots/api#inlinequery).
- **`ctx`** (2nd argument): Contains `ctx.update`, the raw outer [`Update`](https://core.telegram.org/bots/api#update) envelope (including `ctx.update.update_id`).

### Common Update Handler Types

| Handler File | 1st Argument (`payload`) Type | Typical Use Case |
| :--- | :--- | :--- |
| `handlers/message.js` | `Message` | Text commands (`/start`), photos, documents, `successful_payment` |
| `handlers/edited_message.js` | `Message` | Reacting to edited user messages |
| `handlers/callback_query.js` | `CallbackQuery` | Inline keyboard button presses (`callback_data`) |
| `handlers/inline_query.js` | `InlineQuery` | `@bot query` inline mode searches |
| `handlers/chosen_inline_result.js` | `ChosenInlineResult` | Tracking selected inline results |
| `handlers/pre_checkout_query.js` | `PreCheckoutQuery` | Approving/rejecting Telegram Stars & payment checkouts |
| `handlers/my_chat_member.js` | `ChatMemberUpdated` | Detecting when the bot is added/removed/promoted in groups or channels |
| `handlers/chat_member.js` | `ChatMemberUpdated` | User join/leave/role changes in groups |
| `handlers/chat_join_request.js` | `ChatJoinRequest` | Approving/declining group or channel join requests |
| `handlers/message_reaction.js` | `MessageReactionUpdated` | Emoji reactions added/removed on messages |
| `handlers/poll_answer.js` | `PollAnswer` | User votes in non-anonymous polls |

### Minimal Handler Example

```js
// tgcloud/handlers/message.js
import { api } from 'sdk';

export default async function (message, ctx) {
  // Always guard optional fields on Message (e.g. photo/sticker messages have no .text)
  if (typeof message.text !== 'string') return;

  const updateId = ctx.update.update_id;
  console.log(`Processing message in chat ${message.chat.id} (update ${updateId})`);

  await api.sendMessage({
    chat_id: message.chat.id,
    text: message.text === '/start' ? 'Welcome! Send me any text.' : `Echo: ${message.text}`,
  });
}
```

### Delivery & Concurrency Semantics

- Do not assume strict ordering, automatic retry suppression, or exactly-once delivery across updates.
- For operations with financial or external side effects (e.g., payments, webhooks, point awards), enforce idempotency in SQLite using `ctx.update.update_id` or a unique domain key (see [patterns-and-recipes.md](patterns-and-recipes.md)).

---

## 3. Calling the Telegram Bot API (`api` & `BotApiError`)

Import `api` and `BotApiError` from `'sdk'` (or `'sdk/api'`):

```js
import { api, BotApiError } from 'sdk';
```

### Calling Methods

- `await api.<methodName>(params)` supports every [Telegram Bot API method](https://core.telegram.org/bots/api#available-methods) (`sendMessage`, `editMessageText`, `answerCallbackQuery`, `sendPhoto`, `sendInvoice`, `answerPreCheckoutQuery`, `getChatMember`, etc.).
- No bot token is needed—the platform authenticates calls automatically.
- Parameters use standard Bot API **`snake_case`** (`chat_id`, `parse_mode`, `reply_markup`, `message_thread_id`).
- **Return Value**: Returns the unwrapped `result` field from the Bot API response directly (e.g., `const sentMsg = await api.sendMessage(...)` returns the `Message` object, not `{ ok: true, result: Message }`).

### Error Handling (`BotApiError`)

When a Bot API call fails (`ok: false`), it throws a `BotApiError`:

| Property | Type | Description |
| :--- | :--- | :--- |
| `err.code` | `number` | HTTP / Bot API error code (e.g., `400`, `403`, `429`) |
| `err.description` | `string` | Human-readable Telegram error description (e.g., `"Bad Request: message is not modified"`) |
| `err.method` | `string` | The Bot API method name that failed (e.g., `"editMessageText"`) |
| `err.parameters` | `object \| undefined` | Optional [`ResponseParameters`](https://core.telegram.org/bots/api#responseparameters), such as `{ retry_after: 5, migrate_to_chat_id: -100... }` |

```js
import { api, BotApiError } from 'sdk';

export async function safeEditText(chatId, messageId, text, replyMarkup) {
  try {
    return await api.editMessageText({
      chat_id: chatId,
      message_id: messageId,
      text,
      reply_markup: replyMarkup,
    });
  } catch (err) {
    if (err instanceof BotApiError) {
      // Ignore no-op edits specifically; rethrow real bugs
      if (err.code === 400 && err.description.includes('message is not modified')) {
        return null;
      }
      // User blocked the bot
      if (err.code === 403) {
        console.warn(`Bot blocked by chat ${chatId}: ${err.description}`);
        return null;
      }
    }
    throw err;
  }
}
```

- **Rule**: Catch only specific errors you can identify and recover from. Never wrap all `api.*` calls in a blanket `try { ... } catch {}` that hides malformed parameters, and never assume a generic `400` means a message was already deleted without checking `err.description`.

---

## 4. Files: Uploading & Downloading (`InputFile`, `getFileContent`, `getFileStream`)

### Uploading Binary Data (`InputFile`)

To upload generated files, images, CSVs, or binary bytes to any Bot API method (`sendDocument`, `sendPhoto`, `sendAudio`, `sendMediaGroup`, etc.), wrap a `Uint8Array` in `InputFile`:

```js
import { api, InputFile } from 'sdk';

export async function sendCsvReport(chatId, csvString) {
  const bytes = new TextEncoder().encode(csvString); // Uint8Array
  const file = new InputFile(bytes, 'report.csv', 'text/csv');

  await api.sendDocument({
    chat_id: chatId,
    document: file,
    caption: 'Here is your CSV export.',
  });
}
```

- `new InputFile(bytes, filename, mimeType?)`:
  - `bytes`: `Uint8Array` (never Node `Buffer`).
  - `filename`: `string` (e.g., `'chart.png'`).
  - `mimeType`: optional `string` (e.g., `'image/png'`).
- Works in top-level media fields (`photo`, `document`, `audio`, `video`, `voice`, `sticker`) as well as nested structures like `sendMediaGroup` items.

### Downloading Files from Telegram

Never construct raw `https://api.telegram.org/file/bot<token>/...` URLs (you don't need and shouldn't expose a bot token). Use the built-in helpers on `api`:

1. **Buffer entire file into memory (`api.getFileContent`)**:
   ```js
   // Returns Uint8Array with the complete file bytes
   const bytes = await api.getFileContent(message.document.file_id);
   const text = new TextDecoder().decode(bytes);
   ```
2. **Stream file bytes (`api.getFileStream`)**:
   ```js
   // Returns file metadata + a ReadableStream of Uint8Array chunks
   const { body, file_path, file_size } = await api.getFileStream(message.document.file_id);
   for await (const chunk of body) {
     // process Uint8Array chunk
   }
   ```
- Check current platform upload/download size caps in [sources.md](sources.md); streaming reduces peak memory usage when processing chunks, but does not bypass maximum file size limits.

---

## 5. Outbound HTTP (`fetch` & `FormData` from `sdk` / `sdk/fetch`)

Import `fetch` and `FormData` from `'sdk'` or `'sdk/fetch'`:

```js
import { fetch, FormData } from 'sdk/fetch';
```

### Request Helpers & Body Builders

- **`fetch(url, options?)`**: Perform outbound HTTP/HTTPS requests.
- **Request Body Helpers** (automatically set the matching `Content-Type` header):
  - `fetch.body.json(object)` $\rightarrow$ `application/json`
  - `fetch.body.form(object)` $\rightarrow$ `application/x-www-form-urlencoded`
  - `fetch.body.text(string)` $\rightarrow$ `text/plain;charset=UTF-8`
- **Multipart Form Uploads (`FormData`)**:
  - Create with `const form = new FormData()`, append strings, `Uint8Array`, or `InputFile`, and pass `body: form`.

### Handling Responses

```js
import { fetch } from 'sdk/fetch';

export async function fetchWeather(city) {
  const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Weather API failed with status ${res.status}`);
  }

  return await res.json(); // Also supports await res.text(), or streaming res.body
}
```

- Always check `res.ok` (or `res.status`) before parsing and trusting the response.
- Do not assume every browser or Node `undici` option (like custom TLS agents or keep-alive pools) exists—consult the project's generated `docs/tgcloud-sdk.md` for exact supported options.
- **External API Secrets**: Remember that Telegram Serverless does not currently document a built-in runtime secret store (`process.env` or `sdk.secrets`). If the user asks to call a third-party API requiring a private API key (e.g., OpenAI, Stripe), highlight this platform gap clearly before hardcoding secrets or storing them in a restricted admin-configured database table.

---

## 6. Logging (`console`)

- `console.log`, `console.info`, `console.warn`, and `console.error` are available globally.
- During `npx tgcloud run` (or when testing in `@BotFather`), console output is captured and displayed alongside the execution duration and return value.
- **Privacy & Security**: Log event types, update IDs, and error codes—never log credentials, CLI tokens, Mini App `initData` signatures, or sensitive user PII.
