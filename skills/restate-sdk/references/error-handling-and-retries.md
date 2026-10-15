# Error Handling, Retries & Terminal Failures

This guide details Restate's dual error model, configuring retry policies, distinguishing transient from permanent failures, and using `TerminalError` to prevent retry storms.

---

## 1. Restate's Error Model: Transient vs. Terminal

Restate provides fault tolerance by automatically retrying failed operations:

| Error Type | Thrown As | Restate Behavior | Typical Scenarios |
| :--- | :--- | :--- | :--- |
| **Transient Error** | Standard JavaScript `Error`, `TypeError`, etc. | **Indefinite Retries with Backoff**: Suspends handler, schedules exponential backoff, and re-invokes from the last completed journal checkpoint. | Network glitches, downstream 500/503 errors, DB deadlocks, process crashes. |
| **Terminal Error** | `restate.TerminalError` | **Immediate Halt**: Aborts retry loop, records permanent failure in the journal, and propagates the error to the caller or enclosing `try/catch`. | Bad request (400), invalid credit card (402), unauthorized (401/403), item out of stock. |

---

## 2. Raising `TerminalError`

Whenever a failure represents a non-recoverable business rule or invalid user input, throw `TerminalError`:

```typescript
import * as restate from '@restatedev/restate-sdk'

export const paymentService = restate.service({
  name: 'PaymentService',
  handlers: {
    charge: async (ctx: restate.Context, req: { amount: number; cardToken: string }) => {
      // 1. Validate payload: non-recoverable input error
      if (req.amount <= 0) {
        throw new restate.TerminalError('Amount must be positive', { errorCode: 400 })
      }

      // 2. Perform external call inside ctx.run
      const paymentResult = await ctx.run('stripe-charge', async () => {
        const res = await callStripeApi(req.cardToken, req.amount)

        if (res.status === 'card_declined') {
          // Terminal: Retrying will NOT make the card valid
          throw new restate.TerminalError('Payment declined: insufficient funds', {
            errorCode: 402,
          })
        }

        if (res.status === 'service_unavailable') {
          // Transient: Throw standard Error so Restate retries the call
          throw new Error('Stripe API unavailable: temporary gateway error')
        }

        return res
      })

      return paymentResult
    },
  },
})
```

---

## 3. The Infinite Retry Trap

> [!WARNING]
> If you throw a regular `Error` for an unrecoverable condition (e.g. `throw new Error('User not found')`), Restate will retry that handler indefinitely. This causes CPU burn, log flooding, and blocks the queue for Virtual Objects. Always classify errors:

```typescript
// ❌ WRONG: Causes infinite retry storm on invalid credentials
if (!validApiKey) {
  throw new Error('Invalid API Key')
}

// ✅ CORRECT: Aborts immediately and surfaces 401
if (!validApiKey) {
  throw new restate.TerminalError('Invalid API Key', { errorCode: 401 })
}
```

---

## 4. Catching Terminal Errors in Sagas

`TerminalError` can be caught within the workflow handler to trigger compensating logic:

```typescript
export const checkoutService = restate.service({
  name: 'CheckoutService',
  handlers: {
    process: async (ctx: restate.Context, req: { orderId: string }) => {
      let reservedStock = false

      try {
        await ctx.run('reserve-inventory', async () => {
          reservedStock = true
        })

        // This call might throw a TerminalError
        await ctx.serviceClient(paymentService).charge({ amount: 100, cardToken: 'tok_invalid' })
      } catch (err) {
        if (err instanceof restate.TerminalError) {
          console.warn(`Terminal error caught: ${err.message}. Cleaning up...`)
          if (reservedStock) {
            await ctx.run('release-inventory', async () => {
              // Roll back reservation
            })
          }
        }
        // Re-throw if caller should also observe the failure
        throw err
      }
    },
  },
})
```

---

## 5. Retry Policy Configuration

While Restate provides default exponential backoff policies, you can inspect or configure invocation behavior on the Restate Server deployment level or per-handler options where supported by your Restate server version:

```typescript
// Initial retry delay: 100ms
// Max retry delay: 10s
// Exponential backoff factor: 2.0
```
