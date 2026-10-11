# Setup, Project Anatomy & Authentication

Read this reference for **Route 2 (Set Up, Scaffold, or Link)** or when diagnosing project layout, CLI version, or authentication issues in **Route 8**.

Authoritative sources:
- [Getting Started](https://core.telegram.org/bots/serverless#getting-started)
- [Projects & Modules](https://core.telegram.org/bots/serverless#projects-and-modules)
- [Authentication](https://core.telegram.org/bots/serverless#authentication)
- [On the go with BotFather](https://core.telegram.org/bots/serverless#on-the-go-with-botfather)

---

## 1. Preflight Inspection

Before running any setup command:

1. **Inspect the workspace**: Check `git status`, `package.json`, lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`), existing agent instructions (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`), and any existing `tgcloud/` or legacy root modules (`schema.js`, `handlers/`, `lib/`).
2. **Verify Node.js & CLI versions**:
   - `@tgcloud/cli` and `@tgcloud/create-bot` require **Node.js `>=18.0.0`**. Respect the user's installed toolchain if it satisfies the engine constraint.
   - Check `node_modules/@tgcloud/cli/package.json` or `package.json` `devDependencies` before running `npx tgcloud ...`. During a read-only review, never execute an `npx` command that would silently download and install an uncached package.
3. **BotFather Prerequisite**:
   - The bot owner must enable Serverless in [@BotFather](https://t.me/BotFather) (**Open Bot $\rightarrow$ Serverless $\rightarrow$ Turn On**).
   - Never infer that Serverless is enabled in BotFather just because `@tgcloud/cli` is installed locally, and never attempt to automate the user's personal Telegram account.

---

## 2. Creating or Adopting a Project

Use the official project creator or CLI initializer when authorized to scaffold a project:

```bash
# Create a new project in a target folder (or '.' for current directory)
npm create @tgcloud/bot my-bot

# Or initialize inside an existing directory using an installed CLI
npx tgcloud init
```

### Scaffolding Behavior & Frontend Coexistence

- **Non-destructive**: Both `npm create @tgcloud/bot` and `tgcloud init` never overwrite existing files. Calling `tgcloud init` again in the same root safely fills in any missing starter files, while refusing to create nested projects inside an existing `tgcloud` project.
- **Adding Serverless to an existing Mini App frontend**:
  - Run `npm create @tgcloud/bot .` or `npx tgcloud init` at the **root of the frontend project** (e.g., a Vite/React/Vue repository).
  - The initializer creates `tgcloud/` alongside your frontend `src/`, detects your build output folder (such as `dist`), creates `tgcloud.jsonc`, and adds `"deploy"` / `"status"` scripts to `package.json` if not already present.
  - Always inspect `git diff` and `package.json` after initialization—do not assume a pre-existing `"deploy"` script runs `tgcloud push`.

---

## 3. Project Anatomy (CLI `>=0.2.0`)

```text
my-bot/
├─ tgcloud/                  # ONLY .js files inside tgcloud/ are deployed as backend modules
│  ├─ handlers/              # Update handlers — FLAT directory (one level only)
│  │  ├─ message.js          # Handles 'message' updates
│  │  └─ callback_query.js   # Handles 'callback_query' updates
│  ├─ endpoints/             # Mini App RPC endpoints — FLAT directory (one level only)
│  │  └─ getProfile.js       # Called via Telegram.WebApp.Serverless.call('getProfile', ...)
│  ├─ lib/                   # Shared helper modules — subdirectories ALLOWED
│  │  ├─ format.js
│  │  └─ payments/stars.js
│  └─ schema.js              # SQLite database schema (single file, named table exports)
├─ docs/
│  └─ tgcloud-sdk.md         # Auto-scaffolded SDK reference for humans and AI agents
├─ AGENTS.md                 # Auto-scaffolded AI orientation guide (preserve custom edits)
├─ tgcloud.jsonc             # Project & Mini App static hosting configuration
├─ package.json
└─ .tgcloud/                 # CLI state & credentials (git-ignored; NEVER read or edit manually)
```

### Scaffolding Individual Modules (`tgcloud add`)

Use `npx tgcloud add` to create a starter module with documented comments:

```bash
npx tgcloud add handlers/callback_query
npx tgcloud add handlers/inline_query
npx tgcloud add endpoints/saveSettings
npx tgcloud add lib/auth/permissions
```

- `tgcloud add` refuses to overwrite an existing file.
- Check the installed CLI (`npx tgcloud add --help`) for supported handler update types rather than relying on a hardcoded list.
- Remember that adding a handler file locally does nothing in production until you run `npx tgcloud push` (and sync the webhook if out of sync).

### Upgrading Legacy Projects (`<0.2.0`)

Projects created before `@tgcloud/cli@0.2.0` placed `schema.js`, `handlers/`, and `lib/` at the project root instead of inside `tgcloud/`.

1. Preview the layout migration without touching files:
   ```bash
   npx tgcloud upgrade --dry-run
   ```
2. Preserve any uncommitted local changes first, then run `npx tgcloud upgrade` when authorized.
3. `upgrade` moves the backend modules into `tgcloud/`, updates relative import paths, and preserves the `.tgcloud/` bot link—no redeploy is required just for the local folder move. Do not manually move `.tgcloud/` state files.

---

## 4. Authentication & Credential Security (Bot Token vs. CLI Token)

### Two Different Tokens — Do Not Confuse Them!

| Token Type | Format | Needed in Telegram Serverless? | Purpose |
| :--- | :--- | :--- | :--- |
| **Bot API Token** | `123456789:ABC-DEF...` | **NO — Never needed!** | Used by external servers (VPS/Cloudflare). On Telegram Serverless, `api.*` from `'sdk'` is **automatically authenticated** inside Telegram's cloud without a Bot API token. |
| **Serverless CLI Access Token** | `app<id>:<secret>` | **Yes — For `tgcloud` CLI only** | Authenticates your local machine or CI runner to run `tgcloud push`, `migrate`, `run`, `pull`, `fetch`, and `webhook`. |

- Where the developer gets the CLI Access Token: **@BotFather $\rightarrow$ Open Bot $\rightarrow$ Serverless (Turn On) $\rightarrow$ CLI Access $\rightarrow$ Access token**.

### Best-Practice Developer Handoff Protocol (When the Agent Needs Cloud Access)

Why shouldn't an agent ask *"Please paste your token in chat"*?
1. Pasting a secret into an AI chat window leaks it to conversation logs and LLM history, and passing it inline in shell commands exposes it in shell history and process tables.
2. Security scanners on `skills.sh` (`Gen Agent Trust Hub`, `Socket`, `Snyk`) fail skills that encourage pasting raw tokens into chat or passing them as command arguments.

Instead, follow this **4-Step Handoff Protocol**:

1. **Do Not Block Local Work**: Writing `tgcloud/schema.js`, `handlers/`, `endpoints/`, `lib/`, `tgcloud.jsonc`, and running `node --check` or `npx tgcloud diff` require **zero tokens**. Complete all local code and offline checks first.
2. **Check If Already Authenticated (Without Reading Secrets)**:
   - Check whether the `.tgcloud` directory exists (`test -d .tgcloud`) or whether `TGCLOUD_TOKEN` is non-empty in the environment (`[ -n "$TGCLOUD_TOKEN" ]`)—**never** `cat` or read the files inside `.tgcloud/` or echo `$TGCLOUD_TOKEN`.
   - If the developer is already logged in, proceed directly with authorized `npx tgcloud ...` commands!
3. **Guide Interactive Terminal Login (When Unauthenticated)**:
   - If cloud execution (`run`, `push`, `migrate`) is requested and no login state exists, give the developer these exact steps to run in their own terminal (or run `npx tgcloud login` in an interactive terminal where the developer types the token directly into the masked prompt):
     ```bash
     # 1. In Telegram, open @BotFather -> Your Bot -> Serverless -> CLI Access -> Copy token (app<id>:<secret>)
     # 2. In your terminal, run:
     npx tgcloud login
     ```
   - `login` validates the token, saves it inside `.tgcloud/` (which is automatically git-ignored), and never prints the `<secret>` portion.
   - Once the developer confirms `npx tgcloud login` succeeded, the agent immediately runs the authorized `npx tgcloud push` / `migrate` / `run` commands using the stored `.tgcloud/` session.
4. **CI / Headless Environments (`TGCLOUD_TOKEN`)**:
   - In CI/CD pipelines (e.g., GitHub Actions) or headless shells where interactive `login` isn't used, the developer sets `TGCLOUD_TOKEN` in their protected environment/secrets store.
   - When `TGCLOUD_TOKEN` is set in the environment, `@tgcloud/cli` uses it automatically and takes precedence over `.tgcloud/`.

### Strict Security Rules
- **Never** ask the user to paste their CLI access token or Bot API token into the chat.
- **Never** pass a token as a command-line argument or log it to stdout/stderr.
- **Never** read or hand-edit files inside `.tgcloud/`.
- **Never** place the CLI token or Bot API token inside `tgcloud/` backend modules or Mini App frontend code.

---

## 5. BotFather & Multi-Client Synchronization

Every piece of the cloud project—**Handlers**, **Endpoints**, **Library (`lib/`)**, **Database (`schema.js` & migrations)**, **Mini App Files**, and **CLI Access**—is also editable directly inside [@BotFather](https://t.me/BotFather) on mobile or desktop.

- Edits saved in BotFather immediately update the cloud deployment.
- Consequently, a local workspace may be behind or diverged from the cloud even if no one else pushed from Git.
- Always check divergence (`tgcloud diff` offline, or `tgcloud fetch` + `tgcloud status` when network checks are authorized) before assuming local files match production.

---

## 6. Shell Tab Completion (Optional)

```bash
tgcloud completion bash   # or zsh, fish
```

- Completion hooks into a globally accessible `tgcloud` binary (`npm install -g @tgcloud/cli`), **not** `npx tgcloud`.
- Do not install `@tgcloud/cli` globally or modify the user's `~/.bashrc` / `~/.zshrc` unless the user explicitly asks for shell completion.
