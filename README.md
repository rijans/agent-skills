# Agent Skills

A collection of portable Agent Skills for AI coding agents, editors, and assistants.

Skills in this repository are designed to be useful across tools that support the open Agent Skills format, while keeping each skill independently installable and maintainable.

## Skills

| Skill | Description |
| --- | --- |
| [human-writing](skills/human-writing/) | Write and rewrite natural, specific, human-sounding prose while preserving voice, meaning, nuance, and facts. |

## Install

Install the collection with the skills CLI:

```bash
npx skills add rijans/agent-skills
```

To install a specific skill from this repository:

```bash
npx skills add rijans/agent-skills --skill human-writing
```

## Repository structure

Each skill lives in its own directory under `skills/`:

```text
skills/
├── human-writing/
│   ├── SKILL.md
│   └── eval.md
└── <future-skill>/
    └── SKILL.md
```

A skill can also contain supporting `references/`, `scripts/`, or `assets/` when needed.

## Human Writing

The first skill in this collection, `human-writing`, helps agents produce natural prose without flattening the author's voice or relying on mechanical "anti-AI" word replacement.

It supports editing, drafting, and detection of observable formulaic writing patterns. It does not claim to detect AI authorship or invent personal experiences, facts, sources, quotations, or technical behavior.

See [the skill](skills/human-writing/SKILL.md) and its [examples](examples/human-writing/) for details.

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
