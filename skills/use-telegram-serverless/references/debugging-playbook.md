# Debugging & Code Audit Playbook

Read this reference for **Route 1 (Explain, Audit, or Review)**, **Route 6 (Validate & Test)**, and **Route 8 (Diagnose, Sync, or Upgrade)**.

---

## 1. Symptom $\rightarrow$ Root Cause $\rightarrow$ Safe Fix Matrix

### A. Bot & Webhook Symptoms

| Symptom | Likely Root Cause(s) | How to Diagnose | Safe Fix |
| :--- | :--- | :--- | :--- |
| **Bot does not respond to messages or button clicks at all** | 1. Local handler was never pushed (`tgcloud push`).<br>2. Handler file in `tgcloud/handlers/` is empty or misnamed (e.g., `messages.js` instead of `message.js`).<br>3. Webhook `allowed_updates` is out of sync.<br>4. Handler throws early on an unguarded property (e.g., `message.text.startsWith(...)` when a photo was sent). | 1. Run `npx tgcloud diff` (offline) or `npx tgcloud status` / `npx tgcloud webhook` (online).<br>2. Test the handler with `npx tgcloud run handlers/message '{ chat: { id: 1 }, text: "/start" }'` and inspect console output. | 1. Rename handler to exact Bot API update type (`handlers/message.js`, `handlers/callback_query.js`).<br>2. Guard optional fields (`if (typeof message.text !== 'string') return;`).<br>3. Run `npx tgcloud push` and, if webhook is out of sync, `npx tgcloud webhook sync`. |
| **Inline keyboard button spins forever after click** | `handlers/callback_query.js` is missing, failed before completion, or returned without calling `api.answerCallbackQuery`. | Run `npx tgcloud run handlers/callback_query '{ id: "1", from: { id: 1 }, data: "test" }'`. | Always call `await api.answerCallbackQuery({ callback_query_id: query.id })` in a `finally` block inside `tgcloud/handlers/callback_query.js`. |
| **`handler.default is not a function` or module import failure** | 1. Missing `export default async function` in handler/endpoint.<br>2. Relative import missing `.js` extension (`../schema` instead of `../schema.js`).<br>3. Attempted to import an npm package or file outside `tgcloud/`. | Inspect imports in `tgcloud/**/*.js` and run `node --check` on each file. | Use `export default async function` for handlers/endpoints, append `.js` to all relative imports, and move shared logic into `tgcloud/lib/`. |
| **`BotApiError: 429 Too Many Requests: retry after N`** | Sending or editing messages too rapidly in the same chat (e.g., unthrottled streaming edits or broadcast loops). | Inspect `err.code === 429` and `err.parameters?.retry_after`. | Throttle `editMessageText` calls to $\ge 1.5\text{s}$ intervals and respect `err.parameters.retry_after`. |

---

### B. Database & Migration Symptoms

| Symptom | Likely Root Cause(s) | How to Diagnose | Safe Fix |
| :--- | :--- | :--- | :--- |
| **`no such table` or `no such column` error in handler/endpoint** | `tgcloud/schema.js` was edited (or even pushed), but `npx tgcloud migrate` was never executed—or handlers were pushed before migrating. | Run `npx tgcloud migrate --dry-run` (or `--local --dry-run`) to see pending schema changes. | Push `schema.js` first (`npx tgcloud push schema`), run `npx tgcloud migrate --safe` (or interactive `migrate`), and verify 0 pending changes. |
| **`.references is not a function` or `foreignKey is not defined` in `schema.js`** | Attempted to use Drizzle foreign-key builders, which are prohibited on Telegram Serverless. | Search `tgcloud/schema.js` for `references` or `foreignKey`. | Remove `.references()` / `foreignKey()`. Declare foreign IDs as ordinary columns (`integer('user_id').notNull()`), add an `index()`, and enforce integrity in application queries. |
| **Query returns a QueryBuilder object instead of rows, or writes never persist** | Forgot to call and `await` the async terminal method (`.all()`, `.get()`, `.values()`, or `.run()`). | Search `tgcloud/` for `db.select`, `db.insert`, `db.update`, `db.delete` lacking `await ... .run()` / `.get()` / `.all()`. | Append the terminal method (`.get()`, `.all()`, `.run()`) and `await` the promise before returning from the handler/endpoint. |
| **Removed a column/table from `schema.js`, ran `migrate`, and the column/table is still there** | Deleting a definition from `schema.js` only marks it `undocumented`—it never drops data automatically. | Run `npx tgcloud migrate --dry-run` and check the `undocumented` section. | Restore the definition in `schema.js` with `.deprecated()` attached, push `schema.js`, run `npx tgcloud migrate` (with user approval for the `warning` drop), then remove the declaration from `schema.js`. |
| **`tgcloud migrate --safe` exited with code `0`, but schema changes are still unapplied** | The pending changes were classified as `warning` (e.g., unique index, drop) or `manual` (column type change), which `--safe` intentionally skips while still exiting `0`. | Read the printed summary from `npx tgcloud migrate --dry-run`. | Never treat exit code `0` alone as proof of migration completion. Address `manual` changes via expand-backfill-contract, or get explicit user authorization for `warning` changes. |

---

### C. Mini App, Endpoint & Static Hosting Symptoms

