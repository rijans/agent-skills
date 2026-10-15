import { api } from "sdk";

export default async function (query, ctx) {
  const isValid = typeof query.invoice_payload === "string" &&
    query.invoice_payload === "order:premium_pass" &&
    query.currency === "XTR";

  if (!isValid) {
    return api.answerPreCheckoutQuery({
      pre_checkout_query_id: query.id,
      ok: false,
      error_message: "Item unavailable or invalid.",
    });
  }

  return api.answerPreCheckoutQuery({
    pre_checkout_query_id: query.id,
    ok: true,
  });
}
