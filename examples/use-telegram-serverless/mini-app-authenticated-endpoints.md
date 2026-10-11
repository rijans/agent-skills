# Mini App Authenticated Endpoints & Static Hosting Example

## Brief

Create an authenticated Mini App endpoint `tgcloud/endpoints/deleteNote.js` that deletes a user's note only if they own it, wire it up to a frontend Promise helper using `Telegram.WebApp.Serverless.call`, and configure `tgcloud.jsonc` for a Vite SPA build.

## Solution

### 1. Backend Endpoint (`tgcloud/endpoints/deleteNote.js`)

```js
import { db, EndpointError } from 'sdk';
import { and, eq } from 'sdk/db';
import { notes } from '../schema.js';

export default async function (input, ctx) {
  const callerId = ctx.initData?.user?.id;
  if (!callerId) {
    throw new EndpointError('Open this Mini App inside Telegram.', { code: 'UNAUTHORIZED' });
  }

  const noteId = input?.noteId;
  if (!Number.isSafeInteger(noteId) || noteId <= 0) {
    throw new EndpointError('Please select a valid note.', { code: 'INVALID_INPUT' });
  }

  // Constrain delete by BOTH noteId AND verified callerId (prevents IDOR)
  const [deleted] = await db.delete(notes)
    .where(and(eq(notes.id, noteId), eq(notes.ownerId, callerId)))
    .returning({ id: notes.id })
    .run();

  if (!deleted) {
    throw new EndpointError('Note not found or already deleted.', { code: 'NOT_FOUND' });
  }

  return { deletedId: deleted.id };
}
```

### 2. Frontend RPC Wrapper (`src/lib/serverless.js`)

```js
export function callServerless(endpointName, payload = {}) {
  return new Promise((resolve, reject) => {
    const webApp = window.Telegram?.WebApp;
    const serverless = webApp?.Serverless;

    // Guard against browser launches outside Telegram where initData is empty
    if (
      typeof serverless?.call !== 'function' ||
      typeof webApp?.initData !== 'string' ||
      webApp.initData.length === 0
    ) {
      reject({
        type: 'NOT_IN_TELEGRAM',
        message: 'Launch this app from Telegram to manage your notes.',
      });
      return;
    }

    try {
      serverless.call(endpointName, payload, (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      });
    } catch (syncError) {
      reject({
        type: 'CLIENT_ERROR',
        message: syncError?.message || 'Failed to invoke Serverless endpoint.',
      });
    }
  });
}
```

### 3. Static Hosting Config (`tgcloud.jsonc`)

```jsonc
{
  "$schema": "./node_modules/@tgcloud/cli/schema/tgcloud.json",
  "static": {
    "source": "dist",
    "spa": true,
    "immutable": ["/assets/*"]
  }
}
```

### 4. Build, Test & Deploy

```bash
# Test endpoint logic in cloud sandbox with synthetic context
npx tgcloud run endpoints/deleteNote '{ noteId: 1 }' \
  --ctx '{ initData: { user: { id: 12345 } } }'

# Build frontend assets first, then push modules + static build
npm run build
npx tgcloud push
```

## Key Contract Highlights

- Derives identity strictly from `ctx.initData.user.id`, ignoring any client-supplied user ID.
- Uses `EndpointError` for public validation/not-found errors while keeping unexpected server exceptions opaque.
- Prevents the synchronous `Serverless.call` exception when opened outside Telegram by checking `webApp.initData.length > 0`.
- Marks only `/assets/*` as `immutable` so `/index.html` is never stuck in browser cache after a deploy.
