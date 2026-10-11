# Telegram Stars Payment Flow Example

## Brief

Implement a Telegram Stars (`XTR`) payment flow on Telegram Serverless where `/buy` sends a 25-Star invoice, `handlers/pre_checkout_query.js` validates and approves the checkout, and `handlers/message.js` fulfills the purchase idempotently using SQLite.

## Solution

### 1. Payment Ledger Schema (`tgcloud/schema.js`)

```js
import { table, integer, text, sql } from 'sdk/db';

export const purchases = table('purchases', {
  chargeId:  text('charge_id').primaryKey(), // telegram_payment_charge_id
  userId:    integer('user_id').notNull(),
  itemSku:   text('item_sku').notNull(),
  starsPaid: integer('stars_paid').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const credits = table('credits', {
  userId:  integer('user_id').primaryKey(),
  balance: integer('balance').notNull().default(0),
});
```

### 2. Pre-Checkout Handler (`tgcloud/handlers/pre_checkout_query.js`)

```js
import { api } from 'sdk';

export default async function (query) {
  const valid =
    query.currency === 'XTR' &&
    query.total_amount === 25 &&
    query.invoice_payload === 'sku:credits_50';

  await api.answerPreCheckoutQuery({
    pre_checkout_query_id: query.id,
    ok: valid,
    error_message: valid ? undefined : 'Invalid or expired offer. Please send /buy again.',
  });
}
```

### 3. Invoice & Idempotent Fulfillment (`tgcloud/handlers/message.js`)

```js
import { api, db } from 'sdk';
import { sql } from 'sdk/db';
import { purchases, credits } from '../schema.js';

export default async function (message) {
  if (!message.from) return;
  const chatId = message.chat.id;
  const userId = message.from.id;

  // 1. Handle completed Telegram Stars payment
  if (message.successful_payment) {
    const payment = message.successful_payment;

    // Claim the chargeId atomically so duplicate updates never double-credit
    const [claimed] = await db.insert(purchases)
      .values({
        chargeId: payment.telegram_payment_charge_id,
        userId,
        itemSku: payment.invoice_payload,
        starsPaid: payment.total_amount,
      })
      .onConflictDoNothing()
      .returning()
      .run();

    if (claimed) {
      const [wallet] = await db.insert(credits)
        .values({ userId, balance: 50 })
        .onConflictDoUpdate({
          target: credits.userId,
          set: { balance: sql`${credits.balance} + 50` },
        })
        .returning()
        .run();

      await api.sendMessage({
        chat_id: chatId,
        text: `Payment confirmed! 50 credits added. Your balance is now ${wallet.balance}.`,
      });
    }
    return;
  }

  // 2. Send Telegram Stars invoice on /buy
  if (message.text === '/buy') {
    await api.sendInvoice({
      chat_id: chatId,
      title: '50 AI Credits',
      description: 'Top up your account with 50 credits.',
      payload: 'sku:credits_50',
      currency: 'XTR',
      prices: [{ label: '50 Credits', amount: 25 }],
    });
  }
}
```

### 4. Mini App In-App Stars Checkout (`tgcloud/endpoints/createStarsInvoice.js` + Frontend)

When selling the same item inside a Telegram Mini App, generate an invoice link via `api.createInvoiceLink` and open the native payment sheet with `Telegram.WebApp.openInvoice`:

```js
// tgcloud/endpoints/createStarsInvoice.js
import { api, EndpointError } from 'sdk';

export default async function (input, ctx) {
  const userId = ctx.initData?.user?.id;
  if (!userId) {
    throw new EndpointError('Open this app inside Telegram to purchase.', { code: 'UNAUTHORIZED' });
  }

  const invoiceUrl = await api.createInvoiceLink({
    title: '50 AI Credits',
    description: 'Top up your account with 50 credits.',
    payload: 'sku:credits_50',
    currency: 'XTR',
    prices: [{ label: '50 Credits', amount: 25 }],
  });

  return { invoiceUrl };
}
```

```js
// Frontend Mini App handler
const { invoiceUrl } = await callServerless('createStarsInvoice', {});
window.Telegram.WebApp.openInvoice(invoiceUrl, (status) => {
  if (status === 'paid') {
    // Payment succeeded; pre_checkout_query and message.successful_payment run on the backend!
  }
});
```

## Key Contract Highlights

- Uses `telegram_payment_charge_id` as the primary key in `purchases` with `.onConflictDoNothing().returning()` so retried updates cannot credit a user twice.
- Uses an atomic `.onConflictDoUpdate()` increment on `credits.balance`.
- Supports both chat `/buy` (`api.sendInvoice`) and Mini App native checkout (`api.createInvoiceLink` + `Telegram.WebApp.openInvoice`) sharing the exact same `pre_checkout_query` and `successful_payment` fulfillment pipeline.

