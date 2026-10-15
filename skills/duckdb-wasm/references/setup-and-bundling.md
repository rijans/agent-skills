# Setup, Bundling & Web Worker Initialization

This guide covers initializing `AsyncDuckDB`, configuring Web Workers and WebAssembly assets across bundlers (Vite, Next.js, Webpack), choosing bundle variants (`mvp`, `eh`, `coi`), and configuring Cross-Origin Isolation headers.

---

## 1. Bundle Variants & Selection

DuckDB-Wasm ships three binary bundle variants:

| Variant | Target Features | Cross-Origin Isolation Required? | Best Used For |
| :--- | :--- | :---: | :--- |
| **`eh`** | WebAssembly Exception Handling (Single-threaded) | **No** | **Recommended Default**. Fast, works across all modern browsers without special headers. |
| **`mvp`** | Baseline WebAssembly (Fallback) | **No** | Legacy or restricted browser environments lacking exception handling. |
| **`coi`** | Multi-threaded with `SharedArrayBuffer` & `pthreadWorker` | **Yes** (`COOP` + `COEP`) | Heavy analytical datasets requiring multi-core parallelism. |

---

## 2. Vite Bundling with Local Assets (`?url`)

In Vite, use the `?url` suffix so the bundler treats worker scripts and `.wasm` binaries as static asset URLs rather than parsing them as ES modules:

```typescript
import * as duckdb from '@duckdb/duckdb-wasm'

// Single-threaded EH bundle (Recommended)
import ehWorkerUrl from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'
import duckdbWasmEhUrl from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'

// Fallback MVP bundle
import mvpWorkerUrl from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'
import duckdbWasmMvpUrl from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: duckdbWasmMvpUrl,
    mainWorker: mvpWorkerUrl,
  },
  eh: {
    mainModule: duckdbWasmEhUrl,
    mainWorker: ehWorkerUrl,
  },
}

export async function createDuckDB(): Promise<duckdb.AsyncDuckDB> {
  // 1. Select the best bundle for the current browser
  const bundle = await duckdb.selectBundle(MANUAL_BUNDLES)

  if (!bundle.mainWorker) {
    throw new Error('Failed to select a compatible DuckDB-Wasm bundle.')
  }

  // 2. Instantiate the worker
  const worker = new Worker(bundle.mainWorker)
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING)
  const db = new duckdb.AsyncDuckDB(logger, worker)

  // 3. Instantiate the WASM binary
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker)

  return db
}
```

---

## 3. Zero-Config CDN Loading (`getJsDelivrBundles`)

When you do not want to configure bundler asset pipelines, fetch pre-hosted binaries directly from jsDelivr:

```typescript
import * as duckdb from '@duckdb/duckdb-wasm'

export async function createDuckDBFromCDN(): Promise<duckdb.AsyncDuckDB> {
  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles()
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES)

  const worker = await duckdb.createWorker(bundle.mainWorker!)
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING)
  const db = new duckdb.AsyncDuckDB(logger, worker)

  await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
  return db
}
```

> **Note**: CDN loading requires active internet connectivity and a Content Security Policy (CSP) allowing `https://cdn.jsdelivr.net`.

---

## 4. Multi-Threading & Cross-Origin Isolation (COOP / COEP)

To run multi-threaded DuckDB-Wasm (`pthreadWorker`), browsers require Cross-Origin Isolation to enable `SharedArrayBuffer`.

### Vite Configuration (`vite.config.ts`)

```typescript
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
```

### Checking for Cross-Origin Isolation at Runtime

```typescript
export function isCrossOriginIsolated(): boolean {
  return typeof window !== 'undefined' && window.crossOriginIsolated === true
}
```

If `window.crossOriginIsolated` is `false`, omit `pthreadWorker` and use the single-threaded `eh` bundle to avoid runtime crashes.

---

## 5. Next.js App Router Integration

Because DuckDB-Wasm relies on browser `Worker` and `window`, isolate it from server-side rendering (SSR):

```typescript
// components/DuckDBClient.tsx
'use client'

import { useEffect, useState } from 'react'
import type { AsyncDuckDB } from '@duckdb/duckdb-wasm'

export default function DuckDBClient() {
  const [db, setDb] = useState<AsyncDuckDB | null>(null)

  useEffect(() => {
    let active = true

    async function init() {
      const { createDuckDBFromCDN } = await import('@/lib/duckdb')
      const instance = await createDuckDBFromCDN()
      if (active) setDb(instance)
    }

    init().catch(console.error)

    return () => {
      active = false
      if (db) db.terminate()
    }
  }, [])

  return <div>{db ? 'DuckDB Ready' : 'Loading DuckDB...'}</div>
}
```
