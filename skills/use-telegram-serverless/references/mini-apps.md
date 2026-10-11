# Mini Apps, Endpoints & Static Hosting Reference

Read this reference for **Route 4 (Build or Modify a Mini App)**, **Route 9 (Full-Stack Build)**, or when diagnosing Mini App endpoint/hosting issues in **Routes 1 & 8**.

Authoritative sources:
- [Endpoints](https://core.telegram.org/bots/serverless#endpoints)
- [Calling an Endpoint from the Mini App](https://core.telegram.org/bots/serverless#calling-an-endpoint-from-the-mini-app)
- [Mini App Front-End Hosting](https://core.telegram.org/bots/serverless#mini-app-front-end)
- [`Telegram.WebApp.Serverless.call` Specification](https://core.telegram.org/bots/webapps#serverless)

---

## 1. Backend Endpoints (`tgcloud/endpoints/<name>.js`)

- `tgcloud/endpoints/` is **flat** (no subdirectories).
- Each file `tgcloud/endpoints/<name>.js` exposes an RPC endpoint named `<name>`.
- **Naming Rules**: Endpoint names may contain only ASCII letters (`a-z`, `A-Z`), digits (`0-9`), and underscores (`_`), and **cannot start with a digit** (e.g., `getProfile.js`, `save_order_2.js`).
- **Scope**: Endpoints are authenticated RPC functions exclusively for your bot's Telegram Mini App. They are **not** generic public HTTP webhooks (third-party services like Stripe or GitHub cannot call them directly because calls without valid Telegram Mini App `initData` are rejected by the platform before your code runs).

### Endpoint Signature & Authentication (`(input, ctx)`)

Every endpoint exports a `default async function (input, ctx)`:

- **`input`** (1st argument): The parsed JSON value passed by the Mini App frontend (typically an object; validate its shape and types defensively!).
- **`ctx`** (2nd argument): Contains `ctx.initData`, the **platform-verified** [`WebAppInitData`](https://core.telegram.org/bots/webapps#webappinitdata) object (`ctx.initData.user`, `ctx.initData.auth_date`, `ctx.initData.start_param`, `ctx.initData.chat_type`, etc.).

### Zero-Trust Authorization Rules

1. **Identity comes from `ctx.initData.user.id`**:
   - For real Mini App traffic, Telegram Serverless cryptographically verifies `initData` before invoking your endpoint.
   - Always guard `const userId = ctx.initData?.user?.id; if (!userId) throw new EndpointError('Authentication required.', { code: 'AUTH_REQUIRED' });`.
2. **Never trust client-supplied identity**:
   - Ignore any `input.userId` or `input.ownerId` sent by the browser, and never use client-side `Telegram.WebApp.initDataUnsafe` as backend proof of identity.
3. **Identity $\neq$ Authorization**:
   - Knowing who the caller is (`ctx.initData.user.id`) does not authorize them to read or mutate arbitrary record IDs.
   - Constrain every database query by `ctx.initData.user.id` (or verify explicit admin role membership first).
4. **`tgcloud run` with `--ctx` is unverified**:
   - Running `npx tgcloud run endpoints/getNote '{ noteId: 1 }' --ctx '{ initData: { user: { id: 123 } } }'` tests your JavaScript logic with a synthetic object—it does **not** test platform signature verification.

### Throwing Public vs. Internal Errors (`EndpointError`)

Import `EndpointError` from `'sdk'`:

```js
// tgcloud/endpoints/updateNote.js
import { db, EndpointError } from 'sdk';
import { and, eq } from 'sdk/db';
import { notes } from '../schema.js';

export default async function (input, ctx) {
  const userId = ctx.initData?.user?.id;
  if (!userId) {
    throw new EndpointError('Please open this app inside Telegram.', { code: 'UNAUTHORIZED' });
  }

  const noteId = input?.noteId;
  const body = typeof input?.body === 'string' ? input.body.trim() : '';

  if (!Number.isSafeInteger(noteId) || noteId <= 0) {
    throw new EndpointError('Invalid note ID.', { code: 'INVALID_ID' });
  }
  if (!body || body.length > 2000) {
    throw new EndpointError('Note must be between 1 and 2,000 characters.', { code: 'INVALID_BODY' });
  }

  const [updated] = await db.update(notes)
    .set({ body })
    .where(and(eq(notes.id, noteId), eq(notes.ownerId, userId)))
    .returning()
    .run();

  if (!updated) {
    throw new EndpointError('Note not found or access denied.', { code: 'NOT_FOUND' });
  }

  return { id: updated.id, body: updated.body };
}
```

- **`new EndpointError(message, parameters?)`**:
  - Intentionally exposes `message` and the optional `parameters` object (e.g., `{ code: 'NOT_FOUND', field: 'noteId' }`) to the Mini App frontend as `error.type === 'ENDPOINT_ERROR'`.
  - Keep `EndpointError` messages safe for end users; never put SQL errors, stack traces, or internal secrets inside `EndpointError`.
- **Any other uncaught Error**:
  - The platform logs the full error on the server and sends a generic error (`SERVER_ERROR`) to the client so internal details are never leaked.
- **Return Value**: Must be JSON-serializable.

---

## 2. Calling Endpoints from the Mini App Frontend

Include the official Telegram Mini App script in your frontend HTML (`<head>`):

```html
<script src="https://telegram.org/js/telegram-web-app.js"></script>
```

### `Telegram.WebApp.Serverless.call(name, input?, callback)`

- **Signature**:
  - `Telegram.WebApp.Serverless.call(name, callback)` (when no input is needed)
  - `Telegram.WebApp.Serverless.call(name, input, callback)`
- **Callback-based (not a native Promise)**:
  - `callback` is invoked as `(error, result) => { ... }`.
  - On success: `error` is `null` (or falsy) and `result` is the parsed JSON value returned by the endpoint.
  - On failure: `error` is an object with:
    - `error.message` (`string`): Error description.
    - `error.type` (`string`, optional): e.g., `'ENDPOINT_ERROR'` (thrown via `EndpointError`), `'UNAUTHORIZED'`, `'SERVER_ERROR'`, `'NETWORK_ERROR'`.
    - `error.parameters` (`object`, optional): The custom parameters object passed to `new EndpointError(msg, params)`.
    - `error.status` (`number`, optional): HTTP status code (`0` if the request failed before receiving an HTTP response).

### Critical Frontend Trap: Synchronous Throw When `initData` Is Missing

`window.Telegram.WebApp.Serverless` is defined by `telegram-web-app.js` **even when the page is opened in a regular browser tab outside Telegram**. However, if `Telegram.WebApp.initData` is empty, calling `Serverless.call(...)` **throws a synchronous exception immediately** before invoking your callback!

Always check **both** `typeof webApp?.Serverless?.call === 'function'` **and** `typeof webApp?.initData === 'string' && webApp.initData.length > 0`, and wrap `Serverless.call` in a `try / catch` block (or use the Promise wrapper below).

### Safe Vanilla JS Example

```html
<button id="save-btn" type="button" disabled>Save Note</button>
<p id="status" role="status"></p>

<script src="https://telegram.org/js/telegram-web-app.js"></script>
<script>
  const btn = document.getElementById('save-btn');
  const statusEl = document.getElementById('status');
  const webApp = window.Telegram?.WebApp;
  const serverless = webApp?.Serverless;

  const canCallServerless =
    typeof serverless?.call === 'function' &&
    typeof webApp?.initData === 'string' &&
    webApp.initData.length > 0;

  if (!canCallServerless) {
    statusEl.textContent = 'Open this Mini App inside Telegram to continue.';
  } else {
    webApp.ready();
    btn.disabled = false;

    btn.addEventListener('click', () => {
      btn.disabled = true;
      statusEl.textContent = 'Saving…';

      const onComplete = (err, data) => {
        btn.disabled = false;
        if (err) {
          if (err.type === 'ENDPOINT_ERROR') {
            statusEl.textContent = err.message;
          } else if (err.type === 'UNAUTHORIZED') {
            statusEl.textContent = 'Session expired. Please reopen the app in Telegram.';
          } else {
            statusEl.textContent = 'Could not save note. Please try again.';
          }
          return;
        }
        // Always use textContent (or framework auto-escaping) to prevent XSS
        statusEl.textContent = `Saved: ${data.body}`;
      };

      try {
        serverless.call('updateNote', { noteId: 1, body: 'Hello Serverless!' }, onComplete);
      } catch (syncErr) {
        onComplete({ type: 'CLIENT_ERROR', message: syncErr?.message || 'Call failed' });
      }
    });
  }
</script>
```

*(See [patterns-and-recipes.md](patterns-and-recipes.md) for a reusable `callEndpoint(name, input)` Promise/TypeScript wrapper for React, Vue, and Vite apps.)*

---

## 3. Mini App Static Hosting (`tgcloud.jsonc` / `tgcloud.json`)

Telegram Serverless hosts your Mini App's static build output at:
`https://app<app_id>.tgcloud.ai/`

Configure static hosting in `tgcloud.jsonc` (JSON with comments) or strict `tgcloud.json` at the project root.

### Complete `tgcloud.jsonc` Schema (`@tgcloud/cli@0.2.0`)

```jsonc
{
  "$schema": "./node_modules/@tgcloud/cli/schema/tgcloud.json",
  "static": {
    // Required: build output folder relative to project root
    "source": "dist",

    // Optional: serve /index.html for unknown extensionless paths (client-side routing)
    "spa": true,

    // Optional: path patterns given 'Cache-Control: public, max-age=31536000, immutable'
    // ONLY use for content-hashed asset paths!
    "immutable": ["/assets/*"],

    // Optional: custom HTTP response headers per path pattern (exact '/path' or prefix '/dir/*')
    // Set a header value to null in a more specific rule to remove an inherited header.
    "headers": {
      "/*": {
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin"
      },
      "/tonconnect-manifest.json": {
        "Access-Control-Allow-Origin": "*"
      }
    },

    // Optional: evaluated top-to-bottom on first match; existing static files ALWAYS take priority
    "redirects": [
      { "from": "/old-page", "to": "/new-page", "status": 301 },
      { "from": "/docs/*", "to": "/help", "status": 302 }
    ]
  }
}
```

### Static Hosting Rules & Pitfalls

1. **Shorthand vs. Removal vs. Unmanaged**:
   - `"static": "dist"` is shorthand for `{ "source": "dist" }`.
   - `"static": false` **deletes the deployed static site** on the next full `npx tgcloud push`.
   - **Omitting the `"static"` key** (or deleting `tgcloud.jsonc`) tells the CLI to stop managing static files—leaving any currently hosted static files untouched in the cloud.
2. **Build Before Push**:
   - `npx tgcloud push` uploads the contents of the `static.source` folder as-is; it **does not** run `npm run build` automatically.
   - Always run your frontend build (`npm run build`) and verify the output folder exists and is fresh before running `npx tgcloud push` (or use `npm run deploy` if configured as `vite build && tgcloud push`).
3. **Never Mark `index.html` as `immutable`**:
   - Patterns in `immutable` receive a 1-year immutable cache header. Only include content-hashed asset directories (like Vite's `["/assets/*"]`). Marking `"/*"` or `"/index.html"` as `immutable` will lock users onto stale HTML for a year.
4. **Path Pattern Syntax**:
   - Path patterns in `immutable`, `headers`, and `redirects.from` must start with `/` and be either an exact path (`"/index.html"`) or a prefix ending with `/*` (`"/assets/*"`, `"/*"`). Arbitrary mid-string globs (`"/*.js"`) are invalid under `schema/tgcloud.json`.
5. **Reserved `/api/` Prefix & Iframe Headers**:
   - The platform reserves `/api/*` on `app<app_id>.tgcloud.ai` for internal Mini App endpoint routing—do not place static files under `dist/api/`.
   - Telegram Web opens Mini Apps inside an `<iframe>`. **Never** set `X-Frame-Options: DENY` / `SAMEORIGIN` or a restrictive `Content-Security-Policy: frame-ancestors 'none'` in `headers`, or your Mini App will fail to load in Telegram Web/Desktop.
6. **Dotfiles & Secrets**:
   - Dotfiles (e.g., `.env`, `.DS_Store`) inside `static.source` are automatically skipped by the CLI.
   - Never bundle private API keys or `TGCLOUD_TOKEN` into `VITE_*` / `NEXT_PUBLIC_*` frontend environment variables or source maps.
7. **Targeted Static vs. Module Pushes**:
   - `npx tgcloud push` (no arguments) deploys **both** `tgcloud/` modules and the `static.source` folder.
   - `npx tgcloud push handlers/message` deploys **only** that module and leaves static hosting untouched.
   - `npx tgcloud push dist` (where `dist` matches `static.source`) deploys **only** the static frontend and leaves backend modules untouched.
