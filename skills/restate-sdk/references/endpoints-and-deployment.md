# Endpoints, Runtimes & Deployment Guide

This guide covers configuring endpoints across Node.js, Bun, Cloudflare Workers, and AWS Lambda, running the local Restate development server, and registering service deployments.

---

## 1. Architectural Model

```text
External Client / Ingress (HTTP / SDK Client)
                 │
                 ▼  (Port 8080)
┌─────────────────────────────────┐
│     Restate Server Engine       │  <── Durable journaling, state store,
│   (Single binary or container)  │      suspension, retries, and timer queue
└─────────────────────────────────┘
                 │
                 ▼  (Port 9080 or Serverless Invocation)
┌─────────────────────────────────┐
│    Your Service Application     │  <── Node.js / Bun / CF Worker / Lambda
│  (restate.service/object/work)  │      Stateless compute executing steps
└─────────────────────────────────┘
```

Restate separates execution and state management from compute. Your application simply exposes HTTP endpoints that Restate calls to execute journaled steps.

---

## 2. Node.js & Bun Server (`restate.endpoint`)

In Node.js or Bun, use `@restatedev/restate-sdk` to start an HTTP server listening on port `9080` (or custom port):

```typescript
import * as restate from '@restatedev/restate-sdk'
import { paymentService } from './services/payment.js'
import { orderWorkflow } from './workflows/order.js'
import { shoppingCart } from './objects/cart.js'

const port = Number(process.env.PORT ?? 9080)

restate
  .endpoint()
  .bind(paymentService)
  .bind(orderWorkflow)
  .bind(shoppingCart)
  .listen(port, () => {
    console.log(`[Restate] Services listening on http://0.0.0.0:${port}`)
  })
```

---

## 3. Cloudflare Workers (`@restatedev/restate-sdk/fetch`)

In Cloudflare Workers, use the `fetch` adapter:

```typescript
// src/worker.ts
import * as restate from '@restatedev/restate-sdk/fetch'
import { orderWorkflow } from './workflows/order'

export default restate
  .endpoint()
  .bind(orderWorkflow)
  .handler()
```

Sample `wrangler.toml`:
```toml
name = "my-restate-worker"
main = "src/worker.ts"
compatibility_date = "2024-09-01"
compatibility_flags = ["nodejs_compat"]
```

---

## 4. AWS Lambda (`@restatedev/restate-sdk/lambda`)

In AWS Lambda, use the `lambda` adapter:

```typescript
// src/lambda.ts
import * as restate from '@restatedev/restate-sdk/lambda'
import { paymentService } from './services/payment'
import { orderWorkflow } from './workflows/order'

export const handler = restate
  .endpoint()
  .bind(paymentService)
  .bind(orderWorkflow)
  .handler()
```

---

## 5. Running the Local Restate Server

### Option A: Via npx (Fastest for Local Dev)
```bash
npx @restatedev/restate-server
```
Starts the server on `http://localhost:8080` (ingress) and `http://localhost:9070` (admin).

### Option B: Via Docker
```bash
docker run --name restate -d \
  -p 8080:8080 \
  -p 9070:9070 \
  docker.io/restatedev/restate:latest
```

---

## 6. Registering Service Deployments

Once your service endpoint is running on `http://localhost:9080` and Restate Server is running on `http://localhost:8080`, register your endpoint:

### Using the Restate CLI
```bash
# Register deployment
restate deployments register http://localhost:9080

# List active deployments
restate deployments list

# List registered services and handlers
restate services list
```

### Using HTTP API Directly
```bash
curl -X POST http://localhost:9070/deployments \
  -H "Content-Type: application/json" \
  -d '{"uri": "http://localhost:9080"}'
```

On registration, Restate queries your endpoint's schema discovery route, registers all services, objects, workflows, and handlers, and begins routing calls to them.
