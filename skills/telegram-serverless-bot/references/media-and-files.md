# Media, Photos, and Binary File Handling

This reference explains how to receive, download, and send photos, documents, and binary assets within Telegram Serverless isolates.

---

## 1. Receiving Incoming Media (`file_id`)

When a user sends a photo, document, or audio file, Telegram provides metadata and a unique `file_id`:

```javascript
export function inspectIncomingMedia(msg) {
  if (msg.photo && msg.photo.length > 0) {
    // Photos come in multiple sizes. The last element is the highest resolution.
    const highestResPhoto = msg.photo[msg.photo.length - 1];
    return {
      type: "photo",
      fileId: highestResPhoto.file_id,
      fileSize: highestResPhoto.file_size,
      width: highestResPhoto.width,
      height: highestResPhoto.height
    };
  }

  if (msg.document) {
    return {
      type: "document",
      fileId: msg.document.file_id,
      fileName: msg.document.file_name,
      mimeType: msg.document.mime_type,
      fileSize: msg.document.file_size
    };
  }

  return null;
}
```

---

## 2. Downloading Files from Telegram CDN

To inspect or process an incoming file:

```javascript
import api from "sdk/api";
import fetch from "sdk/fetch";

export async function downloadTelegramFile(fileId) {
  // 1. Get file path from Telegram Bot API
  const fileInfo = await api.getFile(fileId);
  if (!fileInfo || !fileInfo.file_path) {
    throw new Error("Unable to retrieve file path from Telegram");
  }

  // 2. Build official Telegram CDN URL
  // Note: Telegram CDN URLs follow: https://api.telegram.org/file/bot<token>/<file_path>
  const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${fileInfo.file_path}`;

  // 3. Fetch binary stream using sdk/fetch
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }

  // 4. Return as Uint8Array binary buffer
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
```

---

## 3. Uploading Binary Files & Images

Telegram Serverless supports sending media using:
1. An existing `file_id` (instant, no bandwidth)
2. A publicly accessible HTTP URL
3. In-memory binary data (`Uint8Array`) using `InputFile`

### Uploading In-Memory Binary Data

```javascript
import api from "sdk/api";
import { InputFile } from "sdk/api"; // Provided by Telegram Serverless runtime

export async function sendGeneratedImage(chatId, uint8Buffer, filename = "image.png") {
  // Wrap binary buffer with InputFile
  const file = new InputFile(uint8Buffer, filename);

  return api.sendPhoto(chatId, file, {
    caption: "🎨 Here is your generated image!"
  });
}

export async function sendReportDocument(chatId, csvString, filename = "report.csv") {
  const encoder = new TextEncoder();
  const file = new InputFile(encoder.encode(csvString), filename);

  return api.sendDocument(chatId, file, {
    caption: "📊 Generated CSV Report"
  });
}
```

---

## 4. Sending Media by URL or Re-Using `file_id`

Re-using an existing `file_id` is the fastest method with zero serverless bandwidth overhead:

```javascript
import api from "sdk/api";

// Re-using cached file_id (Fastest)
await api.sendPhoto(chatId, "AgACAgIAAxkDAAICAm...", { caption: "Cached image" });

// Sending by public URL
await api.sendPhoto(chatId, "https://images.unsplash.com/photo-1579783902614-a3fb3927b675", {
  caption: "Fetched by Telegram servers"
});
```

---

## 5. Security & Prompt Injection Defense for Media

- **Never execute file contents**: Uploaded files (PDFs, text files, scripts) are untrusted binary data.
- **Strict URL validation**: If fetching an image or asset from a user-supplied URL, validate the protocol (`https:`) and ensure the domain is on an approved allowlist before calling `sdk/fetch`. Never fetch internal network addresses (`127.0.0.1`, `169.254.169.254`, `localhost`).
