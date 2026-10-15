# Origin Private File System (OPFS) Persistence

This guide covers configuring durable, in-browser disk storage using the Origin Private File System (`opfs://`), managing write durability with `CHECKPOINT;`, requesting storage persistence, and handling multi-tab concurrency.

---

## 1. What is the Origin Private File System (OPFS)?

The Origin Private File System is a private, origin-isolated storage area optimized for high-performance direct file access in dedicated Web Workers. Unlike IndexedDB, which serializes objects into transactional records, OPFS provides raw byte-level random file access, enabling DuckDB-Wasm to run its full C++ storage engine directly on client disk.

---

## 2. Opening an OPFS Database

Prefix the database path with `opfs://` inside `db.open()`:

```typescript
import * as duckdb from '@duckdb/duckdb-wasm'

export async function openPersistentDatabase(
  db: duckdb.AsyncDuckDB,
  dbName = 'local_analytics.duckdb'
): Promise<duckdb.AsyncDuckDBConnection> {
  // Open the database file inside OPFS
  await db.open({
    path: `opfs://${dbName}`,
    accessMode: duckdb.DuckDBAccessMode.READ_WRITE,
  })

  const conn = await db.connect()

  // Initialize schema if not present
  await conn.query(`
    CREATE TABLE IF NOT EXISTS events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_name VARCHAR,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      payload JSON
    );
  `)

  return conn
}
```

---

## 3. The `CHECKPOINT` Guardrail: Ensuring Data Durability

DuckDB utilizes a Write-Ahead Log (WAL) to buffer modifications before committing them to the main database file. If a user refreshes or closes the browser tab before the WAL is flushed, uncommitted writes may be lost.

**Always execute `CHECKPOINT;` after batch insertions or before closing connections**:

```typescript
export async function insertAndCommit(
  conn: duckdb.AsyncDuckDBConnection,
  eventName: string,
  payload: Record<string, unknown>
) {
  // 1. Insert records
  await conn.query(`
    INSERT INTO events (event_name, payload)
    VALUES ('${eventName}', '${JSON.stringify(payload)}');
  `)

  // 2. Force WAL flush to disk
  await conn.query('CHECKPOINT;')
}
```

---

## 4. Requesting Persistent Browser Storage

By default, browser storage is "best-effort" and can be evicted by the browser under disk pressure. To prevent eviction of user analytical databases, request persistent storage permissions:

```typescript
export async function requestStoragePersistence(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persisted()
    if (!isPersisted) {
      const granted = await navigator.storage.persist()
      console.log(`Persistent storage granted: ${granted}`)
      return granted
    }
    return true
  }
  return false
}

export async function checkStorageQuota() {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate()
    const usedMB = (estimate.usage || 0) / (1024 * 1024)
    const quotaMB = (estimate.quota || 0) / (1024 * 1024)
    console.log(`Storage used: ${usedMB.toFixed(2)} MB / ${quotaMB.toFixed(2)} MB`)
  }
}
```

---

## 5. Multi-Tab Concurrency & Exclusive Locks

OPFS uses exclusive file locking on database files. If a user opens two browser tabs that attempt to open the same `opfs://analytics.duckdb` file in `READ_WRITE` mode:

1. The second tab will throw an error (`IO Error: Could not acquire lock on file`).
2. **Mitigation**:
   - Use `navigator.locks` to coordinate single-tab leader election:
   ```typescript
   await navigator.locks.request('duckdb_opfs_lock', async (lock) => {
     const conn = await openPersistentDatabase(db)
     // Keep connection open while tab is active
     await new Promise((resolve) => window.addEventListener('beforeunload', resolve))
   })
   ```
   - Alternatively, open subsequent tabs in `READ_ONLY` mode:
   ```typescript
   await db.open({
     path: 'opfs://analytics.duckdb',
     accessMode: duckdb.DuckDBAccessMode.READ_ONLY,
   })
   ```
