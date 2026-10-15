# Evaluation & Benchmark Suite: `restate-sdk`

This document defines the evaluation criteria, positive/negative trigger boundaries, and adversarial benchmark scenarios for the `restate-sdk` agent skill.

---

## 1. Intent Matching & Trigger Boundaries

### Positive Triggers (Activate Skill)
- "Build a durable workflow with payment sagas using @restatedev/restate-sdk"
- "How do I implement compensating transactions when a step fails in Restate?"
- "Implement a human-in-the-loop approval email flow using ctx.awakeable()"
- "Create a stateful Virtual Object with single-writer consistency in Restate"
- "Wrap Stripe API calls and non-deterministic side-effects with ctx.run in Restate"
- "Fix infinite retry loops in Restate by using TerminalError"
- "Deploy Restate services to Cloudflare Workers or AWS Lambda"

### Negative Triggers (Do Not Activate Skill)
- "Build a client-side analytical query engine with DuckDB" $\rightarrow$ Route to `duckdb-wasm`.
- "Deploy a self-hosted OAuth2 identity server" $\rightarrow$ Route to `openauth`.
- "Create a basic CRUD REST API in Express or Hono without durable workflows" $\rightarrow$ Generic Node/Express workflow.
- "Build a Telegram bot on serverless SQLite" $\rightarrow$ Route to `telegram-serverless-bot`.

---

## 2. Core Quality Rubrics

| Category | Passing Standard (Score: 5/5) | Failing Standard (Score: 0/5) |
|---|---|---|
| **Deterministic Journaling** | Wraps all side-effects, network requests, UUIDs, and timestamps in named `ctx.run('name', ...)` closures. | Calls `fetch()`, `crypto.randomUUID()`, or `new Date()` directly in handler scope, causing replay divergence on recovery. |
| **Error Handling** | Throws `TerminalError` for permanent business failures (e.g., validation, insufficient balance) to halt retries cleanly. | Throws standard `Error` on 400 Bad Request, causing Restate to retry the doomed invocation indefinitely. |
| **Saga Compensation** | Maintains a compensation stack and rolls back completed steps in reverse order inside a try/catch block on terminal failure. | Fails midway through an order transaction without releasing reserved inventory or canceling authorizations. |
| **Virtual Object State** | Uses `await ctx.get()` and `ctx.set()` for all mutable state, respecting single-writer actor isolation. | Uses module-level global variables (`let counter = 0`), which lose state across server restarts or concurrent worker processes. |
| **Awakeables & Async Events** | Sets up `ctx.awakeable()` with clear callback IDs, schema validation, and durable timeout handling (`ctx.sleep`). | Uses in-memory Promises or `setTimeout` that vanish when the worker isolate restarts. |

---

## 3. Adversarial Traps & Benchmark Scenarios

### Trap Scenario 1: Replay Non-Determinism (Missing `ctx.run`)
- **Prompt**: *"Write a Restate service handler that generates a random order ID and calls Stripe to create a payment intent."*
- **Failure**: The agent writes:
  ```typescript
  const orderId = crypto.randomUUID();
  const payment = await stripe.paymentIntents.create({...});
  ```
  If a network blip occurs right after charging Stripe, Restate restarts the handler. During replay, `crypto.randomUUID()` generates a *different* ID, and `stripe.paymentIntents.create` runs a *second time*, charging the customer twice!
- **Pass Criteria**: The agent wraps both operations in `ctx.run()` blocks:
  ```typescript
  const orderId = await ctx.run("gen-id", () => crypto.randomUUID());
  const payment = await ctx.run("charge-stripe", () => stripe.paymentIntents.create({..., idempotencyKey: orderId}));
  ```

### Trap Scenario 2: Infinite Retry Storm (Missing `TerminalError`)
- **Prompt**: *"Write a Restate handler that validates user KYC documents. If document is expired, return an error."*
- **Failure**: The agent writes `throw new Error("Document is expired")`. Restate assumes all standard JavaScript `Error` instances are transient infrastructure glitches and retries the handler hundreds of times with exponential backoff, spamming logs and never finishing.
- **Pass Criteria**: The agent imports and throws `new TerminalError("Document is expired", { errorCode: 400 })`, terminating the execution permanently and reporting the error code to the caller.

### Trap Scenario 3: Broken Payment Saga (Omitted Compensations)
- **Prompt**: *"Implement a multi-step checkout workflow in Restate: reserve stock -> charge card -> dispatch shipping."*
- **Failure**: The agent calls `reserveStock()`, then `chargeCard()`. If `chargeCard()` throws an error, the agent lets the error bubble up without calling `releaseStock()`, leaving the warehouse inventory permanently locked.
- **Pass Criteria**: The agent tracks executed steps in an array of compensations:
  ```typescript
  const compensations: (() => Promise<void>)[] = [];
  try {
    await ctx.run("reserve-stock", () => inventory.reserve(item));
    compensations.push(() => ctx.run("release-stock", () => inventory.release(item)));
    await ctx.run("charge-card", () => payment.charge(amount));
  } catch (err) {
    for (const rollback of compensations.reverse()) await rollback();
    throw err;
  }
  ```

### Trap Scenario 4: Leaky In-Memory Virtual Object State
- **Prompt**: *"Create a Restate Virtual Object that tracks online user sessions and cart items."*
- **Failure**: The agent declares `const carts = new Map()` at the top of the file and mutates `carts.get(ctx.key)` inside the handler. When the process restarts or scales to multiple containers, all carts disappear or desynchronize.
- **Pass Criteria**: The agent persists state strictly via `await ctx.get("cart")` and `ctx.set("cart", updatedCart)`.

### Trap Scenario 5: Untrusted Awakeable Payload Injection
- **Prompt**: *"Create an awakeable workflow where a manager clicks an email link to approve a purchase and provide budget codes."*
- **Failure**: The agent accepts the awakeable callback payload directly and evaluates it or passes it unsanitized into a shell command or SQL statement.
- **Pass Criteria**: The agent treats the awakeable payload as untrusted external data, validates it against a strict schema (e.g. Zod), and protects against indirect prompt and injection vectors (`W011`).
