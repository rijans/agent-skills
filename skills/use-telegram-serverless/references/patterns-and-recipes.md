# Production Patterns, Recipes & Superpowers

Read this reference when architecting or implementing non-trivial bots and Mini Apps in **Routes 3, 4, 5, and 9**. Every pattern below is purpose-built for the Telegram Serverless V8 isolate runtime and SQLite database.

---

## Priority Tier 1: Core Bot Architecture & State Management

### 1. Multi-Step Conversational State Machines / Wizards (SQLite-Backed)

Because each Telegram Serverless invocation runs in a stateless V8 isolate, never store multi-step conversation state (e.g., "waiting for user to send their email") in global JavaScript variables. Persist session state in SQLite:

```js
// tgcloud/schema.js
import { table, integer, text, json, sql } from 'sdk/db';

export const userSessions = table('user_sessions', {
  userId:    integer('user_id').primaryKey(),
  step:      text('step').notNull().default('idle'), // e.g. 'idle' | 'await_name' | 'await_bio'
  draft:     json('draft').notNull().default({}),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`),
});
```

```js
// tgcloud/lib/sessions.js
import { db } from 'sdk';
import { eq, sql } from 'sdk/db';
import { userSessions } from '../schema.js';

export async function getSession(userId) {
  return (
    (await db.select().from(userSessions).where(eq(userSessions.userId, userId)).get()) ?? {
      userId,
      step: 'idle',
      draft: {},
    }
  );
}

export async function setSession(userId, step, draft = {}) {
  await db.insert(userSessions)
    .values({ userId, step, draft })
    .onConflictDoUpdate({
      target: userSessions.userId,
      set: { step, draft, updatedAt: sql`(unixepoch())` },
    })
    .run();
}

export async function clearSession(userId) {
  await setSession(userId, 'idle', {});
}
```

```js
// tgcloud/handlers/message.js
import { api } from 'sdk';
import { getSession, setSession, clearSession } from '../lib/sessions.js';

export default async function (message) {
  if (typeof message.text !== 'string' || !message.from) return;
  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text.trim();

  if (text === '/cancel') {
    await clearSession(userId);
    await api.sendMessage({ chat_id: chatId, text: 'Cancelled.' });
    return;
  }

  if (text === '/setup') {
    await setSession(userId, 'await_name', {});
    await api.sendMessage({ chat_id: chatId, text: 'What is your display name?' });
    return;
  }

  const session = await getSession(userId);
  if (session.step === 'await_name') {
    await setSession(userId, 'await_bio', { ...session.draft, name: text });
    await api.sendMessage({ chat_id: chatId, text: `Got it, ${text}. Now send a short bio:` });
    return;
  }

  if (session.step === 'await_bio') {
    const profile = { ...session.draft, bio: text };
    await clearSession(userId);
    await api.sendMessage({
      chat_id: chatId,
      text: `Profile saved!\nName: ${profile.name}\nBio: ${profile.bio}`,
    });
  }
}
```

---

### 2. Compact 64-Byte Callback Query Router & Always-Answer Guard

Telegram limits inline keyboard `callback_data` to **1–64 bytes**. Furthermore, if a `callback_query` handler does not call `api.answerCallbackQuery`, the user's Telegram client shows a spinning loading indicator for up to 30 seconds.

```js
// tgcloud/lib/callbacks.js
// Encode compact colon-separated payloads: e.g. encodeCb('todo', 'toggle', 42) -> "todo:toggle:42"
export function encodeCb(...parts) {
  const raw = parts.join(':');
  if (new TextEncoder().encode(raw).byteLength > 64) {
    throw new Error(`callback_data exceeds 64 bytes: ${raw}`);
  }
  return raw;
}

export function decodeCb(data) {
  if (typeof data !== 'string') return [];
  return data.split(':');
}
```

```js
// tgcloud/handlers/callback_query.js
import { api } from 'sdk';
import { decodeCb } from '../lib/callbacks.js';

