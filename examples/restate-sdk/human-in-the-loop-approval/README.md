# Restate Human-in-the-Loop Approval Workflow

A runnable example demonstrating **Awakeables**, durable suspension, and timeout handling with `@restatedev/restate-sdk`. This workflow suspends execution while waiting for a manager to approve an expense report, consuming zero CPU until resolved via an HTTP callback or helper service.

---

## Architecture & Flow

```text
[Expense Submission]
        │
        ▼
1. Create Awakeable ID ──► Dispatches approval link to Slack / Email
        │
        ▼
2. Suspend Workflow    ──► Waits for human decision (or durable timeout fallback)
        │
  ┌─────┴────────────────┐
  ▼                      ▼
Approved               Rejected / Timed Out
  │                      │
  ▼                      ▼
Execute Disbursement   Record Terminal Status
```

- **Zero Compute During Wait**: Restate suspends the workflow state to disk while waiting.
- **Race with Durable Timer**: `Promise.race([awakeablePromise, ctx.sleep(timeoutMs)])` prevents hung executions.
- **Untrusted Payload Isolation**: Resolving payload structure is strictly validated before use.

---

## Quickstart

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Service Endpoint

```bash
npm start
```
The Restate service endpoint starts listening on port `9080`.

### 3. Start Local Restate Server

In a separate terminal:
```bash
npx @restatedev/restate-server
```

### 4. Register the Deployment

```bash
restate deployments register http://localhost:9080
```
Or via curl:
```bash
curl -X POST http://localhost:9070/deployments \
  -H "Content-Type: application/json" \
  -d '{"uri": "http://localhost:9080"}'
```

---

## Testing the Workflow

### Step 1: Submit an Expense Workflow

Workflows in Restate are identified by a unique key in the URL path (`ExpenseApprovalWorkflow/{workflowId}/run`):

```bash
curl -X POST http://localhost:8080/ExpenseApprovalWorkflow/exp_2001/run \
  -H "Content-Type: application/json" \
  -d '{
    "expenseId": "exp_2001",
    "employeeName": "Alice Jenkins",
    "amountCents": 34900,
    "category": "Travel & Conferences",
    "timeoutMs": 120000
  }'
```

Notice the service console logs an awakeable token like:
```text
[ACTION REQUIRED] Expense Approval Pending for Alice Jenkins:
Expense ID:   exp_2001
Amount:       $349.00
Awakeable ID: awk_1XyZ...
Resolve URL:  http://localhost:8080/restate/awakeables/awk_1XyZ.../resolve
```
The workflow is now suspended.

### Step 2: Check Status (Concurrent Shared Query)

You can query the workflow state without waking it up:

```bash
curl http://localhost:8080/ExpenseApprovalWorkflow/exp_2001/getStatus
```

**Response:**
```json
{
  "status": "PENDING_APPROVAL",
  "awakeableId": "awk_1XyZ...",
  "employeeName": "Alice Jenkins",
  "reviewer": null
}
```

### Step 3: Approve the Expense

Resolve the awakeable via curl directly:

```bash
curl -X POST "http://localhost:8080/restate/awakeables/<AWAKEABLE_ID>/resolve" \
  -H "Content-Type: application/json" \
  -d '{"approved": true, "reviewer": "manager@company.com"}'
```

Or invoke the helper `ApprovalDecisionService`:
```bash
curl -X POST http://localhost:8080/ApprovalDecisionService/submitDecision \
  -H "Content-Type: application/json" \
  -d '{
    "awakeableId": "<AWAKEABLE_ID>",
    "approved": true,
    "reviewer": "charlie@company.com"
  }'
```

### Step 4: Verify Finalized State

The workflow immediately wakes up, runs `execute-disbursement`, and completes:

```bash
curl http://localhost:8080/ExpenseApprovalWorkflow/exp_2001/getStatus
```

**Response:**
```json
{
  "status": "APPROVED",
  "awakeableId": "awk_1XyZ...",
  "employeeName": "Alice Jenkins",
  "reviewer": "manager@company.com"
}
```
