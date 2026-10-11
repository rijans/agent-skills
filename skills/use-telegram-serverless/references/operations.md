# CLI Operations, Testing, Deployment & Synchronization

Read this reference for **Route 6 (Validate & Test)**, **Route 7 (Deploy Changes)**, **Route 8 (Diagnose, Sync, or Upgrade)**, or when planning operational handoffs in **Route 9**.

Authoritative source:
- [CLI Reference](https://core.telegram.org/bots/serverless#command-line-interface)
- [Staying in Sync](https://core.telegram.org/bots/serverless#staying-in-sync)

---

## 1. Complete `tgcloud` Command & Side-Effect Matrix

All commands below assume the already-installed project-local CLI (`npx tgcloud <cmd>` or the project's package script).

| Command | Network Call? | Local Files / State Effect | Cloud / Live Bot Effect |
| :--- | :--- | :--- | :--- |
| `tgcloud diff [target...]` | **No** (100% offline) | Reads local working files & cached `.tgcloud/` snapshot | None |
| `tgcloud status` | **Conditional!** Calls `GET /webhook` if token exists | Reads local working files & cached `.tgcloud/` snapshot | None (read-only webhook check; silently ignores network errors) |
| `tgcloud fetch` | **Yes** | Updates cached cloud snapshot inside `.tgcloud/` (preserves working files) | None (reads deployed modules/revision) |
| `tgcloud run <module> [input] [--ctx <ctx>]` | **Yes** | Reads local `tgcloud/` modules | **Executes in live cloud sandbox!** Can mutate live DB, send real Bot API messages, and call external APIs (does not publish code) |
| `tgcloud push [target...] [--force]` | **Yes** | Updates cached `.tgcloud/` snapshot on success | **Publishes modules and/or static files to production** (full push deletes remote modules missing locally) |
| `tgcloud migrate [--dry-run] [--local] [--safe] [--yes]` | **Yes** | Reads deployed (or `--local`) `schema.js` | `--dry-run` inspects live DB; other modes **modify live SQLite tables/indexes** |
| `tgcloud pull [target...]` | **Yes** | **Overwrites local `tgcloud/` working files** with deployed cloud versions (leaves static build folder untouched) | None |
| `tgcloud reset [target...]` | **No** (offline) | **Discards local `tgcloud/` edits**, restoring from the last cached `.tgcloud/` snapshot (leaves static build folder untouched) | None |
| `tgcloud webhook` | **Yes** | None | None (inspects live Bot API webhook status, `allowed_updates`, pending count, last error) |
| `tgcloud webhook sync [--drop-pending]` | **Yes** | None | **Reconfigures live bot webhook routing & `allowed_updates`** (`--drop-pending` permanently deletes queued updates!) |
| `tgcloud upgrade [--dry-run]` | **No** | Moves legacy root `schema.js`, `handlers/`, `lib/` into `tgcloud/` | None |

### Crucial Nuance: `status` Is Not Strictly Offline

In `@tgcloud/cli@0.2.0`, running `npx tgcloud status` checks whether a saved token or `TGCLOUD_TOKEN` is present and, if so, makes an authenticated `GET /webhook` request (silently swallowing network errors if offline).
- Therefore, **if the user requests a strictly offline inspection**, use `npx tgcloud diff` and direct file reads—do **not** run `npx tgcloud status`, and never delete `.tgcloud/` credentials just to force `status` offline.

---

## 2. Validation & Testing Tiers

Match your validation method to the user's authorized scope:

### Tier 1: Offline Local Validation (Always Safe)

1. **Syntax & Parse Check**:
   ```bash
   node --check tgcloud/schema.js
   ```
   *(Run `node --check` on every changed `.js` file inside `tgcloud/` to catch syntax errors before any cloud call. Note: `node --check` only parses syntax; it does not resolve `'sdk'` imports.)*
2. **Contract & Layout Audit**:
   - Verify `tgcloud/handlers/` and `tgcloud/endpoints/` are flat, `tgcloud/lib/` imports end in `.js`, no `.references()` exist in `schema.js`, and every `db` query awaits its terminal.
3. **Offline Diff**:
   ```bash
   npx tgcloud diff
   ```
   Compares working files against the last known cloud snapshot in `.tgcloud/` without touching the network.
4. **Unit Testing Pure `lib/` Logic**:
   - Pure helper modules in `tgcloud/lib/` that do not import `'sdk'` (or accept `db`/`api` via dependency injection) can be tested offline with `node --test`. Remember that mocks prove your JavaScript logic, not Telegram platform behavior.

### Tier 2: Remote Sandbox Execution (`npx tgcloud run`)

When authorized to run a live remote test:

```bash
# Test a message handler with JSON5 input
npx tgcloud run handlers/message '{ chat: { id: 123456 }, from: { id: 123456 }, text: "/start" }'

# Test a message handler with explicit outer Update context (ctx.update)
npx tgcloud run handlers/message '{ chat: { id: 123456 }, text: "ping" }' \
  --ctx '{ update: { update_id: 9001 } }'

# Test a Mini App endpoint with synthetic verified user context (ctx.initData)
npx tgcloud run endpoints/getProfile '{}' \
  --ctx '{ initData: { user: { id: 123456, first_name: "Alice" } } }'
```

**Rules for `tgcloud run`**:
- **Always use the qualified module path** (`handlers/message`, `endpoints/getProfile`) because bare names are ambiguous if both `handlers/foo.js` and `endpoints/foo.js` exist.
- Both `[input]` and `--ctx <ctx>` accept **JSON5** and **must evaluate to JSON objects** (`{...}`), not arrays, primitives, or `null`.
- **Side Effects Warning**: `tgcloud run` bundles your current local `tgcloud/` files and runs them in Telegram's cloud against your **real database and real Bot API**. If your handler calls `api.sendMessage({ chat_id: 123456, ... })` or `db.delete(...)`, that message is actually sent and those rows are actually deleted!
- **Synthetic Context Limitation**: Passing `--ctx '{ initData: { user: { id: 123 } } }'` bypasses platform signature checks so you can test endpoint logic. It **does not** prove that an unauthenticated browser call would be rejected (the platform enforces that automatically on real Mini App calls).

---

## 3. Safe Deployment Workflow (`npx tgcloud push`)

1. **Inspect Local & Remote State**:
   - Check `git status` and `npx tgcloud diff`.
   - If you need to know whether someone else (or BotFather) modified the cloud since your last sync, run `npx tgcloud fetch` followed by `npx tgcloud status` / `npx tgcloud diff` (when network access is authorized).
2. **Choose Targeted vs. Full Push**:
   - **Targeted Push** (safer when modifying specific files on an existing bot):
     ```bash
     npx tgcloud push schema handlers/message lib/format
     ```
     Uploads only the named modules; never deletes other remote modules and leaves static Mini App files untouched.
   - **Static-Only Push**:
     ```bash
     npm run build
     npx tgcloud push dist   # where "dist" matches static.source in tgcloud.jsonc
     ```
   - **Full Project Push** (mirrors local `tgcloud/` + `static.source`):
     ```bash
     npx tgcloud push
     ```
     **Warning**: A full push **deletes** any remote module that is absent from your local `tgcloud/` directory! Never run a full push from an incomplete or freshly initialized folder against an existing production bot without `pull`ing first.
3. **Database Sequencing**:
   - If new handlers or endpoints depend on new tables/columns in `tgcloud/schema.js`:
     1. `npx tgcloud push schema`
     2. `npx tgcloud migrate --dry-run` $\rightarrow$ `npx tgcloud migrate --safe` (with authorization)
     3. `npx tgcloud push` (remaining handlers/endpoints)
4. **Verify Webhook & Static Output**:
   - Record the new revision number and, for Mini Apps, the deployed static URL (`https://app<app_id>.tgcloud.ai/`).
   - If you added or deleted a file in `tgcloud/handlers/`, verify that the webhook `allowed_updates` list is in sync (`npx tgcloud webhook`).

---

## 4. Concurrency, Conflict Recovery & Rollback

### Handling a Rejected `push` (Revision Conflict)

Telegram Serverless tracks a monotonic cloud revision. If someone edited the bot in `@BotFather` or pushed from another machine since your last sync, `npx tgcloud push` stops with a conflict error.

**Safe Conflict Resolution Protocol**:
1. **STOP.** Never automatically run `npx tgcloud push --force` (which overwrites remote changes) or `npx tgcloud reset` / `npx tgcloud pull` (which destroys local uncommitted changes).
2. Preserve your local edits (e.g., commit or stash in Git, or copy modified files).
3. Run `npx tgcloud fetch` to update `.tgcloud/`'s knowledge of the latest cloud snapshot without overwriting your local files.
4. Run `npx tgcloud diff` to inspect the exact line-by-line differences between your local files and the newly fetched cloud snapshot.
5. Present the diff to the user and reconcile both changes before pushing.

### Distinction: `fetch` vs. `pull` vs. `reset`

- **`tgcloud fetch`**: Downloads the latest cloud snapshot into `.tgcloud/` metadata only. Your working files in `tgcloud/` are untouched. After `fetch`, `tgcloud diff` compares your local files against the latest cloud state.
- **`tgcloud pull`**: Fetches from the cloud **and overwrites** your working files in `tgcloud/` (does not touch your frontend static folder).
- **`tgcloud reset`**: **Offline** operation that overwrites your working files in `tgcloud/` with whatever snapshot was last cached in `.tgcloud/`. It does **not** talk to the cloud and does **not** roll back a deployed bot!

### Rolling Back Production

- **Code Rollback**: Check out the known-good commit in Git, verify the diff against the current cloud state (`tgcloud fetch && tgcloud diff`), and run an authorized `npx tgcloud push`.
- **Database Caveat**: Rolling back `tgcloud/schema.js` or handler code **cannot restore dropped tables or deleted rows**. Telegram Serverless does not document a built-in CLI database backup/restore command—never execute destructive migrations without explicit user confirmation and a verified data export/recovery plan.

---

## 5. Webhook Inspection & Synchronization (`npx tgcloud webhook`)

Telegram Serverless manages the bot's webhook URL automatically and configures `allowed_updates` to match your non-empty `tgcloud/handlers/<update_type>.js` files.

```bash
# Inspect webhook state, allowed_updates, pending update count, and last error
npx tgcloud webhook

# Re-synchronize webhook routing and allowed_updates with deployed handlers
npx tgcloud webhook sync
```

- **Never set a custom webhook URL** via `api.setWebhook`—doing so breaks Telegram Serverless routing! Use `npx tgcloud webhook sync` to restore platform routing.
- **`--drop-pending` Hazard**: `npx tgcloud webhook sync --drop-pending` permanently discards all updates currently queued for the bot. Only use `--drop-pending` if the user explicitly asks to flush a stuck update queue (e.g., an infinite crash loop on a poison update).
