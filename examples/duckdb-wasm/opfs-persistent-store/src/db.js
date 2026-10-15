import * as duckdb from '@duckdb/duckdb-wasm'

import ehWorkerUrl from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'
import duckdbWasmEhUrl from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import mvpWorkerUrl from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'
import duckdbWasmMvpUrl from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'

const MANUAL_BUNDLES = {
  mvp: {
    mainModule: duckdbWasmMvpUrl,
    mainWorker: mvpWorkerUrl,
  },
  eh: {
    mainModule: duckdbWasmEhUrl,
    mainWorker: ehWorkerUrl,
  },
}

let dbInstance = null
let connection = null

export async function initOpfsDB(dbName = 'analytics.duckdb') {
  if (dbInstance && connection) return { db: dbInstance, conn: connection }

  console.log('Selecting DuckDB-Wasm bundle for OPFS...')
  const bundle = await duckdb.selectBundle(MANUAL_BUNDLES)

  const worker = new Worker(bundle.mainWorker)
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING)
  dbInstance = new duckdb.AsyncDuckDB(logger, worker)

  await dbInstance.instantiate(bundle.mainModule, bundle.pthreadWorker)

  // Open database inside Origin Private File System
  console.log(`Opening OPFS database: opfs://${dbName}`)
  await dbInstance.open({
    path: `opfs://${dbName}`,
    accessMode: duckdb.DuckDBAccessMode.READ_WRITE,
  })

  connection = await dbInstance.connect()

  // Initialize schema
  await connection.query(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY,
      action VARCHAR,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      details VARCHAR
    );
    CREATE SEQUENCE IF NOT EXISTS seq_activity_id START 1;
  `)

  return { db: dbInstance, conn: connection }
}

export async function insertLog(action, details) {
  const { conn } = await initOpfsDB()

  // 1. Insert record
  const stmt = await conn.prepare(`
    INSERT INTO activity_log (id, action, details)
    VALUES (nextval('seq_activity_id'), ?, ?);
  `)
  await stmt.query(action, details)
  await stmt.close()

  // 2. Commit WAL to OPFS disk
  await conn.query('CHECKPOINT;')
  console.log('Record inserted and CHECKPOINT committed to OPFS.')
}

export async function getLogs() {
  const { conn } = await initOpfsDB()
  const result = await conn.query(`
    SELECT id, action, timestamp, details
    FROM activity_log
    ORDER BY id DESC
    LIMIT 50;
  `)
  return result
}

export async function clearLogs() {
  const { conn } = await initOpfsDB()
  await conn.query('DELETE FROM activity_log;')
  await conn.query('CHECKPOINT;')
}
