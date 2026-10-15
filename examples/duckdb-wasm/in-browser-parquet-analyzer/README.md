# In-Browser Parquet Analyzer with DuckDB-Wasm

Interactive, client-side Parquet file analyzer powered by [`@duckdb/duckdb-wasm`](https://www.npmjs.com/package/@duckdb/duckdb-wasm) and Vite.

## Features

- **Zero-Server Ingestion**: Queries multi-megabyte Parquet files directly in the browser using `db.registerFileHandle` without uploading data to any backend.
- **Vite `?url` Bundler Configuration**: Demonstrates proper WASM and Worker asset loading without bundler parse errors.
- **Apache Arrow Columnar Rendering**: Efficient zero-copy vector slicing preventing JavaScript heap exhaustion.

## Running Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start Vite development server**:
   ```bash
   npm run dev
   ```

3. Open `http://localhost:3000` in a modern browser, drag and drop any `.parquet` file, and run SQL queries against it.
