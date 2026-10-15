# In-Browser OPFS Persistent Store with DuckDB-Wasm

Demonstrates persistent analytical database storage in the browser using [`@duckdb/duckdb-wasm`](https://www.npmjs.com/package/@duckdb/duckdb-wasm) and the Origin Private File System (`opfs://`).

## Why This Matters

Standard WebAssembly databases run purely in ephemeral memory and lose all data when the page is closed or refreshed. By prefixing the database path with `opfs://` and executing `CHECKPOINT;`, DuckDB-Wasm writes directly to the browser's private disk sandbox, surviving page refreshes and browser restarts with zero server storage.

## Running Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start Vite development server**:
   ```bash
   npm run dev
   ```

3. Open `http://localhost:3001` in your browser. Add logs, refresh the page, and observe that all data persists across reloads.
