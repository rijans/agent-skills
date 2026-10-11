# Stateful Bot & Zero-Downtime Migration Example

## Brief

Build a Telegram Serverless habit-tracker bot where users can add habits with `/add <name>`, check them off via inline keyboard buttons, and view their streak with `/list`. Sequence the deployment and migration safely for an existing live bot.

## Solution

### 1. Database Schema (`tgcloud/schema.js`)

```js
import { table, integer, text, index, uniqueIndex, sql } from 'sdk/db';

export const habits = table(
  'habits',
  {
    id:        integer('id').primaryKey({ autoIncrement: true }),
    userId:    integer('user_id').notNull(), // Ordinary column — no .references()
    name:      text('name').notNull(),
    streak:    integer('streak').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  },
  (t) => ({
    byUser:   index('habits_by_user_idx').on(t.userId),
    uniqName: uniqueIndex('habits_user_name_uq').on(t.userId, t.name),
  })
);
```

### 2. Message Handler (`tgcloud/handlers/message.js`)

```js
import { api, db } from 'sdk';
import { eq, asc } from 'sdk/db';
import { habits } from '../schema.js';

export default async function (message) {
  if (typeof message.text !== 'string' || !message.from) return;

  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text.trim();

  if (text.startsWith('/add ')) {
    const name = text.slice(5).trim();
    if (!name || name.length > 60) {
      await api.sendMessage({ chat_id: chatId, text: 'Provide a habit name (1–60 chars).' });
      return;
    }

    await db.insert(habits)
      .values({ userId, name })
      .onConflictDoNothing()
      .run();

    await api.sendMessage({ chat_id: chatId, text: `Added habit: "${name}". Send /list to check in.` });
    return;
  }

  if (text === '/list' || text === '/start') {
    const rows = await db.select()
      .from(habits)
      .where(eq(habits.userId, userId))
      .orderBy(asc(habits.id))
      .all();

    if (rows.length === 0) {
      await api.sendMessage({
        chat_id: chatId,
        text: 'No habits yet. Add one with /add Morning Walk',
      });
      return;
    }

    const keyboard = rows.map((h) => [
      { text: `✅ ${h.name} (${h.streak})`, callback_data: `chk:${h.id}` },
    ]);

    await api.sendMessage({
      chat_id: chatId,
      text: 'Tap a habit to increment your streak:',
      reply_markup: { inline_keyboard: keyboard },
    });
  }
}
```

### 3. Callback Query Handler (`tgcloud/handlers/callback_query.js`)

```js
import { api, db } from 'sdk';
import { and, eq, sql } from 'sdk/db';
import { habits } from '../schema.js';

export default async function (query) {
  let toast = undefined;

  try {
    if (typeof query.data === 'string' && query.data.startsWith('chk:')) {
      const habitId = Number(query.data.slice(4));
      if (Number.isSafeInteger(habitId) && habitId > 0) {
        const [updated] = await db.update(habits)
          .set({ streak: sql`${habits.streak} + 1` })
          .where(and(eq(habits.id, habitId), eq(habits.userId, query.from.id)))
          .returning()
          .run();

        toast = updated ? `${updated.name}: ${updated.streak} day streak!` : 'Habit not found.';
      }
    }
  } finally {
    await api.answerCallbackQuery({
      callback_query_id: query.id,
      text: toast,
    });
  }
}
```

### 4. Safe Zero-Downtime Deployment Sequence

```bash
# 1.Offline syntax check
node --check tgcloud/schema.js
node --check tgcloud/handlers/message.js
node --check tgcloud/handlers/callback_query.js

# 2. Push schema first so live handlers never query a missing table
npx tgcloud push schema

# 3. Preview and apply the additive migration
npx tgcloud migrate --dry-run
npx tgcloud migrate --safe

# 4. Push the handlers and verify webhook allowed_updates
npx tgcloud push handlers/message handlers/callback_query
npx tgcloud webhook
```

## Key Contract Highlights

- Enforces ownership (`eq(habits.userId, query.from.id)`) without using unsupported `.references()`.
- Uses an atomic SQL expression (`sql`${habits.streak} + 1``) instead of a read-then-write race.
- Sequences `push schema` $\rightarrow$ `migrate --safe` $\rightarrow$ `push handlers` to prevent downtime.
