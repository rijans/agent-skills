import * as restate from '@restatedev/restate-sdk'

/**
 * Inventory service managing stock reservations and rollbacks.
 */
export const inventoryService = restate.service({
  name: 'InventoryService',
  handlers: {
    reserve: async (ctx, req) => {
      return await ctx.run('reserve-db-rows', async () => {
        console.log(`[Inventory] Reserved ${req.quantity} units of SKU ${req.sku} for order ${req.orderId}`)
        return { reserved: true, sku: req.sku, quantity: req.quantity }
      })
    },
    release: async (ctx, req) => {
      return await ctx.run('release-db-rows', async () => {
        console.log(`[Inventory Compensation] Released ${req.quantity} units of SKU ${req.sku} for order ${req.orderId}`)
        return { released: true }
      })
    },
  },
})

/**
 * Payment processing service with simulated gateway checks.
 */
export const paymentService = restate.service({
  name: 'PaymentService',
  handlers: {
    charge: async (ctx, req) => {
      return await ctx.run('stripe-charge-api', async () => {
        console.log(`[Payment] Authorizing charge of \$${(req.amountCents / 100).toFixed(2)} for order ${req.orderId}`)

        // Simulate terminal failure on decline (e.g. card error or amount limit)
        if (req.cardNumber === '4000-0000-0000-0002') {
          throw new restate.TerminalError('Card declined: Insufficient funds or invalid card', {
            errorCode: 402,
          })
        }

        if (req.amountCents > 100000) {
          throw new restate.TerminalError('Transaction amount exceeds velocity threshold (\$1,000.00)', {
            errorCode: 400,
          })
        }

        const chargeId = `ch_${Buffer.from(req.orderId).toString('hex').slice(0, 12)}`
        console.log(`[Payment] Charge successful: ${chargeId}`)
        return { chargeId, paid: true }
      })
    },
    refund: async (ctx, req) => {
      return await ctx.run('stripe-refund-api', async () => {
        console.log(`[Payment Compensation] Refunded charge ${req.chargeId} for order ${req.orderId}`)
        return { refunded: true }
      })
    },
  },
})

/**
 * Resilient Order Saga orchestrating inventory reservation and payment authorization.
 * Executes compensating rollbacks in reverse order (LIFO) if any step throws a TerminalError.
 */
export const orderCheckoutSaga = restate.service({
  name: 'OrderCheckoutSaga',
  handlers: {
    checkout: async (ctx, req) => {
      const { orderId, customerId, sku, quantity, amountCents, cardNumber } = req
      const compensations = []

      console.log(`[Saga] Initiating checkout saga for order ${orderId} (customer: ${customerId})`)

      try {
        // Step 1: Reserve Inventory
        const inventoryClient = ctx.serviceClient(inventoryService)
        await inventoryClient.reserve({ orderId, sku, quantity })

        // Push compensation to release inventory if a downstream step fails
        compensations.push(async () => {
          await inventoryClient.release({ orderId, sku, quantity })
        })

        // Step 2: Authorize & Charge Payment
        const paymentClient = ctx.serviceClient(paymentService)
        const payment = await paymentClient.charge({ orderId, amountCents, cardNumber })

        // Push compensation to refund payment if subsequent steps fail
        compensations.push(async () => {
          await paymentClient.refund({ orderId, chargeId: payment.chargeId })
        })

        // Step 3: Record finalized order status
        await ctx.run('save-order-record', async () => {
          console.log(`[Saga] Order ${orderId} successfully completed and invoiced`)
        })

        return {
          orderId,
          status: 'COMPLETED',
          chargeId: payment.chargeId,
          sku,
          quantity,
        }
      } catch (err) {
        console.error(`[Saga] Step failed in order ${orderId}. Commencing compensation rollback...`, err.message)

        // Execute compensations in reverse order (LIFO)
        for (const compensate of compensations.reverse()) {
          try {
            await compensate()
          } catch (rollbackErr) {
            console.error(`[Saga] Compensation step failed; continuing with remaining rollbacks:`, rollbackErr)
          }
        }

        // Re-throw so Restate journals the terminal status
        throw err
      }
    },
  },
})