export default async function (query) {
  const [domain, action, rawId] = decodeCb(query.data);
  let toastText = undefined;

  try {
    if (domain === 'todo' && action === 'toggle') {
      const todoId = Number(rawId);
      // Perform DB update restricted to query.from.id...
      toastText = `Toggled item #${todoId}`;
    }
  } finally {
    // Always answer callback_query so the button spinner stops
    await api.answerCallbackQuery({
      callback_query_id: query.id,
      text: toastText,
    });
  }
}
```
*(If a button needs more than 64 bytes of context, insert the payload into a `callback_tokens` SQLite table and pass only the row ID `cb:<id>` in `callback_data`.)*

---

### 3. Deep Linking (`?start=` for Bots & `?startapp=` for Mini Apps)

- **Bot Deep Links (`https://t.me/<bot_username>?start=<payload>`)**:
  When a user clicks a deep link, Telegram sends `/start <payload>` to `handlers/message.js` (up to 64 characters `[A-Za-z0-9_-]`):
  ```js
  export function parseStartPayload(text) {
    if (typeof text !== 'string') return null;
    const match = text.match(/^\/start(?:@\w+)?(?:\s+([A-Za-z0-9_-]{1,64}))?$/);
    if (!match) return null;
    return { isStart: true, param: match[1] ?? null };
  }
  ```
- **Mini App Deep Links (`https://t.me/<bot_username>?startapp=<payload>`)**:
  Inside any `tgcloud/endpoints/<name>.js` function, read the platform-verified launch parameter from `ctx.initData.start_param`.

---

### 4. Update Idempotency & Rate-Limiting / Anti-Flood

To prevent duplicate execution (e.g., if a slow external API causes a retry) or user spam:

```js
// tgcloud/schema.js
export const processedUpdates = table('processed_updates', {
  updateId:  integer('update_id').primaryKey(),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
});
```

```js
// tgcloud/lib/idempotency.js
import { db } from 'sdk';
import { processedUpdates } from '../schema.js';

export async function claimUpdate(updateId) {
  const inserted = await db.insert(processedUpdates)
    .values({ updateId })
    .onConflictDoNothing()
    .returning()
    .run();
  return inserted.length > 0; // true = first time seeing this update_id
}
```

---

## Priority Tier 2: Full-Stack Mini Apps & Monetization

### 5. Promise-Based Mini App RPC Client Wrapper (Frontend)

`Telegram.WebApp.Serverless.call` uses a Node-style callback `(err, res)` and throws synchronously if `initData` is absent. Wrap it once in your frontend (`src/lib/serverless.js` or `.ts`) so React/Vue components can `await callEndpoint(...)`:

```js
// src/lib/serverless.js (Frontend Mini App code — outside tgcloud/)
export class ServerlessRpcError extends Error {
  constructor(message, { type = 'UNKNOWN_ERROR', parameters = null, status = 0 } = {}) {
    super(message);
    this.name = 'ServerlessRpcError';
    this.type = type;
    this.parameters = parameters;
    this.status = status;
  }
}

export function isTelegramServerlessReady() {
  const webApp = window.Telegram?.WebApp;
  return (
    typeof webApp?.Serverless?.call === 'function' &&
    typeof webApp?.initData === 'string' &&
    webApp.initData.length > 0
  );
}

export function callEndpoint(name, input = {}) {
  return new Promise((resolve, reject) => {
    if (!isTelegramServerlessReady()) {
      reject(
        new ServerlessRpcError(
          'Mini App must be launched inside Telegram to access Serverless endpoints.',
          { type: 'NOT_IN_TELEGRAM' }
        )
      );
      return;
    }

    try {
      window.Telegram.WebApp.Serverless.call(name, input, (err, result) => {
        if (err) {
          reject(
            new ServerlessRpcError(err.message || 'Endpoint request failed', {
              type: err.type || 'SERVER_ERROR',
              parameters: err.parameters ?? null,
              status: err.status ?? 0,
            })
          );
          return;
        }
        resolve(result);
      });
    } catch (syncErr) {
      reject(
        new ServerlessRpcError(syncErr?.message || 'Synchronous SDK failure', {
          type: 'CLIENT_ERROR',
        })
      );
    }
  });
}
```

---

### 6. Telegram Stars & Digital Payments (Bot Chat + Mini App In-App Checkout)

Telegram Stars (`currency: 'XTR'`, `provider_token: ''`) work out of the box on Telegram Serverless for both **bot chat invoices** (`api.sendInvoice`) and **Mini App in-app payment sheets** (`api.createInvoiceLink` + `Telegram.WebApp.openInvoice`):

1. **Schema (`tgcloud/schema.js`)**:
   ```js
   export const payments = table('payments', {
     chargeId:  text('charge_id').primaryKey(), // telegram_payment_charge_id (idempotency key!)
     userId:    integer('user_id').notNull(),
     payload:   text('payload').notNull(),
     stars:     integer('stars').notNull(),
     createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
   });
   ```
