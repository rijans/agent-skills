# Restate Payment Saga with Compensation Rollback

A runnable example demonstrating the **Saga Pattern** in `@restatedev/restate-sdk`. This service orchestrates inventory reservation and payment processing, automatically executing compensating rollback steps (releasing reserved inventory) if the payment step fails or encounters a `TerminalError`.

---

## Architecture & Flow

```text
[Checkout Request]
       │
       ▼
1. Reserve Inventory ────(Success)───► Compensations: [Release Inventory]
       │
       ▼
2. Charge Stripe     ────(Declined)──► Rollback: Execute compensations (LIFO)
                                      └─► Re-throw TerminalError (No retry storm)
```

1. **Deterministic Execution**: All database calls and Stripe charges are wrapped in `ctx.run()`.
2. **Reverse Compensation**: Rollback lambdas execute in LIFO order (`compensations.reverse()`).
3. **Permanent Failure Protection**: Non-retryable errors throw `TerminalError` with HTTP 402/400.

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
The Restate runtime engine starts on `http://localhost:8080`.

### 4. Register the Service with Restate

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

## Testing the Workflows

### Scenario A: Successful Checkout

```bash
curl -X POST http://localhost:8080/OrderCheckoutSaga/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ord_1001",
    "customerId": "cust_alice",
    "sku": "WIDGET-01",
    "quantity": 2,
    "amountCents": 4999,
    "cardNumber": "4000-0000-0000-0001"
  }'
```

**Expected Console Output:**
```text
[Inventory] Reserved 2 units of SKU WIDGET-01 for order ord_1001
[Payment] Authorizing charge of $49.99 for order ord_1001
[Payment] Charge successful: ch_...
[Saga] Order ord_1001 successfully completed and invoiced
```

### Scenario B: Payment Decline & Compensation Rollback

Using card `4000-0000-0000-0002` simulates a decline, triggering the compensation rollback:

```bash
curl -X POST http://localhost:8080/OrderCheckoutSaga/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "ord_1002",
    "customerId": "cust_bob",
    "sku": "WIDGET-02",
    "quantity": 5,
    "amountCents": 12500,
    "cardNumber": "4000-0000-0000-0002"
  }'
```

**Expected Console Output:**
```text
[Inventory] Reserved 5 units of SKU WIDGET-02 for order ord_1002
[Payment] Authorizing charge of $125.00 for order ord_1002
[Saga] Step failed in order ord_1002. Commencing compensation rollback... Card declined: Insufficient funds or invalid card
[Inventory Compensation] Released 5 units of SKU WIDGET-02 for order ord_1002
```
Restate halts retries immediately and returns a clean 402 error to the caller, while inventory is safely released.
