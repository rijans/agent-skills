# SQL Queries, Prepared Statements & Apache Arrow Processing

This guide covers executing SQL queries in DuckDB-Wasm, working with Apache Arrow columnar data structures efficiently, preventing JavaScript heap exhaustion, and using parameterized prepared statements.

---

## 1. Executing Queries & The Arrow `Table`

Calling `conn.query(sql)` returns an [Apache Arrow `Table`](https://arrow.apache.org/docs/js/):

```typescript
import * as duckdb from '@duckdb/duckdb-wasm'
import { Table } from 'apache-arrow'

const conn = await db.connect()
const result: Table = await conn.query(`
  SELECT
    category,
    count(*) AS item_count,
    sum(amount) AS total_revenue
  FROM sales
  GROUP BY category
  ORDER BY total_revenue DESC;
`)

console.log(`Returned ${result.numRows} rows across ${result.numCols} columns.`)
```

---

## 2. Memory Efficiency: Columnar Access vs `toArray()`

### The `toArray()` Anti-Pattern for Large Datasets

Calling `result.toArray()` converts every Arrow record into a plain JavaScript object. On large datasets (e.g. 100,000+ rows), this allocates millions of small JavaScript heap objects, triggering severe GC latency and browser tab freezes.

| Method | Memory Footprint | Speed | Best For |
| :--- | :--- | :--- | :--- |
| `result.toArray()` | **High** (Object duplication) | Slow | Small summary tables (<1,000 rows), `console.table()` |
| Column Vector Access | **Zero-Copy** (Direct typed arrays) | **100x Faster** | Charts, visualization buffers, aggregations |
| `result.batches` | **Zero-Copy** | **100x Faster** | Streaming data pipelines, Web Workers |

### Zero-Copy Column Vector Access (Recommended)

Extract typed arrays directly from columns without row object instantiation:

```typescript
// Access column vectors directly
const categories = result.getChild('category')
const revenues = result.getChild('total_revenue')

if (categories && revenues) {
  for (let i = 0; i < result.numRows; i++) {
    const category = categories.get(i)
    const revenue = revenues.get(i)
    // Process values directly
  }
}

// Convert numeric column directly to a standard JavaScript TypedArray for charts
const revenueVector = result.getChild('total_revenue')
const numericArray = revenueVector?.toArray() // Fast zero-copy Float64Array / BigInt64Array view
```

### Iterating Record Batches for Streaming Processing

```typescript
for (const batch of result.batches) {
  console.log(`Processing batch with ${batch.numRows} rows...`)
  const colA = batch.getChildAt(0)
  // Work with batch chunk
}
```

---

## 3. Parameterized Prepared Statements

Always use prepared statements when incorporating dynamic user filters to prevent SQL injection and enable query plan caching:

```typescript
export async function queryUserPurchases(
  conn: duckdb.AsyncDuckDBConnection,
  userId: number,
  minAmount: number
) {
  // 1. Prepare statement with '?' placeholders
  const stmt = await conn.prepare(`
    SELECT *
    FROM purchases
    WHERE user_id = ? AND amount >= ?
    ORDER BY timestamp DESC;
  `)

  // 2. Execute statement with bound arguments
  const result = await stmt.query(userId, minAmount)

  // 3. Close statement when finished
  await stmt.close()

  return result
}
```

---

## 4. Ingesting Streaming Apache Arrow IPC

If your application receives binary Arrow IPC streams from a server endpoint or WebSocket, stream the bytes directly into an existing DuckDB table:

```typescript
export async function streamArrowIntoTable(
  conn: duckdb.AsyncDuckDBConnection,
  tableName: string,
  arrowIpcBytes: Uint8Array
) {
  // Ingests raw columnar Arrow IPC buffer into table
  await conn.insertArrowFromIPCStream(arrowIpcBytes, {
    name: tableName,
    create: true, // Auto-create table if not exists
  })

  const count = await conn.query(`SELECT count(*) FROM ${tableName};`)
  console.log('Total ingested:', count.toArray())
}
```
