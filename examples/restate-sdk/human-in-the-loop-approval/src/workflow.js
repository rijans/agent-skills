import * as restate from '@restatedev/restate-sdk'

const TIMEOUT_EVENT = Symbol('TIMEOUT_EVENT')

/**
 * Durable Expense Approval Workflow.
 * Suspends indefinitely without consuming CPU until resolved via awakeable or timeout.
 */
export const expenseApprovalWorkflow = restate.workflow({
  name: 'ExpenseApprovalWorkflow',
  handlers: {
    run: async (ctx, req) => {
      const { expenseId, employeeName, amountCents, category } = req

      console.log(`[Workflow: ${expenseId}] Initializing approval for \$${(amountCents / 100).toFixed(2)} (${category})`)

      ctx.set('status', 'PENDING_APPROVAL')
      ctx.set('expenseId', expenseId)
      ctx.set('amountCents', amountCents)
      ctx.set('employeeName', employeeName)

      // 1. Create a durable Awakeable token
      const { id: awakeableId, promise: awakeablePromise } = ctx.awakeable()
      ctx.set('awakeableId', awakeableId)

      // 2. Dispatch human-in-the-loop notification (Slack / Email)
      await ctx.run('dispatch-approval-notification', async () => {
        const portalUrl = `http://localhost:8080/restate/awakeables/${awakeableId}/resolve`
        console.log(`----------------------------------------------------------------------`)
        console.log(`[ACTION REQUIRED] Expense Approval Pending for ${employeeName}:`)
        console.log(`Expense ID:   ${expenseId}`)
        console.log(`Amount:       \$${(amountCents / 100).toFixed(2)}`)
        console.log(`Awakeable ID: ${awakeableId}`)
        console.log(`Resolve URL:  ${portalUrl}`)
        console.log(`----------------------------------------------------------------------`)
      })

      // 3. Set a durable timeout (e.g. 120 seconds for demo; in production days/weeks)
      const timeoutMs = req.timeoutMs || 120000
      const timeoutPromise = ctx.sleep(timeoutMs).then(() => TIMEOUT_EVENT)

      // 4. Race awakeable resolution against durable sleep
      const outcome = await Promise.race([awakeablePromise, timeoutPromise])

      if (outcome === TIMEOUT_EVENT) {
        ctx.set('status', 'TIMED_OUT')
        console.warn(`[Workflow: ${expenseId}] Approval request timed out after ${timeoutMs}ms`)
        return {
          expenseId,
          status: 'TIMED_OUT',
          message: 'Approval window expired without human response',
        }
      }

      // Untrusted payload isolation & validation
      const decision = outcome
      if (typeof decision !== 'object' || decision === null || typeof decision.approved !== 'boolean') {
        throw new restate.TerminalError('Invalid awakeable decision payload structure', {
          errorCode: 400,
        })
      }

      if (!decision.approved) {
        ctx.set('status', 'REJECTED')
        ctx.set('reviewer', decision.reviewer || 'unknown')
        ctx.set('reason', decision.reason || 'No reason provided')

        console.log(`[Workflow: ${expenseId}] Expense rejected by ${decision.reviewer}: ${decision.reason}`)
        return {
          expenseId,
          status: 'REJECTED',
          reviewer: decision.reviewer,
          reason: decision.reason,
        }
      }

      // 5. Approved: Execute disbursement side-effect
      ctx.set('status', 'APPROVED')
      ctx.set('reviewer', decision.reviewer)

      const payout = await ctx.run('execute-disbursement', async () => {
        const transactionRef = `tx_payout_${Buffer.from(expenseId).toString('hex').slice(0, 8)}`
        console.log(`[Disbursement] Payout of \$${(amountCents / 100).toFixed(2)} issued to ${employeeName} (${transactionRef})`)
        return { transactionRef }
      })

      return {
        expenseId,
        status: 'APPROVED',
        reviewer: decision.reviewer,
        transactionRef: payout.transactionRef,
      }
    },

    // Concurrent read-only query handler for status checks
    getStatus: async (ctx) => {
      const status = (await ctx.get('status')) || 'NOT_FOUND'
      const awakeableId = (await ctx.get('awakeableId')) || null
      const employeeName = (await ctx.get('employeeName')) || null
      const reviewer = (await ctx.get('reviewer')) || null

      return { status, awakeableId, employeeName, reviewer }
    },
  },
})

/**
 * Helper service to resolve or reject awakeables programmatically.
 */
export const approvalDecisionService = restate.service({
  name: 'ApprovalDecisionService',
  handlers: {
    submitDecision: async (ctx, req) => {
      const { awakeableId, approved, reviewer, reason } = req
      if (!awakeableId) {
        throw new restate.TerminalError('Missing awakeableId parameter', { errorCode: 400 })
      }

      // Resolves the awakeable to resume the waiting workflow
      ctx.resolveAwakeable(awakeableId, {
        approved: Boolean(approved),
        reviewer: reviewer || 'manager@company.com',
        reason: reason || (approved ? 'Approved by manager' : 'Declined by manager'),
      })

      return { resolved: true, awakeableId }
    },
  },
})
