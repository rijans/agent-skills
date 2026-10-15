# Evaluation & Benchmark Suite: `duckdb-wasm`

This document defines the evaluation criteria, positive/negative trigger boundaries, and adversarial benchmark scenarios for the `duckdb-wasm` agent skill.

---

## 1. Intent Matching & Trigger Boundaries

### Positive Triggers (Activate Skill)
- "Run analytical SQL queries in the browser using DuckDB-Wasm"
- "How do I query local Parquet files in a Vite app with @duckdb/duckdb-wasm?"
- "Persist an in-browser database to Origin Private File System (OPFS) with DuckDB"
- "Set up DuckDB-Wasm with Web Workers and handle COOP/COEP headers"
- "Stream remote Parquet files using HTTP range requests in DuckDB-Wasm"
- "Ingest Apache Arrow streaming tables into DuckDB-Wasm"
- "Fix WebAssembly instantiation and worker bundling errors in Vite/Next.js for DuckDB"

### Negative Triggers (Do Not Activate Skill)
- "Set up a server-side DuckDB database in Python or Node.js" $\rightarrow$ Route to native `duckdb` Python/Node SDK.
- "Build a transactional SQLite database on Telegram Serverless" $\rightarrow$ Route to `telegram-serverless-bot` or `use-telegram-serverless`.
- "Configure PostgreSQL database with Prisma in Next.js" $\rightarrow$ Generic Node/Postgres workflow.
- "Build an in-memory client-side cache using localStorage" $\rightarrow$ Standard Web API workflow.

---

## 2. Core Quality Rubrics

| Category | Passing Standard (Score: 5/5) | Failing Standard (Score: 0/5) |
|---|---|---|
| **Bundler Architecture** | Uses explicit asset URLs (`?url` in Vite, `getJsDelivrBundles()` for CDN, or dedicated worker files) to avoid bundler syntax errors. | Directly calls `import wasm from 'duckdb.wasm'` without bundler configuration, causing build/runtime crashes. |
| **Threading & COOP/COEP** | Defaults to single-threaded `eh` bundle; documents or checks for cross-origin isolation before initializing `pthreadWorker`. | Blindly specifies multi-threaded `pthreadWorker` in environments lacking COOP/COEP headers, crashing with `SharedArrayBuffer` errors. |
| **OPFS Persistence** | Uses `opfs://` path, opens database with appropriate access mode, and executes `CHECKPOINT;` after writes. | Expects in-memory `db.open()` to persist across reloads, or writes to `opfs://` without checkpointing, causing data loss. |
| **Arrow Memory Efficiency** | Iterates `result.batches` or accesses column vectors directly for analytical processing; limits `toArray()` to small subsets. | Calls `result.toArray()` on 200,000+ row datasets, exhausting the browser JS heap memory. |
| **Security & Injection** | Uses parameterized queries (`conn.prepare`) and restricts remote file URLs via allowlists (`W011`). | Concatenates untrusted user strings into raw SQL queries or registers unvalidated external URLs. |

---

## 3. Adversarial Traps & Benchmark Scenarios

### Trap Scenario 1: Bundler Asset Import Failure in Vite
- **Prompt**: *"Write a Vite helper function that initializes `@duckdb/duckdb-wasm`."*
- **Failure**: The agent writes:
  ```javascript
  import duckdbWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm';
  import worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js';
  ```
  Vite fails at build time or runtime because WebAssembly and worker binaries are not valid ES modules when imported directly.
- **Pass Criteria**: The agent uses Vite's `?url` suffix (`import workerUrl from '...?url'`) or uses `duckdb.getJsDelivrBundles()` to dynamically resolve URLs.

### Trap Scenario 2: Unhandled Multi-Threading Crash on Missing Headers
- **Prompt**: *"Configure a high-performance multi-threaded DuckDB-Wasm instance in my web app."*
- **Failure**: The agent passes `pthreadWorker` to `db.instantiate()` without verifying or configuring `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers. The browser throws `ReferenceError: SharedArrayBuffer is not defined` and the app crashes.
- **Pass Criteria**: The agent explains that multi-threading requires Cross-Origin Isolation headers, provides the `vite.config.js` / server header configuration, and demonstrates graceful fallback to the single-threaded `eh` bundle.

### Trap Scenario 3: Memory Heap Crash via `result.toArray()`
- **Prompt**: *"Query a 100MB Parquet dataset with 500,000 rows in DuckDB-Wasm and display aggregate statistics."*
- **Failure**: The agent runs `const result = await conn.query('SELECT * FROM data')` followed by `const rows = result.toArray()` and maps over rows with JavaScript `Array.prototype.reduce()`. V8 runs out of heap memory converting 500k columnar records into plain JS objects.
- **Pass Criteria**: The agent performs the aggregation directly in SQL (`SELECT AVG(x), SUM(y) FROM data`) or processes the Apache Arrow table columnar batches (`for (const batch of result.batches)`) without row-level JavaScript materialization.

### Trap Scenario 4: Silent Data Loss in OPFS (Missing `CHECKPOINT`)
- **Prompt**: *"Create a persistent user activity log in DuckDB-Wasm that survives browser tab closures."*
- **Failure**: The agent connects to `opfs://activity.duckdb` and runs `INSERT INTO logs VALUES (...)`. When the user closes or refreshes the page, the DuckDB worker terminates abruptly before flushing the write-ahead log (WAL) to disk, causing lost updates.
- **Pass Criteria**: The agent explicitly calls `await conn.query('CHECKPOINT;')` or ensures proper `conn.close()` / `db.flushFiles()` lifecycle management to sync WAL buffers to OPFS.

### Trap Scenario 5: SQL & Remote SSRF Injection
- **Prompt**: *"Build a search feature where users can type a query filter or specify an external Parquet URL to load."*
- **Failure**: The agent constructs queries with string interpolation (`conn.query(`SELECT * FROM dataset WHERE category = '${userInput}'`)`) and directly registers arbitrary user URLs with `registerFileURL`.
- **Pass Criteria**: The agent incorporates strict Snyk `W011` Indirect Prompt Injection Defense, uses `conn.prepare()` with parameter binding (`$1` or `?`), and validates external URLs against an allowlist before registration.
