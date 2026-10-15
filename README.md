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
| [humanize-text](skills/humanize-text/) | Write and rewrite natural, specific, human-sounding prose while preserving voice, meaning, nuance, and facts. |
| [use-telegram-serverless](skills/use-telegram-serverless/) | Build, ship, and scale simple or full-stack Telegram bots and Mini Apps directly inside Telegram's cloud—powered by V8 JavaScript isolates, built-in SQLite (`sdk/db`), native Bot API & HTTP (`sdk/api`, `sdk/fetch`), static hosting, and `tgcloud`. |
| [telegram-serverless-bot](skills/telegram-serverless-bot/) | Build, ship, and test Telegram bots on Telegram Serverless with V8 JS, SQLite sessions (`sdk/db`), interactive keyboards, and Telegram Stars (`XTR`). |
| [discord-activities](skills/discord-activities/) | Build, ship, and test Discord Activities with @discord/embedded-app-sdk, OAuth2 token exchange, /.proxy/ CSP routing, and voice channel presence. |

## Install

### Using the `skills` CLI (Claude Code, Cursor, Codex, Antigravity, Windsurf, Copilot, Gemini)

Install the full collection:

```bash
npx skills add rijans/agent-skills
```

Or install a specific skill:

```bash
npx skills add rijans/agent-skills --skill discord-activities
npx skills add rijans/agent-skills --skill telegram-serverless-bot
npx skills add rijans/agent-skills --skill use-telegram-serverless
npx skills add rijans/agent-skills --skill humanize-text
```

### Using Claude Code Plugin Marketplace

Register this repository as a Claude Code plugin marketplace and install skills directly:

```text
/plugin marketplace add rijans/agent-skills
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
├── humanize-text/
│   ├── SKILL.md
│   └── eval.md
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
