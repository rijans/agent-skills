import { api, InputFile } from "sdk";

const ITEMS = [
  { id: "1", name: "🍎 Apple", desc: "Fresh organic red apple" },
  { id: "2", name: "🍌 Banana", desc: "Sweet yellow banana" },
  { id: "3", name: "🍇 Grape", desc: "Seedless purple grapes" },
  { id: "4", name: "🍊 Orange", desc: "Juicy citrus orange" }
];

export default async function (query, ctx) {
  const cb = query;
  await api.answerCallbackQuery({
    callback_query_id: cb.id
  });

  const [prefix, action, val] = (cb.data || "").split(":");
  const chatId = cb.message?.chat?.id;
  const messageId = cb.message?.message_id;

  if (prefix === "cat" && action === "page") {
    const pageIdx = parseInt(val, 10) || 0;
    const item = ITEMS[pageIdx % ITEMS.length];
    const prevPage = pageIdx > 0 ? pageIdx - 1 : ITEMS.length - 1;
    const nextPage = (pageIdx + 1) % ITEMS.length;

    await api.editMessageText({
      chat_id: chatId,
      message_id: messageId,
      text: `🛍️ **Item:** ${item.name}\n${item.desc}`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "⬅️ Prev", callback_data: `cat:page:${prevPage}` },
            { text: `${pageIdx + 1} / ${ITEMS.length}`, callback_data: "cat:noop" },
            { text: "Next ➡️", callback_data: `cat:page:${nextPage}` }
          ],
          [
            { text: "📥 Export CSV", callback_data: "cmd:export" }
          ]
        ]
      }
    });
  }

  if (prefix === "cmd" && action === "export") {
    const csvContent = "id,name,desc\n" + ITEMS.map(i => `${i.id},"${i.name}","${i.desc}"`).join("\n");
    const encoder = new TextEncoder();
    const file = new InputFile(encoder.encode(csvContent), "catalog.csv", "text/csv");

    await api.sendDocument({
      chat_id: chatId,
      document: file,
      caption: "📄 Exported Fruit Catalog (Generated in V8 Isolate)"
    });
  }
}
