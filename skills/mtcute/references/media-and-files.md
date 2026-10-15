# Media & Large File Streaming (Up to 2GB / 4GB)

This guide covers streaming large files, media uploads, downloads, progress tracking, and memory-safe pipeline transfers using `mtcute`.

---

## 1. Telegram File Size Limits

- **Standard Accounts & Bots**: Up to **2,000 MB (2 GB)** per file.
- **Telegram Premium Accounts**: Up to **4,000 MB (4 GB)** per file when authenticated via MTProto userbot.

---

## 2. Memory Safety: Streaming vs Buffering

| Method | Memory Usage | Best Used For |
| :--- | :--- | :--- |
| `tg.downloadToFile(path, media)` | Minimal (~few MB) | Direct file backup / disk archiving |
| `tg.downloadAsStream(media)` | Minimal (~streaming chunk buffer) | Piping to cloud storage (S3/R2) or encryption streams |
| `tg.downloadToNodeStream(media)`| Minimal | Node `fs.createWriteStream` or HTTP responses |
| `tg.downloadBuffer(media)` | **High (Full file size in RAM)** | Small avatars, thumbnails (<10 MB only) |

> **Hazard**: Never call `tg.downloadBuffer()` on user-uploaded videos or zip archives; doing so will crash the Node isolate with an Out-Of-Memory (OOM) error.

---

## 3. Downloading Large Files via Streams

### Direct to Disk with Progress Tracking

```typescript
import { TelegramClient } from '@mtcute/node'

export async function downloadChannelVideo(
  tg: TelegramClient,
  media: any,
  destinationPath: string
) {
  console.log(`Starting download to: ${destinationPath}`)

  await tg.downloadToFile(destinationPath, media, {
    progressCallback: (downloaded: number, total: number) => {
      const percent = ((downloaded / total) * 100).toFixed(1)
      const mbDownloaded = (downloaded / (1024 * 1024)).toFixed(1)
      const mbTotal = (total / (1024 * 1024)).toFixed(1)
      process.stdout.write(`\rDownloading: ${percent}% (${mbDownloaded}MB / ${mbTotal}MB)`)
    },
  })

  console.log('\nDownload complete!')
}
```

### Piping `downloadAsStream` to Cloud Storage / Custom Streams

```typescript
import { pipeline } from 'node:stream/promises'
import fs from 'node:fs'
import { Readable } from 'node:stream'

// Converting web ReadableStream to Node stream pipeline
const webStream = tg.downloadAsStream(media)
const nodeReadable = Readable.fromWeb(webStream as any)
const fileSink = fs.createWriteStream('./archive/dataset.parquet')

await pipeline(nodeReadable, fileSink)
```

---

## 4. Uploading Large Files

### Uploading from Local File Path

Upload files directly by referencing the file path. `mtcute` automatically slices the file into optimal MTProto multipart chunks:

```typescript
// Send document with progress bar
await tg.sendDocument(chatId, 'file:./backups/database-2026.dump.gz', {
  caption: 'Automated nightly database backup',
  progressCallback: (uploaded, total) => {
    const percent = Math.round((uploaded / total) * 100)
    console.log(`Upload progress: ${percent}%`)
  },
})
```

### Pre-uploading with `tg.uploadFile`

If you need the `InputFile` handle before constructing a message or for raw TL calls:

```typescript
const uploadedHandle = await tg.uploadFile({
  file: 'file:/path/to/archive.tar.zst',
  progressCallback: (uploaded, total) => {
    console.log(`Uploaded ${uploaded} / ${total} bytes`)
  },
})

// Use handle in sendMedia
await tg.sendMedia(chatId, {
  type: 'document',
  file: uploadedHandle,
  fileName: 'archive.tar.zst',
})
```

---

## 5. Sending Media Groups (Albums)

Send up to 10 photos or documents in a single grouped album:

```typescript
await tg.sendMediaGroup(chatId, [
  {
    type: 'photo',
    file: 'file:./screenshots/step1.png',
    caption: 'Step 1: System Boot',
  },
  {
    type: 'photo',
    file: 'file:./screenshots/step2.png',
  },
  {
    type: 'document',
    file: 'file:./logs/audit.log',
  },
])
```
