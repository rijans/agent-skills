# Workflows, Sagas & Compensation Rollbacks

This guide covers building orchestrations with `restate.workflow`, managing state across long-running lifecycles, and implementing the Saga compensation pattern to handle distributed rollbacks when multi-step transactions fail.

---

## 1. Defining a Durable Workflow (`restate.workflow`)

A Restate Workflow is an execution unit identified by an entity key (`workflowId`). It has:
- Exactly one `run` handler that executes to completion.
- Optional shared query handlers (`WorkflowSharedContext`) to inspect workflow state concurrently without blocking.
- Guarantees of idempotency: submitting the same workflow key multiple times will attach to the existing workflow rather than spawning duplicates.

```typescript
import * as restate from '@restatedev/restate-sdk'

export interface OrderWorkflowParams {
  orderId: string
  customerId: string
  items: Array<{ sku: string; quantity: number; price: number }>
}

export const orderWorkflow = restate.workflow({
  name: 'OrderWorkflow',
  handlers: {
    // 1. Primary execution handler (runs once per workflow key)
    run: async (ctx: restate.WorkflowContext, params: OrderWorkflowParams) => {
      ctx.set('status', 'INITIALIZED')
      ctx.set('orderId', params.orderId)

      // Step 1: Validate & reserve inventory
      ctx.set('status', 'RESERVING_INVENTORY')
      await ctx.run('reserve-stock', async () => {
        // External call to warehouse or database
      })

      // Step 2: Charge customer
      ctx.set('status', 'PROCESSING_PAYMENT')
      await ctx.run('charge-card', async () => {
        // Stripe or payment gateway call
      })

      // Step 3: Complete workflow
      ctx.set('status', 'FULFILLED')
      return { orderId: params.orderId, success: true }
    },

    // 2. Shared query handler (can be queried while the workflow runs)
    getStatus: async (ctx: restate.WorkflowSharedContext) => {
      const status = (await ctx.get<string>('status')) ?? 'NOT_FOUND'
      const orderId = (await ctx.get<string>('orderId')) ?? null
      return { orderId, status }
    },
  },
})
```

---

## 2. The Saga Pattern & Compensating Transactions

When orchestrating multiple distributed services (e.g. inventory reservation, payment authorization, loyalty points deduction), any intermediate step can fail permanently. A **Saga** registers compensating undo actions in forward order and executes them in reverse order if a failure occurs.

### Saga Implementation Checklist
1. Maintain an in-memory stack of compensation closures during execution.
2. Catch unhandled errors or `restate.TerminalError`.
3. Iterate backwards through the compensation stack, awaiting each rollback.
4. Re-throw the original error so Restate records the terminal failure or signals the caller.

```typescript
import * as restate from '@restatedev/restate-sdk'

export interface CheckoutRequest {
  orderId: string
  userId: string
  amountCents: number
  items: Array<{ sku: string; qty: number }>
}

export const checkoutSaga = restate.service({
  name: 'CheckoutSaga',
  handlers: {
    execute: async (ctx: restate.Context, req: CheckoutRequest) => {
      const compensations: Array<() => Promise<void>> = []

      try {
        // Step 1: Reserve Inventory
        await ctx.run('reserve-inventory', async () => {
          console.log(`[Inventory] Reserving items for order ${req.orderId}`)
          // API call to inventory service
        })
        compensations.push(async () => {
          await ctx.run('compensate-inventory', async () => {
            console.log(`[Compensation] Releasing inventory for order ${req.orderId}`)
            // API call to release reserved items
          })
        })

        // Step 2: Deduct Loyalty Credit (if any)
        await ctx.run('deduct-loyalty-points', async () => {
          console.log(`[Loyalty] Deducting points for user ${req.userId}`)
        })
        compensations.push(async () => {
          await ctx.run('compensate-loyalty', async () => {
            console.log(`[Compensation] Restoring loyalty points for user ${req.userId}`)
          })
        })

        // Step 3: Charge Payment Gateway
        await ctx.run('charge-stripe', async () => {
          console.log(`[Payment] Charging \$${req.amountCents / 100} for ${req.orderId}`)
          // If payment fails (e.g. card declined), throw TerminalError
          const cardValid = req.amountCents < 50000 // simulate limit
          if (!cardValid) {
            throw new restate.TerminalError('Card declined: transaction limit exceeded', {
              errorCode: 402,
            })
          }
        })
        compensations.push(async () => {
          await ctx.run('compensate-payment', async () => {
            console.log(`[Compensation] Refunding payment for order ${req.orderId}`)
          })
        })

        // Step 4: Dispatch Confirmation Email
        await ctx.run('send-confirmation', async () => {
          console.log(`[Email] Receipt dispatched for order ${req.orderId}`)
        })

        return { orderId: req.orderId, status: 'SUCCESS' }
      } catch (err) {
        console.error(`Saga failed for order ${req.orderId}. Executing compensations...`, err)

        // Execute rollback compensations in reverse order (LIFO)
        for (const compensate of compensations.reverse()) {
          try {
            await compensate()
          } catch (compErr) {
            console.error('Compensation step failed; continuing with remaining rollbacks', compErr)
          }
        }

        // Re-throw to propagate terminal or retry state
        throw err
      }
    },
  },
})
```

---

## 3. Durable Sleep (`ctx.sleep`) vs In-Memory Timers

Never use `setTimeout()`, `setInterval()`, or unmanaged `new Promise(r => setTimeout(r, ms))` inside Restate handlers. In-memory timers do not survive process crashes and block runtime resources.

Always use `await ctx.sleep(durationMs)`:

```typescript
// 1. Sleep for 15 minutes before sending an onboarding reminder
await ctx.sleep(15 * 60 * 1000)

// 2. Sleep for 7 days in a subscription trial workflow
await ctx.sleep(7 * 24 * 60 * 60 * 1000)
```

During `ctx.sleep`:
- Restate flushes state to disk and completely suspends execution.
- Zero CPU or memory is consumed by the worker process.
- If the server or worker restarts 3 days into a 7-day sleep, Restate seamlessly resumes at the exact remaining duration when the deadline arrives.

---

## 4. Workflows vs Virtual Objects vs Services

| Trait | Stateless Service (`restate.service`) | Virtual Object (`restate.object`) | Workflow (`restate.workflow`) |
| :--- | :--- | :--- | :--- |
| **Identity Key** | None (ephemeral) | Bound key string (`ctx.key`) | Bound key string (`ctx.key`) |
| **Concurrency** | Fully concurrent | Single-writer per key (queued) | Single-writer `run` per key |
| **Lifecycle** | Per-request RPC | Indefinite persistent actor | Runs to completion once per key |
| **K/V State** | None | Full (`ctx.get`, `ctx.set`, `ctx.clear`) | Full (`ctx.get`, `ctx.set`, `ctx.clear`) |
| **Queries/Signals** | Standard RPC handlers | Shared handlers (`ctx.get`) | Shared handlers (`WorkflowSharedContext`) |