| Symptom | Likely Root Cause(s) | How to Diagnose | Safe Fix |
| :--- | :--- | :--- | :--- |
| **Frontend throws synchronously on `Serverless.call` before the callback runs** | The Mini App was opened in a regular browser tab (or via an inline link that doesn't provide `WebApp.initData`), where `window.Telegram.WebApp.Serverless` exists but `initData` is `""`. | Check `window.Telegram?.WebApp?.initData.length > 0` in the frontend code. | Gate UI calls on `typeof webApp?.Serverless?.call === 'function' && webApp?.initData?.length > 0` and wrap `Serverless.call(...)` inside `try { ... } catch {}`. |
| **Mini App receives generic `SERVER_ERROR` instead of validation message** | Endpoint threw a plain `new Error(...)` instead of `new EndpointError(...)` from `'sdk'`. | Run `npx tgcloud run endpoints/<name> '{...}' --ctx '{ initData: { user: { id: 1 } } }'` to see the uncaught exception in console logs. | Throw `new EndpointError('User-safe message', { code: 'VALIDATION_FAILED' })` for expected business errors; keep unexpected exceptions generic. |
| **Mini App works locally in Vite dev server, but deployed `https://app<id>.tgcloud.ai/` shows old UI** | 1. Ran `npx tgcloud push` without running `npm run build` first.<br>2. Marked `"/*"` or `"/index.html"` as `"immutable"` in `tgcloud.jsonc`. | Inspect `tgcloud.jsonc` `static` config and check build timestamps in `dist/`. | 1. Run `npm run build` before `npx tgcloud push`.<br>2. Restrict `"immutable"` in `tgcloud.jsonc` strictly to hashed asset paths (`["/assets/*"]`). |
| **Mini App opens on mobile Telegram, but shows blank/refused-to-connect in Telegram Web** | Custom `headers` in `tgcloud.jsonc` added `X-Frame-Options` or a restrictive `Content-Security-Policy: frame-ancestors`. | Inspect `tgcloud.jsonc` `static.headers`. | Remove `X-Frame-Options` and restrictive `frame-ancestors` headers (or set them to `null` to strip them). |

---

### D. CLI & Sync Symptoms

| Symptom | Likely Root Cause(s) | How to Diagnose | Safe Fix |
| :--- | :--- | :--- | :--- |
| **`tgcloud push` rejected due to cloud revision mismatch / conflict** | Someone edited the bot in `@BotFather` or pushed from another machine since your last sync. | Run `npx tgcloud fetch` (updates `.tgcloud/` snapshot only) followed by `npx tgcloud diff`. | **Never** run `push --force` or `reset` automatically. Preserve local files, inspect `tgcloud diff` after `fetch`, merge the remote changes into local files, and then push. |
| **CLI complains about legacy project layout** | Project was created before `@tgcloud/cli@0.2.0` (`schema.js`, `handlers/`, `lib/` at root instead of `tgcloud/`). | Run `npx tgcloud upgrade --dry-run`. | Ensure working tree is clean/backed up, then run `npx tgcloud upgrade` (when authorized). |

---

## 2. Comprehensive Code & Security Audit Checklist (Route 1)

When asked to review or audit an existing Telegram Serverless repository, systematically inspect and report findings across these 5 dimensions:

1. **Isolation & Module Boundaries**:
   - Are any files in `tgcloud/` importing npm packages, Node builtins (`fs`, `Buffer`, `process.env`), or frontend files outside `tgcloud/`?
   - Do all relative imports in `tgcloud/` include the `.js` extension?
   - Are `tgcloud/handlers/` and `tgcloud/endpoints/` flat directories with valid module names?
2. **Authorization & IDOR Prevention (Critical)**:
   - Do any endpoints in `tgcloud/endpoints/` trust `input.userId` instead of `ctx.initData.user.id`?
   - Do `SELECT`, `UPDATE`, and `DELETE` queries in endpoints and handlers include an ownership filter (`eq(table.userId, callerId)`) alongside the record primary key?
   - Are admin-only endpoints or bot commands protected by server-side verification?
3. **Database & Concurrency Integrity**:
   - Are there any `.references()` or `foreignKey()` calls in `tgcloud/schema.js`?
   - Are all `db` queries properly `await`ed with `.get()`, `.all()`, `.values()`, or `.run()`?
   - Are counters/balances updated atomically (`sql`${col} + 1`` / `.onConflictDoUpdate()`) rather than vulnerable to read-then-write race conditions?
   - Could any raw SQL (`db.run`, `db.all`, `db.get`) interpolate unchecked user input via string concatenation?
4. **Secret & Credential Hygiene**:
   - Is `.tgcloud/` listed in `.gitignore`?
   - Are any CLI tokens (`app<id>:<secret>`), Bot API tokens, or third-party secrets hardcoded in `tgcloud/`, frontend code, or `tgcloud.jsonc`?
   - Do `EndpointError` messages or `console.log` statements leak sensitive user data or internal database errors?
5. **Frontend & Static Hosting Safety**:
   - Does the frontend check both `typeof webApp?.Serverless?.call === 'function'` and `webApp?.initData?.length > 0` and catch synchronous throws?
   - Are endpoint results rendered safely (`textContent` / framework escaping) rather than `innerHTML`?
   - Does `tgcloud.jsonc` avoid caching mutable HTML as `immutable`, avoid `/api/` path collisions, and preserve iframe compatibility for Telegram Web?
