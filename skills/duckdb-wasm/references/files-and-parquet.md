# Parquet, CSV & Virtual File System Ingestion

This guide covers registering files into DuckDB-Wasm's virtual file system (VFS), querying local files via drag-and-drop, streaming remote Parquet files using HTTP range requests, and exporting query results to downloadable Parquet files.

---

## 1. DuckDB Virtual File System (VFS) Overview

DuckDB-Wasm operates its own in-worker virtual file system. Files must be registered into the VFS before SQL queries can reference them by name.

| Method | Protocol / Source | Use Case | Memory Impact |
| :--- | :--- | :--- | :--- |
| `registerFileHandle` | `BROWSER_FILEREADER` | Drag-and-drop or `<input type="file">` | **Zero upfront load** (chunks streamed on demand) |
| `registerFileURL` | `HTTP` | Remote URLs on CDNs or S3 | **Range-requested** (only required row groups loaded) |
| `registerFileBuffer` | `BUFFER` | In-memory `Uint8Array` / `ArrayBuffer` | High (entire buffer in worker RAM) |
| `copyFileToBuffer` | VFS to Host | Extracting generated Parquet/CSV files | Temporary buffer copy |
| `dropFile` | VFS Cleanup | Unregistering files to reclaim memory | Releases virtual inode |

---

## 2. Ingesting Local Files (Drag-and-Drop & File Picker)

Use `registerFileHandle` with `DuckDBDataProtocol.BROWSER_FILEREADER` to query local files without loading the entire file into memory:

```typescript
import * as duckdb from '@duckdb/duckdb-wasm'

export async function registerLocalFile(
  db: duckdb.AsyncDuckDB,
  virtualName: string,
  file: File
) {
  // Register file handle directly into VFS
  await db.registerFileHandle(
    virtualName,
    file,
    duckdb.DuckDBDataProtocol.BROWSER_FILEREADER,
    true // cache: true
  )

  const conn = await db.connect()

  // Query metadata directly from Parquet file footer
  const schema = await conn.query(`DESCRIBE SELECT * FROM '${virtualName}';`)
  console.table(schema.toArray())

  // Run analytical aggregations
  const summary = await conn.query(`
    SELECT
      count(*) AS total_rows,
      min(timestamp) AS earliest,
      max(timestamp) AS latest
    FROM '${virtualName}';
  `)
  console.table(summary.toArray())

  await conn.close()
}
```

---

## 3. Querying Remote Parquet via HTTP Range Requests

DuckDB-Wasm can read remote Parquet files over HTTP without downloading the entire file, loading only the metadata footer and the specific column chunks requested:

```typescript
import * as duckdb from '@duckdb/duckdb-wasm'

export async function queryRemoteParquet(
  db: duckdb.AsyncDuckDB,
  remoteUrl: string
) {
  const virtualName = 'remote_dataset.parquet'

  // Register remote URL
  await db.registerFileURL(
    virtualName,
    remoteUrl,
    duckdb.DuckDBDataProtocol.HTTP,
    false // cache: false
  )

  const conn = await db.connect()

  // Queries only the 'total_amount' and 'passenger_count' columns via HTTP range requests
  const result = await conn.query(`
    SELECT
      passenger_count,
      avg(total_amount) AS avg_fare
    FROM '${virtualName}'
    GROUP BY passenger_count
    ORDER BY passenger_count;
  `)

  console.table(result.toArray())
  await conn.close()
}
```

> **Requirements for Remote Range Requests**:
> 1. The remote server must support CORS (`Access-Control-Allow-Origin: *`).
> 2. The remote server must support HTTP Range Requests (`Accept-Ranges: bytes` and `206 Partial Content`).

---

## 4. Exporting Data to Downloadable Parquet / CSV

Export query results or transformed tables into a Parquet file and trigger a browser download:

```typescript
export async function exportTableToParquet(
  db: duckdb.AsyncDuckDB,
  tableName: string,
  downloadFileName = 'export.parquet'
) {
  const conn = await db.connect()
  const virtualExportPath = 'export.parquet'

  // 1. Export query to VFS
  await conn.query(`
    COPY (SELECT * FROM ${tableName})
    TO '${virtualExportPath}'
    (FORMAT PARQUET, COMPRESSION ZSTD);
  `)
  await conn.close()

  // 2. Read exported file from VFS into Uint8Array buffer
  const buffer = await db.copyFileToBuffer(virtualExportPath)

  // 3. Clean up VFS
  await db.dropFile(virtualExportPath)

  // 4. Trigger browser download
  const blob = new Blob([buffer], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = downloadFileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
```