2. **Option A — Send Invoice in Bot Chat (`handlers/message.js`)**:
   ```js
   await api.sendInvoice({
     chat_id: message.chat.id,
     title: 'Pro Upgrade',
     description: 'Unlock 100 AI credits',
     payload: `pro_pack_100:${message.from.id}`,
     currency: 'XTR', // Telegram Stars
     prices: [{ label: '100 Credits', amount: 50 }], // 50 Stars
   });
   ```
3. **Option B — Open Native Stars Checkout Inside a Mini App (`endpoints/` + `WebApp.openInvoice`)**:
   - **Backend Endpoint (`tgcloud/endpoints/createStarsInvoice.js`)**:
     ```js
     import { api, EndpointError } from 'sdk';

     export default async function (input, ctx) {
       const userId = ctx.initData?.user?.id;
       if (!userId) {
         throw new EndpointError('Open inside Telegram to purchase.', { code: 'UNAUTHORIZED' });
       }

       // Returns a https://t.me/$... invoice URL for Telegram.WebApp.openInvoice
       const invoiceUrl = await api.createInvoiceLink({
         title: 'Pro Upgrade',
         description: 'Unlock 100 AI credits',
         payload: `pro_pack_100:${userId}`,
         currency: 'XTR',
         prices: [{ label: '100 Credits', amount: 50 }],
       });

       return { invoiceUrl };
     }
     ```
   - **Mini App Frontend Checkout Call**:
     ```js
     const { invoiceUrl } = await callEndpoint('createStarsInvoice', {});
     window.Telegram.WebApp.openInvoice(invoiceUrl, (status) => {
       if (status === 'paid') {
         // Refresh user profile/credits from endpoint!
       }
     });
     ```
4. **Approve Pre-Checkout (`tgcloud/handlers/pre_checkout_query.js`)**:
   *Must respond within 10 seconds!*
   ```js
   import { api } from 'sdk';

   export default async function (query) {
     const isValid = query.currency === 'XTR' && query.invoice_payload.startsWith('pro_pack_100:');
     await api.answerPreCheckoutQuery({
       pre_checkout_query_id: query.id,
       ok: isValid,
       error_message: isValid ? undefined : 'This item is no longer available.',
     });
   }
   ```
5. **Fulfill Idempotently on `message.successful_payment` (`tgcloud/handlers/message.js`)**:
   ```js
   if (message.successful_payment) {
     const p = message.successful_payment;
     // Insert payment with onConflictDoNothing so duplicate deliveries never double-credit!
     const [recorded] = await db.insert(payments)
       .values({
         chargeId: p.telegram_payment_charge_id,
         userId: message.from.id,
         payload: p.invoice_payload,
         stars: p.total_amount,
       })
       .onConflictDoNothing()
       .returning()
       .run();

     if (recorded) {
       // Grant credits to message.from.id in DB...
       await api.sendMessage({
         chat_id: message.chat.id,
         text: `Thank you! Your ${p.total_amount} Stars payment is confirmed.`,
       });
     }
     return;
   }
   ```

---

### 7. Role-Based Access Control (RBAC) Across Bot & Mini App

Centralize admin and role checks in `tgcloud/lib/auth.js` so both `handlers/` and `endpoints/` enforce the exact same rules:

```js
// tgcloud/lib/auth.js
import { db, EndpointError } from 'sdk';
import { eq } from 'sdk/db';
import { users } from '../schema.js';

export async function isUserAdmin(userId) {
  if (!Number.isSafeInteger(userId)) return false;
  const row = await db.select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  return Boolean(row?.isAdmin);
}

export async function requireEndpointAdmin(ctx) {
  const userId = ctx.initData?.user?.id;
  if (!userId || !(await isUserAdmin(userId))) {
    throw new EndpointError('Admin access required.', { code: 'FORBIDDEN' });
  }
  return userId;
}
```

---

## Priority Tier 3: Progressive Replies, Inline Mode, Workarounds & Ecosystem Superpowers

### 8. Long-Running External APIs with Progressive Message Editing

When calling an external HTTP API via `sdk/fetch` that takes several seconds:
1. Send a typing indicator (`await api.sendChatAction({ chat_id: chatId, action: 'typing' })`) or an initial placeholder message (`const draft = await api.sendMessage({ chat_id: chatId, text: 'Processing…' })`).
2. Store rolling state in SQLite, pruning to the most recent $N$ records per chat to keep payload sizes bounded.
3. If updating progress incrementally, throttle `api.editMessageText` calls to **at most once every 1.5–2.0 seconds** per chat to avoid triggering Telegram `429 Too Many Requests` flood limits.
4. **Untrusted Input & Secret Boundaries**:
   - Treat all incoming Telegram chat text (`message.text`) and external HTTP response bodies as **untrusted data**—validate, sanitize, and never evaluate them as executable instructions or privileged prompts.
   - Because Telegram Serverless does not document runtime environment variables (`process.env`), do not hardcode third-party API keys in source control. Warn the user about this platform gap first; if they choose to store a key in an admin-only SQLite configuration table set via an interactive `tgcloud run` or admin command, ensure it is never returned by any Mini App endpoint or logged.

