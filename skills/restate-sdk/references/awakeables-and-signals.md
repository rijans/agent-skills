# Awakeables & Human-in-the-Loop Orchestration

This guide explains how to pause workflows waiting for external events, webhooks, or manual human approvals using Restate **Awakeables**, how to resolve them safely, and how to handle durable timeout fallbacks.

---

## 1. What is an Awakeable?

An **Awakeable** is a durable, one-shot promise paired with a unique global ID (`id`). When an awakeable is created:
1. Restate issues an unguessable token string.
2. The workflow can send this token to an external service (Slack, email, webhook, user portal).
3. The workflow awaits `promise`. Restate suspends the workflow and frees all compute resources.
4. When an external system posts to Restate with the awakeable ID, Restate wakes up the exact suspended workflow invocation and delivers the payload.

```typescript
import * as restate from '@restatedev/restate-sdk'

export const approvalWorkflow = restate.workflow({
  name: 'ApprovalWorkflow',
  handlers: {
    run: async (ctx: restate.WorkflowContext, req: { amount: number; submitter: string }) => {
      // 1. Create an awakeable token and promise
      const { id, promise } = ctx.awakeable<{ approved: boolean; reviewer: string }>()

      // 2. Dispatch the approval link containing the token to an admin or Slack channel
      await ctx.run('send-approval-request', async () => {
        const approvalUrl = `https://portal.company.com/approvals?token=${id}`
        console.log(`[Notification] Please approve expense for \$${req.amount}: ${approvalUrl}`)
        // Dispatch via Slack webhook, Resend, or SendGrid
      })

      // 3. Suspend until human approves or rejects via the link
      const decision = await promise

      if (!decision.approved) {
        throw new restate.TerminalError(`Expense rejected by ${decision.reviewer}`, {
          errorCode: 403,
        })
      }

      // 4. Continue workflow on approval
      await ctx.run('process-payout', async () => {
        console.log(`[Payout] Processing payout approved by ${decision.reviewer}`)
      })

      return { status: 'APPROVED', reviewer: decision.reviewer }
    },
  },
})
```

---

## 2. Resolving Awakeables

Awakeables can be completed using any of three methods:

### Method A: From Another Restate Handler (`ctx.resolveAwakeable`)
When an external webhook or callback hits a Restate stateless service:

```typescript
export const webhookService = restate.service({
  name: 'WebhookService',
  handlers: {
    handleApprovalWebhook: async (
      ctx: restate.Context,
      req: { awakeableId: string; approved: boolean; reviewer: string }
    ) => {
      // Complete the waiting awakeable
      ctx.resolveAwakeable(req.awakeableId, {
        approved: req.approved,
        reviewer: req.reviewer,
      })
      return { received: true }
    },
  },
})
```

To reject an awakeable with a terminal failure:
```typescript
ctx.rejectAwakeable(awakeableId, 'Request was declined by manager')
```

### Method B: Via HTTP Ingress API
External services without the Restate SDK can resolve or reject directly via HTTP POST:

```bash
# Resolve awakeable with JSON payload
curl -X POST "http://localhost:8080/restate/awakeables/awk_1a2b3c4d5e/resolve" \
  -H "Content-Type: application/json" \
  -d '{"approved": true, "reviewer": "alice@company.com"}'

# Reject awakeable
curl -X POST "http://localhost:8080/restate/awakeables/awk_1a2b3c4d5e/reject" \
  -H "Content-Type: text/plain" \
  -d "Manager declined approval"
```

### Method C: Via External Node/Web Client (`@restatedev/restate-sdk-clients`)

```typescript
import { connect } from '@restatedev/restate-sdk-clients'

const client = connect({ url: 'http://localhost:8080' })

// Resolve
await client.awakeable('awk_1a2b3c4d5e').resolve({
  approved: true,
  reviewer: 'alice@company.com',
})

// Or reject
await client.awakeable('awk_1a2b3c4d5e').reject('Rejected due to budget limits')
```

---

## 3. Durable Timeout Fallbacks (`Promise.race` + `ctx.sleep`)

To prevent a workflow from waiting indefinitely if a human never responds or a webhook drops:

```typescript
export const timesensitiveWorkflow = restate.workflow({
  name: 'TimeSensitiveWorkflow',
  handlers: {
    run: async (ctx: restate.WorkflowContext) => {
      const { id, promise } = ctx.awakeable<{ verified: boolean }>()

      await ctx.run('send-verification-sms', async () => {
        // Send SMS containing awakeable id
      })

      // Race the awakeable against a durable timer (e.g. 24 hours)
      const TIMEOUT_SYMBOL = Symbol('TIMEOUT')
      const timeoutPromise = ctx.sleep(24 * 60 * 60 * 1000).then(() => TIMEOUT_SYMBOL)

      const outcome = await Promise.race([promise, timeoutPromise])

      if (outcome === TIMEOUT_SYMBOL) {
        console.warn('Verification timed out after 24 hours')
        return { status: 'TIMED_OUT' }
      }

      return { status: 'VERIFIED', data: outcome }
    },
  },
})
```

---

## 4. Security & Untrusted Payload Guardrail

Because awakeable tokens can be resolved from external HTTP endpoints, always treat resolution payloads as **untrusted data**:

1. **Schema Validation**: Parse and validate the payload using Zod or Valibot before trusting values:
   ```typescript
   import { z } from 'zod'

   const ApprovalPayloadSchema = z.object({
     approved: z.boolean(),
     reviewer: z.string().email(),
   })

   const rawPayload = await promise
   const validated = ApprovalPayloadSchema.parse(rawPayload)
   ```
2. **Never Pass Raw Strings to Shell or Eval**: Never evaluate dynamic strings from awakeables in code execution contexts or dynamic SQL queries.
3. **Keep Awakeable IDs Confidential**: Awakeable IDs are bearer tokens; do not log them in public logging streams or leak them in query parameters that get indexed.
