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

export async function initDuckDB() {
  if (dbInstance) return { db: dbInstance, conn: connection }

  console.log('Selecting optimal DuckDB-Wasm bundle...')
  const bundle = await duckdb.selectBundle(MANUAL_BUNDLES)

  if (!bundle.mainWorker) {
    throw new Error('Failed to resolve a valid DuckDB worker bundle.')
  }

  const worker = new Worker(bundle.mainWorker)
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING)
  dbInstance = new duckdb.AsyncDuckDB(logger, worker)

  console.log('Instantiating WebAssembly binary...')
  await dbInstance.instantiate(bundle.mainModule, bundle.pthreadWorker)

  connection = await dbInstance.connect()
  console.log('DuckDB-Wasm initialized and connected.')

  return { db: dbInstance, conn: connection }
}

export async function registerParquetFile(file, virtualName = 'uploaded_data.parquet') {
  const { db } = await initDuckDB()

  console.log(`Registering file "${file.name}" as virtual table "${virtualName}"...`)
  await db.registerFileHandle(
    virtualName,
    file,
    duckdb.DuckDBDataProtocol.BROWSER_FILEREADER,
    true
  )

  return virtualName
}

export async function executeQuery(sql) {
  const { conn } = await initDuckDB()
  const start = performance.now()
  const result = await conn.query(sql)
  const durationMs = Math.round(performance.now() - start)

  return { result, durationMs }
}
