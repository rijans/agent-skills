# Authoritative Sources, Section Map & Platform Boundaries

Consult this reference when verifying version-sensitive platform behavior, checking official documentation anchors, or evaluating whether a requested feature is supported on Telegram Serverless.

---

## 1. Complete Official Documentation Map (`core.telegram.org/bots/serverless`)

| Official Documentation Section | Anchor URL | Corresponding Skill Reference |
| :--- | :--- | :--- |
| **Recent Changes (Oct 6, 2026 / CLI 0.2.0)** | [`#recent-changes`](https://core.telegram.org/bots/serverless#recent-changes), [`#october-6-2026`](https://core.telegram.org/bots/serverless#october-6-2026) | [setup.md](setup.md), [mini-apps.md](mini-apps.md), [operations.md](operations.md) |
| **Why Serverless & Mental Model** | [`#why-serverless`](https://core.telegram.org/bots/serverless#why-serverless), [`#the-mental-model`](https://core.telegram.org/bots/serverless#the-mental-model), [`#quick-demo`](https://core.telegram.org/bots/serverless#quick-demo) | [SKILL.md](../SKILL.md), [runtime-sdk.md](runtime-sdk.md) |
| **Getting Started (Steps 1–8)** | [`#getting-started`](https://core.telegram.org/bots/serverless#getting-started), [`#1-create-a-project`](https://core.telegram.org/bots/serverless#1-create-a-project) – [`#8-keep-in-sync`](https://core.telegram.org/bots/serverless#8-keep-in-sync) | [setup.md](setup.md), [database.md](database.md), [operations.md](operations.md) |
| **Building with AI & BotFather** | [`#building-with-ai`](https://core.telegram.org/bots/serverless#building-with-ai), [`#on-the-go-with-botfather`](https://core.telegram.org/bots/serverless#on-the-go-with-botfather) | [setup.md](setup.md) |
| **Projects, Anatomy & Module System** | [`#projects-and-modules`](https://core.telegram.org/bots/serverless#projects-and-modules), [`#anatomy-of-a-project`](https://core.telegram.org/bots/serverless#anatomy-of-a-project), [`#the-module-system`](https://core.telegram.org/bots/serverless#the-module-system), [`#what-gets-deployed`](https://core.telegram.org/bots/serverless#what-gets-deployed) | [setup.md](setup.md), [runtime-sdk.md](runtime-sdk.md), [operations.md](operations.md) |
| **Update Handlers** | [`#handlers`](https://core.telegram.org/bots/serverless#handlers) | [runtime-sdk.md](runtime-sdk.md), [patterns-and-recipes.md](patterns-and-recipes.md) |
| **Mini App Endpoints & Frontend Calls** | [`#endpoints`](https://core.telegram.org/bots/serverless#endpoints), [`#calling-an-endpoint-from-the-mini-app`](https://core.telegram.org/bots/serverless#calling-an-endpoint-from-the-mini-app) | [mini-apps.md](mini-apps.md), [patterns-and-recipes.md](patterns-and-recipes.md) |
| **Mini App Front-End Static Hosting** | [`#mini-app-front-end`](https://core.telegram.org/bots/serverless#mini-app-front-end) | [mini-apps.md](mini-apps.md) |
| **Database: Tables, Columns & Indexes** | [`#the-database`](https://core.telegram.org/bots/serverless#the-database), [`#declaring-tables`](https://core.telegram.org/bots/serverless#declaring-tables), [`#column-types`](https://core.telegram.org/bots/serverless#column-types), [`#column-modifiers`](https://core.telegram.org/bots/serverless#column-modifiers), [`#indexes-and-constraints`](https://core.telegram.org/bots/serverless#indexes-and-constraints), [`#no-foreign-keys`](https://core.telegram.org/bots/serverless#no-foreign-keys) | [database.md](database.md) |
| **Database: Querying & Raw SQL** | [`#querying`](https://core.telegram.org/bots/serverless#querying) | [database.md](database.md) |
| **Database: Migrations, Drops & Type Changes** | [`#migrations`](https://core.telegram.org/bots/serverless#migrations), [`#removing-things`](https://core.telegram.org/bots/serverless#removing-things), [`#changing-a-column-39s-type`](https://core.telegram.org/bots/serverless#changing-a-column-39s-type) | [database.md](database.md), [debugging-playbook.md](debugging-playbook.md) |
| **The SDK: Bot API, Files, HTTP & Logging** | [`#the-sdk`](https://core.telegram.org/bots/serverless#the-sdk), [`#the-bot-api`](https://core.telegram.org/bots/serverless#the-bot-api), [`#files`](https://core.telegram.org/bots/serverless#files), [`#http`](https://core.telegram.org/bots/serverless#http), [`#logging`](https://core.telegram.org/bots/serverless#logging) | [runtime-sdk.md](runtime-sdk.md) |
| **CLI Reference & Authentication** | [`#command-line-interface`](https://core.telegram.org/bots/serverless#command-line-interface), [`#authentication`](https://core.telegram.org/bots/serverless#authentication), [`#init`](https://core.telegram.org/bots/serverless#init), [`#add`](https://core.telegram.org/bots/serverless#add), [`#login`](https://core.telegram.org/bots/serverless#login), [`#status`](https://core.telegram.org/bots/serverless#status), [`#diff`](https://core.telegram.org/bots/serverless#diff), [`#push`](https://core.telegram.org/bots/serverless#push), [`#migrate`](https://core.telegram.org/bots/serverless#migrate), [`#run`](https://core.telegram.org/bots/serverless#run), [`#fetch`](https://core.telegram.org/bots/serverless#fetch), [`#pull`](https://core.telegram.org/bots/serverless#pull), [`#reset`](https://core.telegram.org/bots/serverless#reset), [`#webhook`](https://core.telegram.org/bots/serverless#webhook), [`#upgrade`](https://core.telegram.org/bots/serverless#upgrade), [`#completion`](https://core.telegram.org/bots/serverless#completion), [`#staying-in-sync`](https://core.telegram.org/bots/serverless#staying-in-sync) | [setup.md](setup.md), [operations.md](operations.md) |

---

## 2. Linked Telegram & Package Specifications

- **Telegram Mini Apps Serverless RPC**: [`https://core.telegram.org/bots/webapps#serverless`](https://core.telegram.org/bots/webapps#serverless) (`Telegram.WebApp.Serverless.call` contract and error shapes).
- **Telegram Mini Apps `WebAppInitData`**: [`https://core.telegram.org/bots/webapps#webappinitdata`](https://core.telegram.org/bots/webapps#webappinitdata) (fields available on `ctx.initData` in endpoints; note that client-side `initDataUnsafe` is never backend proof).
- **Telegram Bot API Reference**: [`https://core.telegram.org/bots/api`](https://core.telegram.org/bots/api) (authoritative `Update` fields, `Message` / `CallbackQuery` / `InlineQuery` / `PreCheckoutQuery` payloads, and `api.<method>` parameters).
- **Published `@tgcloud/cli` Metadata**: [`https://registry.npmjs.org/@tgcloud%2Fcli/latest`](https://registry.npmjs.org/@tgcloud%2Fcli/latest) and tarball (`https://registry.npmjs.org/@tgcloud/cli/-/cli-0.2.0.tgz`) — contains `./schema/tgcloud.json` and exact CLI flag implementations.
- **Published `@tgcloud/create-bot` Metadata**: [`https://registry.npmjs.org/@tgcloud%2Fcreate-bot/latest`](https://registry.npmjs.org/@tgcloud%2Fcreate-bot/latest) — project initializer (`npm create @tgcloud/bot`).
- **Project-Local Generated SDK Reference**: `docs/tgcloud-sdk.md` (created by `tgcloud init` / `npm create @tgcloud/bot`). Always inspect it when present in a workspace for version-matched SDK details.

---

## 3. Documented Limits & Unresolved Capabilities

When designing or reviewing a Telegram Serverless solution, distinguish between **documented constraints** and **undocumented/unresolved capabilities**:

### Documented Constraints
1. **No Foreign Keys**: `.references()` and `foreignKey()` throw errors; SQLite foreign-key enforcement is disabled.
2. **No Runtime `node_modules` or Node.js Builtins**: Backend modules run in a V8 isolate, not Node.js (`Buffer`, `fs`, `path`, `child_process` are absent).
3. **File & HTTP Payload Size Caps**: `InputFile`, `api.getFileContent`, `api.getFileStream`, and `sdk/fetch` responses are subject to platform size limits (streaming avoids buffering everything at once in JS memory, but does **not** bypass the platform's maximum payload size cap).
4. **Endpoints Require Mini App `initData`**: `tgcloud/endpoints/*` cannot be used as unauthenticated public HTTP webhooks for third-party services.

### Unresolved / Undocumented Capabilities (Do Not Invent!)
The official Telegram Serverless documentation does **not** currently establish:
- **Runtime environment variables or a secret manager** (e.g., no `process.env` or `sdk.secrets` inside `tgcloud/` modules; `TGCLOUD_TOKEN` is strictly for the local/CI CLI).
- **Multi-statement ACID database transaction APIs** or automatic rollback guarantees across multiple `await db...run()` calls.
- **Built-in cron jobs, timers, or background task schedulers**.
- **Built-in CLI commands for database backups, snapshots, or point-in-time recovery**, or streaming production logs outside `tgcloud run`.
- **Published numeric quotas for isolate CPU time, memory, concurrency, or pricing/SLAs**.

**Agent Rule**: Treat these as unresolved platform capabilities. Never invent APIs or CLI flags for them. If a user's design depends on one (such as storing a private third-party API key or running a scheduled job), explicitly point out the undocumented gap and discuss safe workarounds (see [patterns-and-recipes.md](patterns-and-recipes.md)) before proceeding.
