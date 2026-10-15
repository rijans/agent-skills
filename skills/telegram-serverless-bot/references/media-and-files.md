# Media, Photos, and Binary File Handling

This reference explains how to receive, download, and send photos, documents, and binary assets within Telegram Serverless isolates.

---

## 1. Receiving Incoming Media (`file_id`)

When a user sends a photo or document, Telegram provides metadata and a unique `file_id`:

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

## 2. Downloading Files from Telegram

Telegram Serverless does not expose a bot token at runtime and does not require you to construct raw `https://api.telegram.org/file/bot<token>/...` URLs.

Instead, use the built-in download methods on `api`:

### Method 1: Buffer Entire File into Memory (`api.getFileContent`)

Returns a standard `Uint8Array` containing the complete file bytes:

```javascript
import { api } from "sdk";

export async function readIncomingDocumentText(fileId) {
  const bytes = await api.getFileContent(fileId); // Uint8Array
  const text = new TextDecoder().decode(bytes);
  return text;
}
```

### Method 2: Stream File Chunks (`api.getFileStream`)

For larger files, stream chunks to minimize peak isolate memory:

```javascript
import { api } from "sdk";

export async function processFileChunks(fileId) {
  const { body, file_path, file_size } = await api.getFileStream(fileId);
  for await (const chunk of body) {
    // chunk is a Uint8Array
  }
}
```

---

## 3. Uploading Binary Files & Images (`InputFile`)

Telegram Serverless supports uploading generated binary data using `InputFile` from `'sdk'`.

```javascript
import { api, InputFile } from "sdk";

export async function sendGeneratedImage(chatId, uint8Buffer, filename = "chart.png") {
  const file = new InputFile(uint8Buffer, filename, "image/png");

  return api.sendPhoto({
    chat_id: chatId,
    photo: file,
    caption: "🎨 Here is your generated chart!"
  });
}

export async function sendReportDocument(chatId, csvString, filename = "report.csv") {
  const bytes = new TextEncoder().encode(csvString);
  const file = new InputFile(bytes, filename, "text/csv");

  return api.sendDocument({
    chat_id: chatId,
    document: file,
    caption: "📊 Generated CSV Report"
  });
}
```

---

## 4. Sending Media by URL or Re-Using `file_id`

Re-using an existing `file_id` is instantaneous with zero upload bandwidth:

```javascript
import { api } from "sdk";

// 1. Re-using cached file_id
await api.sendPhoto({
  chat_id: chatId,
  photo: "AgACAgIAAxkDAAICAm...",
  caption: "Cached image from file_id"
});

// 2. Sending via public HTTP URL
await api.sendPhoto({
  chat_id: chatId,
  photo: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675",
  caption: "Fetched directly by Telegram servers"
});
```

---

## 5. Security & Prompt Injection Defense for Media (`W011`)

- **Never execute file contents**: Uploaded files (PDFs, text files, scripts) are untrusted binary data.
- **Strict URL validation**: If fetching an image or asset from a user-supplied URL, validate the protocol (`https:`) and ensure the domain is on an approved allowlist before calling `sdk/fetch`. Never fetch internal network addresses (`127.0.0.1`, `169.254.169.254`, `localhost`).