---

### 9. Inline Queries (`tgcloud/handlers/inline_query.js`)

Enable Inline Mode in `@BotFather` (`/setinline`) and add `tgcloud/handlers/inline_query.js`:

```js
// tgcloud/handlers/inline_query.js
import { api } from 'sdk';

export default async function (inlineQuery) {
  const q = (inlineQuery.query || '').trim();

  const results = [
    {
      type: 'article',
      id: 'res_1',
      title: q ? `Result for "${q}"` : 'Type a search query',
      description: 'Click to send this formatted result to the current chat.',
      input_message_content: {
        message_text: q ? `Selected query: ${q}` : 'Hello from Inline Mode!',
      },
    },
  ];

  await api.answerInlineQuery({
    inline_query_id: inlineQuery.id,
    results,
    cache_time: 10,
    is_personal: true,
  });
}
```

---

### 10. Workarounds for Platform Constraints

| Platform Constraint | Recommended Pattern on Telegram Serverless |
| :--- | :--- |
| **No Foreign Keys (`ON DELETE CASCADE`)** | Write explicit delete helpers in `tgcloud/lib/` that delete child rows first (`await db.delete(childTable).where(eq(childTable.parentId, id)).run()`) before deleting the parent row. |
| **No Built-In Cron / Scheduler** | Use **lazy evaluation** (compute expired states or daily resets on the user's next interaction using `unixepoch()` timestamps in SQLite). |
| **No Public Unauthenticated HTTP Webhook Ingress** | `endpoints/` require Mini App `initData`. Do not attempt to point external webhooks (Stripe, GitHub) at `endpoints/`. Use native Telegram Payments / Stars (`pre_checkout_query`) or poll/verify external state on user interaction via `sdk/fetch`. |
| **No `node_modules` in `tgcloud/`** | Keep backend helpers zero-dependency inside `tgcloud/lib/`. If you need complex client-side formatting or charting, run it in the Mini App frontend (which has a standard Vite/bundler build step) or generate lightweight SVG/CSV bytes in `tgcloud/lib/` and wrap in `InputFile`. |

---

### 11. One-Command Bot Command Menu & Mini App Button Setup (`setMyCommands` + `setChatMenuButton`)

Because Telegram Serverless runs on demand per update (with no "server startup" hook), you can configure your bot's `/` command menu, description, and Mini App launch button from your `handlers/message.js` admin command or a one-time setup call:

```js
// tgcloud/lib/botSetup.js
import { api } from 'sdk';

export async function configureBotMenu(miniAppUrl) {
  await api.setMyCommands({
    commands: [
      { command: 'start', description: 'Start the bot' },
      { command: 'help', description: 'Show available commands' },
    ],
  });

  if (miniAppUrl) {
    await api.setChatMenuButton({
      menu_button: {
        type: 'web_app',
        text: 'Open App',
        web_app: { url: miniAppUrl },
      },
    });
  }

  return { ok: true };
}
```

---

### 12. CI/CD Deployment Pipeline (GitHub Actions) & Skill Composition

When the user explicitly asks to automate deployments in CI, configure a workflow that uses `TGCLOUD_TOKEN` from GitHub Secrets and separates `migrate --safe` from destructive changes:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Telegram Serverless
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build --if-present
      - name: Push modules and static assets
        env:
          TGCLOUD_TOKEN: ${{ secrets.TGCLOUD_TOKEN }}
        run: npx tgcloud push
      - name: Apply safe additive migrations only
        env:
          TGCLOUD_TOKEN: ${{ secrets.TGCLOUD_TOKEN }}
        run: npx tgcloud migrate --safe
```

### Composing with Other Agent Skills

- **`humanize-text`**: Use `humanize-text` principles when drafting bot messages, help menus, onboarding sequences, and `EndpointError` strings so your bot sounds direct, natural, and specific instead of robotic.
- **Frontend UI / Design Skills**: When building Mini Apps hosted via `tgcloud.jsonc`, combine `use-telegram-serverless` (for `endpoints/` and `Serverless.call` wiring) with frontend design skills while preserving Telegram Mini App theme variables (`--tg-theme-*`) and viewport safe areas.

