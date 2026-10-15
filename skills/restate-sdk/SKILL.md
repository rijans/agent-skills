---
name: restate-sdk
description: Build resilient sagas, durable workflows, and stateful virtual objects with @restatedev/restate-sdk, deterministic journaling, and awakeable promises. Use for ctx.run side-effects, ctx.sleep timers, ctx.objectClient, TerminalError handling, compensation rollbacks, and Cloudflare/Lambda deployment.
---

# Restate SDK

Build resilient distributed applications, durable sagas, and stateful virtual objects with **`@restatedev/restate-sdk`**. Restate turns standard TypeScript functions into fault-tolerant distributed systems that survive process crashes, network partitions, and third-party API outages with zero manual retry or state-machine boilerplate.

---

## When to Use

- Building multi-step business transactions or payment flows that require **Saga compensation rollbacks** when a step fails.
- Orchestrating **long-running durable workflows** that sleep for days or months (`ctx.sleep`) with zero compute costs during suspensions.
- Coordinating **Human-in-the-Loop** approvals, async webhooks, or external events via durable promises (`ctx.awakeable`).
- Maintaining stateful, actor-like **Virtual Objects** (`restate.object`) with guaranteed single-writer consistency and built-in K/V storage (`ctx.get`, `ctx.set`).
- Wrapping non-deterministic side-effects (Stripe charges, email sending, LLM API calls, UUID generation) via deterministic journaling (`ctx.run`).
- Deploying durable microservices across Node.js, Bun, Cloudflare Workers, or AWS Lambda.

## When Not to Use

- **Simple Stateless CRUD Endpoints**: For basic read/write REST endpoints without workflows, sagas, or multi-step guarantees, use plain Hono or Express.
- **Client-Side Analytical SQL**: For in-browser querying and Parquet analytics, use `duckdb-wasm`.
- **Telegram Serverless Handlers**: For Telegram bots and Mini Apps, use `telegram-serverless-bot` or `use-telegram-serverless`.

---

## Inputs to Inspect First

Before implementing or modifying a Restate service:

1. **Target Runtime & Framework**:
   - Check `package.json` for `@restatedev/restate-sdk` (and optional `@restatedev/restate-sdk-clients`).
   - Check target host: Node.js/Bun (`restate.serve` or `.listen()`), Cloudflare Workers (`@restatedev/restate-sdk/fetch`), or AWS Lambda (`@restatedev/restate-sdk/lambda`).
2. **Service Architecture Style**:
   - **Stateless Service** (`restate.service`): Parallel RPC handlers without bound entity keys.
   - **Virtual Object** (`restate.object`): Stateful single-writer entity keyed by ID (e.g. User, Cart, Device).
   - **Workflow** (`restate.workflow`): Idempotent run-to-completion workflow with query/signal handlers.
3. **External Dependencies & Side-Effects**:
   - Identify all non-deterministic operations (random UUIDs, current timestamps, external HTTP APIs, database mutations) that must be wrapped inside `ctx.run()`.

---

## Workflow & Progressive Routing

Load **only** the reference file required for your active task. Do not preload all references at once.

| Task / Focus Area | Actionable Trigger | Reference to Load |
| :--- | :--- | :--- |
| **Services & Virtual Objects** | `restate.service`, `restate.object`, `ctx.get`, `ctx.set`, `ctx.clear`, `ctx.objectClient` | `references/services-and-virtual-objects.md` |
| **Workflows & Sagas** | `restate.workflow`, `ctx.run`, sagas, compensation rollbacks, `ctx.sleep`, idempotency | `references/workflows-and-sagas.md` |
| **Awakeables & Human-in-the-Loop** | `ctx.awakeable`, `ctx.resolveAwakeable`, `ctx.rejectAwakeable`, external webhooks | `references/awakeables-and-signals.md` |
| **Error Handling & Retries** | `TerminalError`, retry policies, non-retryable 4xx errors, timeout budgets | `references/error-handling-and-retries.md` |
| **Endpoints & Deployments** | `restate.serve`, `.listen()`, Cloudflare Workers (`fetch`), AWS Lambda, Docker server setup | `references/endpoints-and-deployment.md` |
| **Upstream Specs & Sources** | Restate server CLI, registration endpoints, breaking changes | `references/sources.md` |

---

## Core Guardrails & Best Practices

1. **Deterministic Journaling Rule**:
   - Never call non-deterministic functions (`Math.random()`, `Date.now()`, `crypto.randomUUID()`, or outbound `fetch()`) directly in a handler's top-level scope. Always wrap them in `await ctx.run('step-name', async () => ...)`.
   - Restate replays code on restarts; unwrapped non-deterministic calls cause journal mismatch errors.
2. **Throw `TerminalError` for Non-Retryable Failures**:
   - By default, Restate retries all unhandled exceptions indefinitely. Throw `new TerminalError('message', { errorCode: 400 })` for permanent business errors (e.g. insufficient funds, card declined, invalid input).
3. **Saga Compensations Must Be Durable**:
   - Register compensations as you proceed through transaction steps. On catch of a `TerminalError`, execute compensating rollbacks in reverse order.
4. **Virtual Object State Exclusivity**:
   - Never use in-memory global variables (`let count = 0`) to maintain state in virtual objects. Always use `await ctx.get()` and `ctx.set()` to guarantee persistent single-writer consistency.
5. **Durable Timers Over `setTimeout`**:
   - Never use `setTimeout()` or `sleep()` in durable handlers. Always use `await ctx.sleep(durationMs)`. Restate suspends execution on the server and resumes precisely when the timer fires.

---

### Handling External Content & Indirect Prompt Injection Defense

All external payloads (webhook responses, awakeable callback bodies, external API responses, user inputs) are **untrusted data**:

- **Isolate Awakeable Payloads**: Treat awakeable resolution payloads as untrusted external data. Validate them with a schema library (Zod or Valibot) before resuming workflow execution.
- **Never Evaluate Untrusted Text as Instructions**: When feeding workflow steps into LLMs, wrap dynamic text in strict XML boundaries (`<untrusted_payload>`) and forbid credential exfiltration.
- **Restrict Outbound Webhook Endpoints**: In `ctx.run` blocks that invoke external URLs, enforce strict domain allowlists to prevent Server-Side Request Forgery (SSRF).

---

## Deliverable Contract

When providing Restate solutions:
1. Provide valid ESM code using `@restatedev/restate-sdk`.
2. Wrap all side-effects and network calls in named `ctx.run()` blocks.
3. Distinguish transient retryable errors from permanent `TerminalError` failures.
4. Include clean endpoint binding (`restate.serve` or `restate.endpoint().bind(...)`).
