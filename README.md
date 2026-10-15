# Agent Skills

[![Validate Skills](https://github.com/rijans/agent-skills/actions/workflows/validate-skills.yml/badge.svg)](https://github.com/rijans/agent-skills/actions/workflows/validate-skills.yml)
[![skills.sh](https://img.shields.io/badge/skills.sh-rijans%2Fagent--skills-black?style=flat-square)](https://www.skills.sh/rijans/agent-skills)
[![Claude Code Marketplace](https://img.shields.io/badge/Claude_Code-Plugin_Marketplace-D97757?style=flat-square)](https://github.com/rijans/agent-skills/blob/main/.claude-plugin/marketplace.json)
[![Cursor Marketplace](https://img.shields.io/badge/Cursor-Plugin_Marketplace-000000?style=flat-square)](https://github.com/rijans/agent-skills/blob/main/.cursor-plugin/marketplace.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

A collection of portable Agent Skills for AI coding agents, editors, and assistants.

Skills in this repository are designed to be useful across tools that support the open Agent Skills format, while keeping each skill independently installable and maintainable.

## Skills

| Skill | Description |
| --- | --- |
| [humanize-text](skills/humanize-text/) | Write and rewrite natural, human-authored prose across articles, technical guides, and documentation while preserving voice, meaning, and nuance. |
| [use-telegram-serverless](skills/use-telegram-serverless/) | Build, ship, and scale simple or full-stack Telegram bots and Mini Apps directly inside Telegram's cloud—powered by V8 JavaScript isolates, built-in SQLite (`sdk/db`), native Bot API & HTTP (`sdk/api`, `sdk/fetch`), static hosting, and `tgcloud`. |
| [telegram-serverless-bot](skills/telegram-serverless-bot/) | Build, ship, and test Telegram bots on Telegram Serverless with V8 JS, SQLite sessions (`sdk/db`), interactive keyboards, and Telegram Stars (`XTR`). |
| [openauth](skills/openauth/) | Deploy self-hosted OAuth2 and OIDC servers with OpenAuth, createSubjects schemas, prebuilt PasswordUI and CodeUI, and cross-framework client verification. |
| [cloudflare-email-workers](skills/cloudflare-email-workers/) | Build, deploy, and test Cloudflare Email Routing Workers with postal-mime MIME parsing, RFC 5322 mimetext replies, and AI auto-response loops. |
| [mtcute](skills/mtcute/) | Build high-performance Telegram userbots and MTProto client apps using @mtcute/node, @mtcute/dispatcher, SQLite sessions, and typed raw TL calls. |
| [duckdb-wasm](skills/duckdb-wasm/) | Query Parquet files, run in-browser analytical SQL, and persist databases to OPFS with @duckdb/duckdb-wasm, Web Workers, and Apache Arrow tables. |
| [restate-sdk](skills/restate-sdk/) | Build resilient sagas, durable workflows, and stateful virtual objects with @restatedev/restate-sdk, deterministic journaling, and awakeable promises. |
| [discord-activities](skills/discord-activities/) | Build, ship, and test Discord Activities with @discord/embedded-app-sdk, OAuth2 token exchange, reverse proxy CSP routing, and voice channel presence. |

## Install

### Using the `skills` CLI (Claude Code, Cursor, Codex, Antigravity, Windsurf, Copilot, Gemini)

Install the full collection:

```bash
npx skills add rijans/agent-skills
```

Or install a specific skill:

```bash
npx skills add rijans/agent-skills --skill restate-sdk
npx skills add rijans/agent-skills --skill duckdb-wasm
npx skills add rijans/agent-skills --skill mtcute
npx skills add rijans/agent-skills --skill cloudflare-email-workers
npx skills add rijans/agent-skills --skill openauth
npx skills add rijans/agent-skills --skill discord-activities
npx skills add rijans/agent-skills --skill telegram-serverless-bot
npx skills add rijans/agent-skills --skill use-telegram-serverless
npx skills add rijans/agent-skills --skill humanize-text
```

### Using Claude Code Plugin Marketplace

Register this repository as a Claude Code plugin marketplace and install skills directly:

```text
/plugin marketplace add rijans/agent-skills
/plugin install restate-sdk@rijans-agent-skills
/plugin install duckdb-wasm@rijans-agent-skills
/plugin install mtcute@rijans-agent-skills
/plugin install cloudflare-email-workers@rijans-agent-skills
/plugin install openauth@rijans-agent-skills
/plugin install discord-activities@rijans-agent-skills
/plugin install telegram-serverless-bot@rijans-agent-skills
/plugin install use-telegram-serverless@rijans-agent-skills
/plugin install humanize-text@rijans-agent-skills
```

## Repository structure

Each skill lives in its own directory under `skills/`:

```text
skills/
├── discord-activities/
│   ├── SKILL.md
│   ├── eval.md
│   ├── agents/
│   │   └── openai.yaml
│   └── references/
│       ├── sdk-lifecycle-and-auth.md
│       ├── proxy-and-csp.md
│       ├── backend-token-exchange.md
│       ├── voice-and-presence.md
│       ├── multiplayer-sync.md
│       ├── monetization-skus.md
│       ├── local-dev-and-tunnels.md
│       └── sources.md
├── openauth/
│   ├── SKILL.md
│   ├── eval.md
│   ├── agents/
│   │   └── openai.yaml
│   └── references/
│       ├── issuer-and-subjects.md
│       ├── providers-and-ui.md
│       ├── client-and-session.md
│       ├── storage-and-deployment.md
│       └── sources.md
├── cloudflare-email-workers/
│   ├── SKILL.md
│   ├── eval.md
│   ├── agents/
│   │   └── openai.yaml
│   └── references/
│       ├── routing-and-handlers.md
│       ├── inbound-mime-parsing.md
│       ├── outbound-and-replies.md
│       ├── security-and-spam.md
│       └── sources.md
├── mtcute/
│   ├── SKILL.md
│   ├── eval.md
│   ├── agents/
│   │   └── openai.yaml
│   └── references/
│       ├── client-and-auth.md
│       ├── dispatcher-and-filters.md
│       ├── media-and-files.md
│       ├── raw-tl-and-errors.md
│       └── sources.md
├── duckdb-wasm/
│   ├── SKILL.md
│   ├── eval.md
│   ├── agents/
│   │   └── openai.yaml
│   └── references/
│       ├── setup-and-bundling.md
│       ├── files-and-parquet.md
│       ├── opfs-persistence.md
│       ├── queries-and-arrow.md
│       ├── security-and-injection.md
│       └── sources.md
├── restate-sdk/
│   ├── SKILL.md
│   ├── eval.md
│   ├── agents/
│   │   └── openai.yaml
│   └── references/
│       ├── services-and-virtual-objects.md
│       ├── workflows-and-sagas.md
│       ├── awakeables-and-signals.md
│       ├── error-handling-and-retries.md
│       ├── endpoints-and-deployment.md
│       └── sources.md
├── humanize-text/
│   ├── SKILL.md
│   ├── eval.md
│   └── agents/
│       └── openai.yaml
├── telegram-serverless-bot/
│   ├── SKILL.md
│   ├── eval.md
│   ├── agents/
│   │   └── openai.yaml
│   └── references/
│       ├── commands-and-routing.md
│       ├── keyboards-and-callbacks.md
│       ├── conversational-fsm.md
│       ├── stars-payments.md
│       ├── media-and-files.md
│       ├── testing-and-sandbox.md
│       └── sources.md
└── use-telegram-serverless/
    ├── SKILL.md
    ├── eval.md
    ├── agents/
    │   └── openai.yaml
    └── references/
        ├── setup.md
        ├── runtime-sdk.md
        ├── database.md
        ├── mini-apps.md
        ├── operations.md
        ├── patterns-and-recipes.md
        ├── debugging-playbook.md
        └── sources.md
```

A skill can also contain supporting `references/`, `scripts/`, `agents/`, or `assets/` when needed.

## Humanize Text

`humanize-text` helps agents produce natural prose without flattening the author's voice or relying on mechanical "anti-AI" word replacement.

It supports editing, drafting, and detection of observable formulaic writing patterns. It does not claim to detect AI authorship or invent personal experiences, facts, sources, quotations, or technical behavior.

See [the skill](skills/humanize-text/SKILL.md) and its [examples](examples/humanize-text/) for details.

## Use Telegram Serverless

Build, ship, and scale simple or full-stack Telegram bots and Mini Apps directly inside [Telegram Serverless](https://core.telegram.org/bots/serverless)—with zero servers to manage:

- **V8 JavaScript Runtime & Native SDK**: Instant ES module isolates (`tgcloud/handlers/*.js`, `tgcloud/endpoints/*.js`, `tgcloud/lib/**/*.js`) powered by built-in `sdk/api` (Bot API), `sdk/fetch` (outbound HTTP), and `Uint8Array` / `InputFile` binary helpers.
- **Built-In SQLite Database & Safe Migrations**: Declarative schema DSL (`tgcloud/schema.js`), atomic queries and upserts (`sdk/db`), application-level relational integrity (no foreign keys), `.deprecated()` two-phase drops, and zero-downtime migration sequencing (`tgcloud migrate`).
- **Simple Commands to Full-Stack Mini Apps**: Supports everything from a 10-line `/start` bot to authenticated Mini App RPC endpoints (`Telegram.WebApp.Serverless.call`), `tgcloud.jsonc` static hosting (`tgcloud.ai`), SQLite state machines, 64-byte callback routers, **Telegram Stars (`XTR`) payments**, inline mode, and progressive draft replies.
- **Safe Cloud Operations & Guardrails**: Clear separation between offline checks (`tgcloud diff`), remote sandbox testing (`tgcloud run`), live deployment (`tgcloud push`), conflict recovery, and zero-trust Mini App ownership verification (`ctx.initData.user.id`).

See [the skill](skills/use-telegram-serverless/SKILL.md) and its [examples](examples/use-telegram-serverless/) for details.

## Telegram Serverless Bot

Build, ship, and test Telegram bots directly inside [Telegram Serverless](https://core.telegram.org/bots/serverless)—laser-focused on bot handlers, stateful conversations, and Stars payments:

- **Progressive Bot Architecture**: Native flat update handlers (`tgcloud/handlers/message.js`, `callback_query.js`, `pre_checkout_query.js`) for lightweight command bots, scaling to modular feature handlers (`tgcloud/lib/`) and persistent SQLite session state for multi-step wizards.
- **Interactive Keyboards & 64-Byte Callback Routers**: Inline buttons, reply markups, menu buttons, and compact payload encoding pattern (`<prefix>:<action>:<id>`) with immediate `answerCallbackQuery` acknowledgment.
- **Telegram Stars (`XTR`) Digital Payments**: Native Stars invoice dispatch (`sendInvoice`), `<10s` pre-checkout verification (`answerPreCheckoutQuery`), and fulfillment ledgering in SQLite (`successful_payment`).
- **Binary Media & Documents**: In-memory binary uploads via `Uint8Array` and `InputFile`, CDN asset downloads, and outbound media streaming.
- **Sandbox Testing & Mock Fixtures**: Offline update fixtures (`start-command.json`, `callback-query.json`, `pre-checkout-query.json`) for safe testing with `tgcloud run`.

See [the skill](skills/telegram-serverless-bot/SKILL.md) and its [examples](examples/telegram-serverless-bot/) for details.

## Discord Activities

Build, ship, and test rich, interactive web applications directly inside Discord voice channels, group chats, and DMs—powered by [`@discord/embedded-app-sdk`](https://discord.com/developers/docs/activities/overview):

- **Client Lifecycle & RPC Handshake**: `new DiscordSDK(clientId)` instantiation, `await discordSdk.ready()`, and defensive context parsing (`channelId`, `guildId`, `platform`).
- **OAuth2 Token Exchange**: Seamless client authorization (`authorize()`), secure backend exchange (`/api/token`), and verified session authentication (`authenticate()`).
- **Reverse Proxy & CSP Enforcement (`/.proxy/`)**: Relative proxy path routing, Developer Portal URL Mappings, and Ed25519 signature verification (`X-Signature-Ed25519`).
- **Voice Presence & Real-Time Sync**: Live voice participant updates (`ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE`), speaking indicators (`SPEAKING_START` / `SPEAKING_STOP`), and WebSocket room synchronization.
- **In-App Purchases (SKUs)**: Durable, Consumable, and Subscription SKUs checkout overlay (`startPurchase`) and server-side entitlement validation.
- **Hybrid Local Development**: Rapid browser UI mock mode paired with Cloudflare Tunnel (`cloudflared`) for live in-client testing.

See [the skill](skills/discord-activities/SKILL.md) and its [examples](examples/discord-activities/) for details.

## OpenAuth

Deploy self-hosted OAuth 2.0 and OIDC authentication servers across Cloudflare Workers, Node.js, Bun, and AWS Lambda—powered by [`@openauthjs/openauth`](https://openauth.js.org):

- **Typed Subjects Schema**: Standard Schema definitions via `createSubjects` (compatible with Valibot and Zod v3.24+) for end-to-end type safety across tokens and user sessions.
- **Prebuilt UI Components**: Ready-to-use passwordless PIN/OTP email verification (`CodeUI` / `CodeProvider`) and username/password registration with reset flows (`PasswordUI` / `PasswordProvider`).
- **Social & Enterprise Providers**: Drop-in adapters for GitHub, Google, Discord, Apple, and generic OIDC providers with automated multi-provider login screens.
- **Client Verification & Token Refresh**: Universal client SDK (`createClient`, `authorize`, `exchange`, `verify`) with automatic token rotation and HTTP-only cookie persistence.
- **Multi-Cloud Storage & Serverless Adapters**: Global edge persistence with `CloudflareStorage` (KV), AWS deployments with `DynamoStorage`, and zero-config local testing with `MemoryStorage`.

See [the skill](skills/openauth/SKILL.md) and its [examples](examples/openauth/) for details.

## Cloudflare Email Workers

Build, deploy, and test serverless email routing and AI auto-response workers directly on [Cloudflare Email Routing](https://developers.cloudflare.com/email-routing/):

- **Inbound Event Interception**: Native `email(message, env, ctx)` handler processing incoming messages at global edge latency with `message.forward()` and `message.setReject()`.
- **MIME Parsing in V8 Isolates**: Browser/Workers-native MIME and RFC 5322 parsing via `postal-mime` without heavy Node stream dependencies.
- **R2 Attachment Archiving**: Safe memory-bounded attachment streaming directly to Cloudflare R2 object storage.
- **RFC 5322 Threaded Replies**: Proper conversation threading (`In-Reply-To`, `References`, `Re: ` subject) via `mimetext` and outbound dispatch via `cloudflare:email` and the `send_email` binding.
- **Spam & Loop Protection**: Built-in guardrails checking `Auto-Submitted`, `Precedence`, automated sender filters (`mailer-daemon@`, `no-reply@`), SPF/DKIM verification, and prompt injection isolation.

See [the skill](skills/cloudflare-email-workers/SKILL.md) and its [examples](examples/cloudflare-email-workers/) for details.

## mtcute

Build high-performance Telegram userbots, client automations, and MTProto applications using [`@mtcute/node`](https://www.npmjs.com/package/@mtcute/node) and [`@mtcute/dispatcher`](https://www.npmjs.com/package/@mtcute/dispatcher):

- **Modern GramJS Successor**: Zero legacy C++ compilation or unmaintained dependencies—pure TypeScript running across Node.js, Bun, Deno, and Web Workers.
- **SQLite Session Persistence**: Out-of-the-box persistent auth keys and peer entity caching (`data/userbot.session`), with base64 session string export (`exportSession()`) for ephemeral container environments.
- **High-Performance Event Dispatcher**: Declarative filter composition (`filters.command`, `filters.regex`, `filters.chat`, `filters.and`/`or`/`not`) for commands, message edits, deletions, and inline callbacks.
- **2GB+ Streaming Media Pipeline**: Memory-safe large file transfers up to 2GB (or 4GB for Telegram Premium) via `tg.downloadToFile()` and `tg.downloadAsStream()` with zero heap exhaustion.
- **Raw MTProto Type Language (TL) Calls**: Direct low-level RPC queries (`tg.call({ _: '...' })`) with strict schema typing, automatic access hash caching (`resolvePeer`), and transparent `FLOOD_WAIT` backoff (`floodSleepThreshold`).

See [the skill](skills/mtcute/SKILL.md) and its [examples](examples/mtcute/) for details.

## DuckDB-Wasm

Execute blazing-fast analytical SQL directly inside web browsers using [`@duckdb/duckdb-wasm`](https://www.npmjs.com/package/@duckdb/duckdb-wasm), Web Workers, and Apache Arrow:

- **Zero-Server Columnar Analytics**: Query multi-megabyte local Parquet and CSV files on demand via `db.registerFileHandle` and browser FileReader streams without backend uploads.
- **Durable OPFS Storage**: Persist analytical databases locally across page reloads using the browser's native Origin Private File System (`opfs://`) and explicit `CHECKPOINT;` durability.
- **Modern Bundler Integration**: Battle-tested recipes for Vite (`?url` static assets), Next.js App Router (SSR-isolated client components), and zero-config CDN loading via `getJsDelivrBundles()`.
- **Apache Arrow Table Processing**: Direct zero-copy column vector access and streaming batch iteration preventing JavaScript heap exhaustion on 100k+ row datasets.
- **Cross-Origin Isolation Management**: Graceful fallback to the single-threaded `eh` bundle, with opt-in multi-threading (`pthreadWorker`) enabled via COOP/COEP headers.

See [the skill](skills/duckdb-wasm/SKILL.md) and its [examples](examples/duckdb-wasm/) for details.

## Restate SDK

Build resilient distributed applications, durable sagas, and stateful virtual objects across Node.js, Bun, Cloudflare Workers, and AWS Lambda—powered by [`@restatedev/restate-sdk`](https://www.npmjs.com/package/@restatedev/restate-sdk):

- **Deterministic Journaling & Zero Replay Divergence**: Isolate non-deterministic operations (`Date.now()`, `Math.random()`, external HTTP fetches) inside `ctx.run()` to guarantee reliable crash-recovery replays.
- **Resilient Distributed Sagas**: Clean multi-step transactional orchestrations with LIFO compensation stacks (`compensations.reverse()`), ensuring rollback reliability when intermediate operations fail.
- **Stateful Virtual Objects (`restate.object`)**: Distributed actor-like entities with single-writer concurrency guarantees, persistent key-value storage (`ctx.get`, `ctx.set`, `ctx.clear`), and race-free state transitions.
- **Human-in-the-Loop & Awakeables**: Long-running suspensions waiting for human approvals or external webhook callbacks via `ctx.awakeable()`, with zero CPU consumption during suspensions and durable timeout fallbacks.
- **Dual Error Model**: Clean segregation between transient errors (indefinite exponential backoff) and permanent `TerminalError` failures (stopping retry storms).

See [the skill](skills/restate-sdk/SKILL.md) and its [examples](examples/restate-sdk/) for details.

## Adding a skill

Create a new directory under `skills/` containing a valid `SKILL.md`:

```text
skills/
└── my-skill/
    └── SKILL.md
```

Keep each skill self-contained. Add supporting files inside that skill's directory when they are required.

## License

MIT
