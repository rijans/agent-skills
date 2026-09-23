# Human Writing

An open Agent Skill for writing natural, specific, human-sounding prose without generic or formulaic writing patterns commonly associated with AI-generated text.

## What it does

- Rewrites existing text while preserving the author's voice.
- Drafts articles, blogs, documentation, READMEs, tutorials, product copy, release notes, and social posts.
- Removes generic, repetitive, corporate, and formulaic language.
- Preserves uncertainty, nuance, personality, and intentional rough edges.
- Prevents invented personal experiences, opinions, facts, sources, and quotations.
- Reviews technical documentation for clarity and consistency.
- Detects formulaic writing patterns without claiming to detect AI authorship.

## Philosophy

Human writing is not defined by random imperfections or a blacklist of forbidden words.

The skill focuses on:

**specificity + clarity + voice + natural rhythm + factual discipline**

It does not try to make every sentence casual, quirky, or imperfect. The author's voice and the purpose of the text come first.

## Installation

```bash
npx skills add rijans/human-writing
```

## Modes

| Mode | Purpose |
| --- | --- |
| **Edit** | Improve existing text with the minimum effective changes. |
| **Draft** | Create new text from a brief without inventing personal experience or unsupported facts. |
| **Detect** | Identify observable formulaic patterns without claiming to identify AI authorship. |

## Supported writing

Articles, blog posts, documentation, READMEs, tutorials, technical explanations, product copy, release notes, social posts, and other human-facing prose.

## Technical documentation

The skill emphasizes factual accuracy, consistent terminology, useful information early, runnable examples, and clear instructional language. Repository conventions take priority when they conflict with generic defaults.

## Design principles

1. **Preserve voice.** Do not flatten distinctive writing into generic polished prose.
2. **Prefer specificity.** Concrete details are more useful than inflated language.
3. **Keep natural rhythm.** Sentence length and structure should vary organically.
4. **Respect uncertainty.** Do not turn qualified claims into confident ones.
5. **Do not fabricate.** Never invent facts, experiences, sources, quotations, or technical behavior.
6. **Avoid mechanical anti-AI editing.** A word is not "AI-like" in isolation; context matters.

## Examples

See the `examples/` directory for small before/after examples covering editing, drafting, and technical documentation.

## License

MIT
