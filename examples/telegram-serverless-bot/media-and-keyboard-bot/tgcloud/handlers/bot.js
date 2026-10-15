import api from "sdk/api";
import { InputFile } from "sdk/api";

const ITEMS = [
  { id: "1", name: "🍎 Apple", desc: "Fresh organic red apple" },
  { id: "2", name: "🍌 Banana", desc: "Sweet yellow banana" },
  { id: "3", name: "🍇 Grape", desc: "Seedless purple grapes" },
  { id: "4", name: "🍊 Orange", desc: "Juicy citrus orange" }
];

export default async function (ctx) {
  const update = ctx.update;
  if (!update) return;

  // Command to display catalog with inline keyboard
  if (update.message?.text?.startsWith("/catalog")) {
    const chatId = update.message.chat.id;
    return sendCatalogPage(chatId, 0);
  }

  // Command to generate and send an in-memory CSV report
  if (update.message?.text?.startsWith("/export")) {
    const chatId = update.message.chat.id;
    const csvContent = "id,name,desc\n" + ITEMS.map(i => `${i.id},"${i.name}","${i.desc}"`).join("\n");
    const encoder = new TextEncoder();
    const file = new InputFile(encoder.encode(csvContent), "catalog.csv");

    return api.sendDocument(chatId, file, {
      caption: "📄 Exported Fruit Catalog (Generated in V8 Isolate)"
    });
  }

  // Handle callback queries for pagination
  if (update.callback_query) {
    const cb = update.callback_query;
    await api.answerCallbackQuery(cb.id);

    const [prefix, action, val] = (cb.data || "").split(":");
    if (prefix === "cat" && action === "page") {
      const pageIdx = parseInt(val, 10) || 0;
      await editCatalogPage(cb.message.chat.id, cb.message.message_id, pageIdx);
    }
  }
}

async function sendCatalogPage(chatId, page) {
  const item = ITEMS[page % ITEMS.length];
  return api.sendMessage(chatId, `🛍️ **Item:** ${item.name}\n${item.desc}`, {
    parse_mode: "Markdown",
    reply_markup: buildPaginationKeyboard(page)
  });
}

async function editCatalogPage(chatId, messageId, page) {
  const item = ITEMS[page % ITEMS.length];
  return api.editMessageText(`🛍️ **Item:** ${item.name}\n${item.desc}`, {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: "Markdown",
    reply_markup: buildPaginationKeyboard(page)
  });
}

function buildPaginationKeyboard(page) {
  const prevPage = page > 0 ? page - 1 : ITEMS.length - 1;
  const nextPage = (page + 1) % ITEMS.length;

  return {
    inline_keyboard: [
      [
        { text: "⬅️ Prev", callback_data: `cat:page:${prevPage}` },
        { text: `${page + 1} / ${ITEMS.length}`, callback_data: "cat:noop" },
        { text: "Next ➡️", callback_data: `cat:page:${nextPage}` }
      ],
      [
        { text: "📥 Download CSV Export", callback_data: "cmd:export" }
      ]
    ]
  };
}
