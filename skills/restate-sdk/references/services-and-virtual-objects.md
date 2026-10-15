# Services, Virtual Objects & State Management

This guide covers defining stateless services (`restate.service`), stateful single-writer Virtual Objects (`restate.object`), state management primitives (`ctx.get`, `ctx.set`, `ctx.clear`), and type-safe RPC invocation.

---

## 1. Stateless Services (`restate.service`)

Stateless services group related RPC handlers without a bound identity key. Handlers execute concurrently with automatic retries and durable journaling:

```typescript
import * as restate from '@restatedev/restate-sdk'

export const emailService = restate.service({
  name: 'EmailService',
  handlers: {
    sendReceipt: async (
      ctx: restate.Context,
      req: { to: string; orderId: string; amount: number }
    ) => {
      // Non-deterministic network calls MUST be wrapped in ctx.run
      await ctx.run('send-smtp-email', async () => {
        console.log(`Sending receipt for ${req.orderId} to ${req.to}`)
        // await smtpClient.sendMail(...)
      })

      return { delivered: true }
    },
  },
})
```

---

## 2. Stateful Virtual Objects (`restate.object`)

Virtual Objects are stateful distributed entities tied to a unique identity string (`ctx.key`). Restate guarantees **single-writer consistency**: only one handler modifies a specific key at any given time, preventing race conditions.

```typescript
import * as restate from '@restatedev/restate-sdk'

export interface CartItem {
  sku: string
  quantity: number
  price: number
}

export const shoppingCart = restate.object({
  name: 'ShoppingCart',
  handlers: {
    // Exclusive write handler
    addItem: async (ctx: restate.ObjectContext, item: CartItem) => {
      const cart = (await ctx.get<CartItem[]>('items')) ?? []
      cart.push(item)
      ctx.set('items', cart)
      return { totalItems: cart.length }
    },

    // Read-only shared handler (executes concurrently without blocking writes)
    getItems: restate.handlers.object.shared(
      async (ctx: restate.ObjectSharedContext) => {
        return (await ctx.get<CartItem[]>('items')) ?? []
      }
    ),

    // Checkout and clear
    checkout: async (ctx: restate.ObjectContext) => {
      const cart = (await ctx.get<CartItem[]>('items')) ?? []
      if (cart.length === 0) {
        throw new restate.TerminalError('Cart is empty', { errorCode: 400 })
      }

      ctx.clear('items')
      return { itemsCheckedOut: cart.length }
    },
  },
})
```

### State Storage Primitives

| Method | Context Scope | Description |
| :--- | :--- | :--- |
| `await ctx.get<T>(key)` | Exclusive & Shared | Reads stored value for `key` (returns `null` if missing). |
| `ctx.set(key, value)` | Exclusive Only | Overwrites stored value for `key`. |
| `ctx.clear(key)` | Exclusive Only | Deletes stored value for `key`. |
| `await ctx.stateKeys()` | Exclusive & Shared | Lists all persistent state keys for this object. |

---

## 3. Type-Safe Client Invocations

### Inter-Service Communication (`ctx.serviceClient` & `ctx.objectClient`)

Call other services or objects directly from a handler with end-to-end type safety:

```typescript
export const checkoutService = restate.service({
  name: 'CheckoutService',
  handlers: {
    processOrder: async (ctx: restate.Context, req: { userId: string; orderId: string }) => {
      // 1. Invoke Virtual Object by key (userId)
      const userCart = ctx.objectClient(shoppingCart, req.userId)
      const items = await userCart.getItems()

      // 2. Clear user cart
      await userCart.checkout()

      // 3. Invoke Stateless Service
      const email = ctx.serviceClient(emailService)
      await email.sendReceipt({
        to: `${req.userId}@example.com`,
        orderId: req.orderId,
        amount: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      })

      return { status: 'COMPLETED' }
    },
  },
})
```

### Calling Restate from Outside (External API or Frontend)

Use `@restatedev/restate-sdk-clients` to invoke Restate handlers from external Node, Bun, or Web services:

```typescript
import { connect } from '@restatedev/restate-sdk-clients'
import type { shoppingCart } from './services'

const client = connect({ url: 'http://localhost:8080' })

// Call virtual object externally
const cart = client.objectClient(shoppingCart, 'user-123')
await cart.addItem({ sku: 'WIDGET-01', quantity: 2, price: 29.99 })
```
