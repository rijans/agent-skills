# Project Audit & Cloud Conflict Recovery Example

## Brief

Audit an existing Telegram Serverless project offline, then safely diagnose and resolve a `tgcloud push` revision conflict caused by an out-of-band edit in `@BotFather`.

## Solution

### Part 1: Strictly Offline Project Audit (Route 1)

When asked to review a repository **offline**:

```bash
# 1. Inspect working tree and cached cloud diff (100% offline — do NOT run 'tgcloud status')
git status --short
npx tgcloud diff

# 2. Check JavaScript syntax across all tgcloud modules
node --check tgcloud/schema.js
node --check tgcloud/handlers/message.js
```

**Sample Audit Report**:
- **Selected Route**: Route 1 (Explain, Audit, or Review — Offline).
- **Findings**:
  1. `tgcloud/schema.js:14` calls `.references(() => users.id)` on `orders.userId`. Telegram Serverless does not support foreign keys; remove `.references()` and enforce ownership in queries.
  2. `tgcloud/endpoints/getOrder.js:9` queries `eq(orders.id, input.orderId)` without constraining by `ctx.initData.user.id` (IDOR vulnerability). Add `and(eq(orders.id, input.orderId), eq(orders.userId, ctx.initData.user.id))`.
  3. `tgcloud.jsonc:6` sets `"immutable": ["/*"]`, which caches `/index.html` for 1 year. Change to `["/assets/*"]`.
- **Operational Status**: Offline checks only (`git status`, `tgcloud diff`, `node --check`). Remote `run`, `push`, and `migrate` were not executed.

---

### Part 2: Safe Cloud Revision Conflict Recovery (Route 8)

If an authorized `npx tgcloud push` fails because the cloud holds a newer revision (e.g., edited in `@BotFather`):

```bash
# 1. NEVER run 'tgcloud push --force' or 'tgcloud reset' automatically!
# 2. Refresh .tgcloud/ snapshot metadata from the cloud WITHOUT touching local source files:
npx tgcloud fetch

# 3. Inspect the exact line-by-line differences between local edits and the new cloud snapshot:
npx tgcloud diff
```

After reviewing `npx tgcloud diff` with the user:
- If the remote change is only in `handlers/help.js` while your local change is in `handlers/message.js`:
  ```bash
  # Pull only the remote module you didn't edit locally, or push only your targeted module:
  npx tgcloud pull handlers/help
  npx tgcloud push handlers/message
  ```
- If both local and cloud edited the same file, merge the needed lines in your working copy, verify with `npx tgcloud diff`, and run `npx tgcloud push`.
