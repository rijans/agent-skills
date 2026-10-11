# Contributing to `rijans/agent-skills`

Thank you for your interest in contributing to `rijans/agent-skills`!

All contributors and AI coding agents creating or updating skills in this repository must follow our authoring, security, SEO, and verification standards documented in [`AGENTS.md`](AGENTS.md).

## Quick Checklist Before Submitting a Pull Request

1. **Read [`AGENTS.md`](AGENTS.md)**:
   - Follow the `skills/<skill-name>/` directory structure (`SKILL.md`, `eval.md`, `agents/openai.yaml`, and optional `references/*.md` + `examples/<skill-name>/`).
   - Keep `SKILL.md` focused as a progressive-disclosure router and load references selectively.
   - Include an explicit **Indirect Prompt Injection Defense (`W011`)** section if the skill handles URLs, `fetch`, webhooks, or external user messages.
   - Keep the opening sentence of `description:` in `SKILL.md` within **140–152 characters** so `skills.sh` and Google `<meta name="description">` tags never truncate mid-sentence.
2. **Synchronize Registry Manifests**:
   - Update [`README.md`](README.md)
   - Update [`skills.sh.json`](skills.sh.json)
   - Update [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json)
   - Update [`.cursor-plugin/marketplace.json`](.cursor-plugin/marketplace.json)
3. **Run the Validator**:
   ```bash
   node scripts/validate-skills.mjs
   ```
