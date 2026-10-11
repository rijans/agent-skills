# Database & Migrations Reference (`tgcloud/schema.js` & `sdk/db`)

Read this reference for **Route 5 (Design or Evolve Database)**, stateful bots/Mini Apps in **Routes 3, 4, 9**, or schema/migration audits in **Route 1**.

Authoritative sources:
- [The Database](https://core.telegram.org/bots/serverless#the-database)
- [Declaring Tables & Column Types](https://core.telegram.org/bots/serverless#declaring-tables)
- [Querying](https://core.telegram.org/bots/serverless#querying)
- [Migrations](https://core.telegram.org/bots/serverless#migrations)
- [CLI `migrate` Reference](https://core.telegram.org/bots/serverless#migrate)

---

## 1. Schema Contract (`tgcloud/schema.js`)

Each bot has a persistent, built-in **SQLite-backed database**. All tables are declared as **named exports** in a single file: `tgcloud/schema.js`.

- **Two-Step Separation**: Editing `tgcloud/schema.js` and running `npx tgcloud push` only uploads the schema module—it **never** modifies the live database. Schema changes take effect only when `npx tgcloud migrate` is executed.
- **No Upstream Drizzle Imports**: Although the DSL resembles Drizzle ORM, import builders **exclusively** from `'sdk/db'`. Do not install or import `drizzle-orm`.

### Column Builders & Encoding Modes (`sdk/db`)

Column names default to the JavaScript property name if omitted, or can be passed explicitly as the 1st argument (recommended for `snake_case` SQL columns mapped to `camelCase` JS properties).

| Builder Factory | SQLite Affinity | Supported Options / Encoding `mode` | JS Runtime Value Type |
| :--- | :--- | :--- | :--- |
| `integer(name?, opts?)` | `INTEGER` | `{ mode: 'number' }` (default)<br>`{ mode: 'boolean' }`<br>`{ mode: 'timestamp' }` (Unix seconds $\leftrightarrow$ `Date`)<br>`{ mode: 'timestamp_ms' }` (Unix ms $\leftrightarrow$ `Date`) | `number`<br>`boolean`<br>`Date`<br>`Date` |
| `text(name?, opts?)` | `TEXT` | `{ mode: 'text' }` (default)<br>`{ mode: 'json' }` (JSON string $\leftrightarrow$ JS value) | `string`<br>`any` (parsed JSON) |
| `real(name?)` / `float(name?)` | `REAL` | — | `number` |
| `numeric(name?)` | `NUMERIC` | — | `number \| string` |
| `blob(name?, opts?)` | `BLOB` | `{ mode: 'bytes' }` (default)<br>`{ mode: 'json' }` | `Uint8Array`<br>`any` |
| `boolean(name?)` | `INTEGER` | Shorthand for `integer(name, { mode: 'boolean' })` | `boolean` |
| `json(name?)` | `TEXT` | Shorthand for `text(name, { mode: 'json' })` | `any` (parsed JSON) |

### Column Modifiers

Chainable on any column builder:
- `.primaryKey()` or `.primaryKey({ autoIncrement: true })` (on `integer`)
- `.notNull()`
- `.unique()`
- `.default(value)` or `.default(sql`(unixepoch())`)`
- `.generatedAlwaysAs(sql`...`, { mode: 'virtual' | 'stored' })`
- `.deprecated()` — Marks a column for safe removal during the next `npx tgcloud migrate` (see **Section 5: Dropping Tables & Columns**).

### Table Extras (Indexes & Constraints) & Table Modifiers

Pass a 3rd argument callback `(t) => ({ ... })` to `table(name, columns, extras?)` to declare indexes and composite constraints:

- `index('idx_name').on(t.col1, t.col2)` (supports `.where(sql`...`)` for partial indexes and SQL expressions for expression indexes)
- `uniqueIndex('uniq_name').on(t.col1, t.col2)`
- ` primaryKey({ columns: [t.col1, t.col2] })` (composite primary key)
- `unique('uq_name').on(t.col1, t.col2)`
- `check('chk_name', sql`${t.amount} >= 0`)`

Chainable table modifiers on `table(...)`:
- `.strict()` — Creates a SQLite `STRICT` table.
- `.withoutRowid()` — Creates a `WITHOUT ROWID` table.
- `.deprecated()` — Marks the entire table to be dropped on the next `npx tgcloud migrate`.

### Complete `tgcloud/schema.js` Example

```js
// tgcloud/schema.js
import {
  table,
  integer,
  text,
  boolean,
  json,
  index,
  uniqueIndex,
  check,
  sql,
} from 'sdk/db';

export const users = table('users', {
  id:        integer('id').primaryKey(), // Telegram user.id
  username:  text('username'),
  isAdmin:   boolean('is_admin').notNull().default(false),
  settings:  json('settings').notNull().default({ notifications: true }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const todos = table(
  'todos',
  {
    id:        integer('id').primaryKey({ autoIncrement: true }),
    userId:    integer('user_id').notNull(), // Ordinary column — NO .references()!
    title:     text('title').notNull(),
    done:      boolean('done').notNull().default(false),
    priority:  integer('priority').notNull().default(1),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  },
  (t) => ({
    byUser:      index('todos_by_user_idx').on(t.userId, t.done),
    uniqTitle:   uniqueIndex('todos_user_title_uq').on(t.userId, t.title),
    validPrio:   check('todos_priority_chk', sql`${t.priority} BETWEEN 1 AND 5`),
  })
);
```

---

## 2. The "No Foreign Keys" Contract

Telegram Serverless **does not support foreign keys**:
- Calling `.references(() => ...)` on a column or `foreignKey(...)` at the table level **throws an error**.
- Writing raw `REFERENCES` clauses in SQL does not enable foreign-key enforcement or `ON DELETE CASCADE`.

### Mandatory Application-Level Rules

1. **Declare foreign IDs as ordinary indexed columns** (e.g., `userId: integer('user_id').notNull()` with an `index()`).
2. **Enforce ownership on every read, update, and delete**:
   ```js
   // Always include the owner predicate alongside the record ID
   await db.delete(todos)
     .where(and(eq(todos.id, todoId), eq(todos.userId, callerUserId)))
     .run();
   ```
3. **Order parent/child writes explicitly**:
   - Insert the parent row before inserting child rows.
   - Delete child rows before deleting the parent row (and write defensive queries that tolerate orphaned records if a previous multi-step operation failed mid-way).
   - Do not claim ACID multi-statement transaction rollback unless verified in the current runtime SDK.

---

## 3. Query Builder & Operators (`db` from `sdk`, operators from `sdk/db`)

Import `db` from `'sdk'` and query operators from `'sdk/db'`.
**Every query terminal is `async` and MUST be `await`ed.**

### Query Terminals Cheat Sheet

| Operation | Builder Start | Supported Clauses | Async Terminal(s) | Return Value |
| :--- | :--- | :--- | :--- | :--- |
| **Select** | `db.select(proj?).from(table)` | `.where()`, `.orderBy()`, `.limit()`, `.offset()`, `.groupBy()`, `.having()`, `.distinct()`, joins | `.all()`<br>`.get()`<br>`.values()` | `Array<Row>`<br>`Row \| null` (first row)<br>`Array<Array<Value>>` |
| **Count** | `db.$count(table, where?)` | Optional `where` filter expression | *(Directly awaited)* | `number` |
| **Insert** | `db.insert(table).values(rowOrRows)` | `.onConflictDoNothing()`, `.onConflictDoUpdate({ target, set, where? })`, `.returning(proj?)` | `.run()` | Run result (or `Array<Row>` when `.returning()` is used) |
| **Update** | `db.update(table).set(changes)` | `.where()`, `.returning(proj?)` | `.run()` | Run result (or `Array<Row>` when `.returning()` is used) |
| **Delete** | `db.delete(table)` | `.where()`, `.returning(proj?)` | `.run()` | Run result (or `Array<Row>` when `.returning()` is used) |

### Operators Cheat Sheet (`import { ... } from 'sdk/db'`)

- **Comparison**: `eq(col, val)`, `ne(col, val)`, `gt(col, val)`, `gte(col, val)`, `lt(col, val)`, `lte(col, val)` (2nd argument can be a value, another column, or a `sql` expression).
- **Logical**: `and(...conds)`, `or(...conds)`, `not(cond)`.
- **Null checks**: `isNull(col)`, `isNotNull(col)`.
- **Collections & Ranges**: `inArray(col, array)`, `notInArray(col, array)`, `between(col, min, max)`, `notBetween(col, min, max)`.
  - *Guard*: Ensure `array` passed to `inArray` is non-empty before running the query!
- **Pattern matching**: `like(col, pattern)`, `ilike(col, pattern)`, `notLike(col, pattern)`.
- **Ordering**: `asc(col)`, `desc(col)`.
- **Aggregates & SQL**: `count(col?)`, `sum(col)`, `avg(col)`, `min(col)`, `max(col)`, `sql`...``.

### Atomic Upserts & Counter Updates (Preventing Race Conditions)

Never implement counters or balances with a `SELECT` followed by an `UPDATE`—concurrent updates from the same user or group will race. Use `.onConflictDoUpdate()` and `sql` expressions with `.returning()`:

```js
import { db } from 'sdk';
import { eq, sql } from 'sdk/db';
import { counters } from '../schema.js';

export async function incrementChatCounter(chatId) {
  const [row] = await db.insert(counters)
    .values({ chatId, seen: 1 })
    .onConflictDoUpdate({
      target: counters.chatId,
      set: { seen: sql`${counters.seen} + 1` },
    })
    .returning()
    .run();

  return row.seen;
}
```

### Batch Inserts & SQLite Parameter Limits

SQLite enforces a limit on bound parameters per statement (typically 999 or 32766 depending on compile options). When inserting dynamic arrays of rows, **chunk** the array rather than passing an unbounded list to `.values(rows)`:

```js
export async function insertInChunks(tableRef, rows, columnsPerRow = 4) {
  const maxRowsPerBatch = Math.floor(900 / columnsPerRow);
  for (let i = 0; i < rows.length; i += maxRowsPerBatch) {
    const chunk = rows.slice(i, i + maxRowsPerBatch);
    await db.insert(tableRef).values(chunk).run();
  }
}
```

---

## 4. Raw SQL Queries (`db.run`, `db.all`, `db.get`, `db.values`)

When you need a query outside the builder (such as CTEs or window functions), use raw methods with the `sql` tagged template:

```js
import { db } from 'sdk';
import { sql } from 'sdk/db';
import { todos } from '../schema.js';

const row = await db.get(
  sql`SELECT id, title FROM ${todos} WHERE user_id = ${userId} AND done = 0 LIMIT 1`
);
```

- **Important Caveat**: Raw queries (`db.all`, `db.get`, `db.values`) return raw SQLite values—they **do not** run the table builder's automatic `mode` conversions (so booleans come back as `0`/`1`, timestamps as numbers, and JSON as raw strings).
- If a raw `SELECT` joins tables with duplicate column names, use explicit `AS` aliases or `db.values()` (positional arrays) so keys do not overwrite each other.
- **SQL Injection Rule**: Always interpolate dynamic values inside `sql`...`` so they are bound as parameters. Never concatenate user input into `sql.raw()`.

---

## 5. Schema Migrations & Lifecycle (`npx tgcloud migrate`)

### Change Classifications

When `npx tgcloud migrate` compares your schema against the live cloud database, each detected change falls into one of four categories:

| Classification | Examples | How `tgcloud migrate` Treats It |
| :--- | :--- | :--- |
| **`safe`** | Creating a new table, adding a nullable/defaulted column, adding a non-unique index | Additive; applied on confirmation (or automatically with `--safe` / `--yes`). |
| **`warning`** | Dropping a `.deprecated()` table/column, adding a `UNIQUE` index that could fail on duplicates, table rebuilds | Potential data loss or table lock; prompts for confirmation (applied without prompting only if `--yes` is passed). |
| **`manual`** | Changing a column's type, adding a `NOT NULL` column without a default to a populated table | **Cannot be auto-applied.** Requires a multi-step migration plan. |
| **`undocumented`** | A table or column exists in the live database but is missing from `schema.js` (without `.deprecated()`) | Reported as a drift notice; **nothing is dropped**. |

### CLI Flags for `npx tgcloud migrate`

| Flag | Effect | Safety Rule |
| :--- | :--- | :--- |
| *(no flags)* | Interactive mode: compares deployed `schema.js` against live DB and prompts before applying | Requires an interactive TTY. |
| `--dry-run` | Previews all pending `safe`, `warning`, `manual`, and `undocumented` changes and exits | Read-only against the live DB; applies nothing. Cannot combine with `--safe` or `--yes`. |
| `--local` | Compares your **local** `tgcloud/schema.js` against the **live cloud database** | Without `--dry-run`, `migrate --local` **mutates the live database**! Use `migrate --local --dry-run` for previews before pushing. |
| `--safe` | Applies only `safe` additive changes non-interactively; skips `warning` and `manual` items | Write operation. Check output summary—exit code `0` does **not** mean warnings/manual steps were applied! |
| `--yes` | Applies **both `safe` and `warning` changes** (including destructive `.deprecated()` drops!) without prompting | **Dangerous.** Never use `--yes` just to bypass a non-interactive terminal prompt unless the user explicitly reviewed and authorized the exact warning operations. |

### Zero-Downtime Sequencing for Live Bots

1. **Adding a table or column**:
   - Step 1: Edit `tgcloud/schema.js` and push **only** the schema (`npx tgcloud push schema`).
   - Step 2: Preview (`npx tgcloud migrate --dry-run`) and apply the migration (`npx tgcloud migrate --safe`).
   - Step 3: Push the updated handlers/endpoints (`npx tgcloud push`) that read/write the new table or column.
2. **Dropping a table or column (Two-Phase `.deprecated()` Flow)**:
   - Simply deleting a column or table from `tgcloud/schema.js` **does not drop it**—it only triggers an `undocumented` notice.
   - Step 1: Stop reading/writing the column/table in all deployed handlers and endpoints (`npx tgcloud push`).
   - Step 2: Mark the column or table with `.deprecated()` in `tgcloud/schema.js` and push `schema.js`.
   - Step 3: Run `npx tgcloud migrate --dry-run`, obtain explicit user authorization for the destructive drop (`warning`), and run `npx tgcloud migrate`.
   - Step 4: Only after verifying the column/table was dropped in the cloud, remove the `.deprecated()` declaration from `tgcloud/schema.js` and push.
3. **Changing a Column's Type (`manual`)**:
   - Never assume SQLite will coerce existing values in place.
   - Use an expand-backfill-contract sequence:
     1. Add a new column with the target type (`col_v2`), push `schema.js`, and migrate (`safe`).
     2. Backfill/convert data from `col` to `col_v2` via a script/handler and update code to use `col_v2`.
     3. Deprecate and drop the old `col` using `.deprecated()`.
