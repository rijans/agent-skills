# Agent Skills

A collection of portable Agent Skills for AI coding agents, editors, and assistants.

Skills in this repository are designed to be useful across tools that support the open Agent Skills format, while keeping each skill independently installable and maintainable.

## Skills

| Skill | Description |
| --- | --- |
| [humanize-text](skills/humanize-text/) | Write and rewrite natural, specific, human-sounding prose while preserving voice, meaning, nuance, and facts. |
| [use-telegram-serverless](skills/use-telegram-serverless/) | Build, ship, and scale Telegram bots and full-stack Mini Apps directly inside Telegram's cloud—powered by V8 JavaScript isolates, built-in SQLite (`sdk/db`), native Bot API & HTTP (`sdk/api`, `sdk/fetch`), static hosting, and `tgcloud`. |

## Install

Install the collection with the skills CLI:

```bash
npx skills add rijans/agent-skills
```

To install a specific skill from this repository:

```bash
npx skills add rijans/agent-skills --skill humanize-text
npx skills add rijans/agent-skills --skill use-telegram-serverless
```

## Repository structure

Each skill lives in its own directory under `skills/`:

```text
skills/
├── humanize-text/
│   ├── SKILL.md
│   └── eval.md
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

Build, ship, and scale Telegram bots and full-stack Mini Apps directly inside [Telegram Serverless](https://core.telegram.org/bots/serverless)—with zero servers to manage:

- **V8 JavaScript Runtime & Native SDK**: Instant ES module isolates (`tgcloud/handlers/*.js`, `tgcloud/endpoints/*.js`, `tgcloud/lib/**/*.js`) powered by built-in `sdk/api` (Bot API), `sdk/fetch` (outbound HTTP), and `Uint8Array` / `InputFile` binary helpers.
- **Built-In SQLite Database & Safe Migrations**: Declarative schema DSL (`tgcloud/schema.js`), atomic queries and upserts (`sdk/db`), application-level relational integrity (no foreign keys), `.deprecated()` two-phase drops, and zero-downtime migration sequencing (`tgcloud migrate`).
- **Full-Stack Mini Apps & Production Recipes**: Authenticated RPC endpoints (`Telegram.WebApp.Serverless.call`), `tgcloud.jsonc` static hosting (`tgcloud.ai`), SQLite state machines, 64-byte callback routers, **Telegram Stars (`XTR`) payments**, inline mode, and progressive draft replies.
- **Safe Cloud Operations & Guardrails**: Clear separation between offline checks (`tgcloud diff`), remote sandbox testing (`tgcloud run`), live deployment (`tgcloud push`), conflict recovery, and zero-trust Mini App ownership verification (`ctx.initData.user.id`).

See [the skill](skills/use-telegram-serverless/SKILL.md) and its [examples](examples/use-telegram-serverless/) for details.

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
