import { api, InputFile } from "sdk";

const ITEMS = [
  { id: "1", name: "🍎 Apple", desc: "Fresh organic red apple" },
  { id: "2", name: "🍌 Banana", desc: "Sweet yellow banana" },
  { id: "3", name: "🍇 Grape", desc: "Seedless purple grapes" },
  { id: "4", name: "🍊 Orange", desc: "Juicy citrus orange" }
];

export default async function (message, ctx) {
  if (typeof message.text !== "string") return;

  const text = message.text.trim();
  const chatId = message.chat.id;

  // Command to display catalog with inline keyboard
  if (text.startsWith("/catalog")) {
    const item = ITEMS[0];
    return api.sendMessage({
      chat_id: chatId,
      text: `🛍️ **Item:** ${item.name}\n${item.desc}`,
      parse_mode: "Markdown",
      reply_markup: buildPaginationKeyboard(0, ITEMS.length)
    });
  }

  // Command to generate and send an in-memory CSV report
  if (text.startsWith("/export")) {
    const csvContent = "id,name,desc\n" + ITEMS.map(i => `${i.id},"${i.name}","${i.desc}"`).join("\n");
    const encoder = new TextEncoder();
    const file = new InputFile(encoder.encode(csvContent), "catalog.csv", "text/csv");

    return api.sendDocument({
      chat_id: chatId,
      document: file,
      caption: "📄 Exported Fruit Catalog (Generated in V8 Isolate)"
    });
  }
}

export function buildPaginationKeyboard(page, total) {
  const prevPage = page > 0 ? page - 1 : total - 1;
  const nextPage = (page + 1) % total;

  return {
    inline_keyboard: [
      [
        { text: "⬅️ Prev", callback_data: `cat:page:${prevPage}` },
        { text: `${page + 1} / ${total}`, callback_data: "cat:noop" },
        { text: "Next ➡️", callback_data: `cat:page:${nextPage}` }
      ],
      [
        { text: "📥 Export CSV", callback_data: "cmd:export" }
      ]
    ]
  };
}
