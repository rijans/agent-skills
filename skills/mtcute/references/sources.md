# Verified Sources & Documentation Links

This reference lists authoritative documentation, package endpoints, and migration guides for `mtcute`.

---

## 1. Upstream mtcute Documentation

- **Official Documentation**: [https://mtcute.dev](https://mtcute.dev)
- **GitHub Repository**: [https://github.com/mtcute/mtcute](https://github.com/mtcute/mtcute)
- **API Reference**: [https://mtcute.dev/guide/topics/dispatcher.html](https://mtcute.dev/guide/topics/dispatcher.html)
- **Storage & Sessions**: [https://mtcute.dev/guide/topics/storage.html](https://mtcute.dev/guide/topics/storage.html)
- **Files & Media Streaming**: [https://mtcute.dev/guide/topics/files.html](https://mtcute.dev/guide/topics/files.html)
- **Raw TL & MTProto RPC**: [https://mtcute.dev/guide/topics/raw-api.html](https://mtcute.dev/guide/topics/raw-api.html)

---

## 2. Official Telegram Protocol & Schema

- **Telegram MTProto 2.0 Specification**: [https://core.telegram.org/mtproto](https://core.telegram.org/mtproto)
- **Telegram Type Language (TL) Schema**: [https://core.telegram.org/schema](https://core.telegram.org/schema)
- **Telegram Methods Reference**: [https://core.telegram.org/methods](https://core.telegram.org/methods)
- **Telegram API Credentials Portal**: [https://my.telegram.org](https://my.telegram.org)

---

## 3. Package Ecosystem

- **`@mtcute/node`**: Node.js runtime adapter with SQLite storage, TCP transport, crypto primitives, and terminal CLI helpers.
- **`@mtcute/dispatcher`**: Update dispatching framework with declarative filters, command parsing, and scenes.
- **`@mtcute/core`**: Core runtime-agnostic MTProto protocol implementation and `MemoryStorage`.
- **`@mtcute/web`**: Browser and Web Worker adapter with IndexedDB persistence and WebSocket transport.
- **`@mtcute/bun`**: Native Bun runtime adapter leveraging `bun:sqlite`.

---

## 4. GramJS (`telegram`) Migration Notes

- **GramJS Status**: `gram-js/gramjs` was formally archived in July 2026.
- **Key Differences**:
  - `StringSession` $\rightarrow$ `tg.exportSession()` / `tg.start({ session: string })`.
  - `client.addEventHandler(...)` $\rightarrow$ `dp.onNewMessage(...)` with `filters`.
  - Native Node crypto / C++ build dependencies $\rightarrow$ Pure modern TypeScript with Web Crypto APIs.
