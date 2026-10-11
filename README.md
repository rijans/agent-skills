# Agent Skills

A collection of portable Agent Skills for AI coding agents, editors, and assistants.

Skills in this repository are designed to be useful across tools that support the open Agent Skills format, while keeping each skill independently installable and maintainable.

## Skills

| Skill | Description |
| --- | --- |
| [humanize-text](skills/humanize-text/) | Write and rewrite natural, specific, human-sounding prose while preserving voice, meaning, nuance, and facts. |
| [use-telegram-serverless](skills/use-telegram-serverless/) | Architect, build, review, test, deploy, and debug Telegram bots and Mini Apps on Telegram Serverless (`tgcloud`, V8 SDK, SQLite database, and static hosting). |

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

`use-telegram-serverless` equips agents to build, audit, test, deploy, and troubleshoot bots and full-stack Mini Apps on [Telegram Serverless](https://core.telegram.org/bots/serverless):

- **Complete V8 Runtime & SDK Coverage**: Update handlers (`tgcloud/handlers/*.js`), authenticated Mini App endpoints (`tgcloud/endpoints/*.js`), shared modules (`tgcloud/lib/**/*.js`), Bot API (`sdk/api`), binary files (`InputFile`, `getFileContent`, `getFileStream`), and outbound HTTP (`sdk/fetch`).
- **SQLite Database & Zero-Downtime Migrations**: Schema DSL (`tgcloud/schema.js`), atomic upserts and query operators (`sdk/db`), application-level relational integrity (no foreign keys), `.deprecated()` two-phase drops, and safe migration sequencing (`tgcloud migrate`).
- **Production Blueprints & Superpowers**: SQLite conversational state machines, 64-byte callback query routers, deep linking (`?start=` / `?startapp=`), Telegram Stars (`XTR`) payments, AI/LLM streaming bots, Promise-based `Telegram.WebApp.Serverless.call` wrappers, and `tgcloud.jsonc` static hosting.
- **Strict Operational & Security Guardrails**: Clear separation between offline checks (`tgcloud diff`), live remote sandbox runs (`tgcloud run`), targeted vs. full deployments (`tgcloud push`), conflict recovery, and zero-trust Mini App ownership verification (`ctx.initData.user.id`).

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
