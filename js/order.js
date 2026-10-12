import { api, escapeHTML, orderAccess } from "./safe.js";
import { money } from "./products.js";
const $ = (s) => document.querySelector(s),
  labels = {
    creating: "Preparando pagamento",
    pending: "Aguardando pagamento",
    paid: "Pagamento confirmado pelo provedor",
    failed: "Pagamento não concluído",
    expired: "Prazo de pagamento expirado",
    refunded: "Pagamento estornado / em revisão",
  },
  fulfillment = {
    pending: "Aguardando preparação",
    processing: "Em preparação",
    shipped: "Enviado",
    delivered: "Entregue",
    review: "A loja precisa revisar este pedido",
  };
if ($("#orders-list")) {
  let list = [];
  try {
    const data = JSON.parse(localStorage.getItem("pulse-orders-v1") || "[]");
    if (Array.isArray(data))
      list = data.filter(
        (i) =>
          /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
            i.id,
          ) && typeof i.token === "string",
      );
  } catch {}
  $("#orders-list").innerHTML = list.length
    ? list
        .map(
          (i) =>
            `<a class="order-history-row" href="pedido.html?order=${encodeURIComponent(i.id)}"><strong>Pedido ${escapeHTML(i.id.slice(0, 8).toUpperCase())}</strong><span>${escapeHTML(new Date(i.createdAt).toLocaleDateString("pt-BR"))} · Acompanhar ↗</span></a>`,
        )
        .join("")
    : '<div class="notice">Nenhum pedido iniciado neste navegador. Monte sua seleção na loja.</div>';
}
const clearedOrders = new Set();
function clearPurchasedItems(order) {
  if (order.status !== "paid" || clearedOrders.has(order.id)) return;
  try {
    const key = `pulse-paid-cleared-${order.id}`;
    if (localStorage.getItem(key)) return;
    const raw = JSON.parse(localStorage.getItem("pulse-cart-v1") || "[]");
    if (!Array.isArray(raw)) return;
    const next = raw
      .map((item) => {
        const bought = order.items.find(
          (line) => line.id === item.id && line.variant === item.variant,
        );
        return bought ? { ...item, qty: item.qty - bought.qty } : item;
      })
      .filter((item) => Number.isInteger(item.qty) && item.qty > 0);
    localStorage.setItem("pulse-cart-v1", JSON.stringify(next));
    clearedOrders.add(order.id);
    localStorage.setItem(key, "yes");
  } catch {}
}
if ($("#order-status")) {
  const id = new URLSearchParams(location.search).get("order");
  let token = orderAccess(id);
  try {
    token = token || sessionStorage.getItem(`pulse-order-${id}`);
  } catch {}
  let timer;
  async function refresh() {
    clearTimeout(timer);
    $("#refresh-order").disabled = true;
    try {
      if (
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
          id || "",
        ) ||
        !token
      )
        throw Error(
          "Acesso ao pedido não encontrado neste navegador. Retorne ao dispositivo onde você iniciou a compra ou procure o contato da loja.",
        );
      const { order } = await api(`orders/${id}`, { token });
      clearPurchasedItems(order);
      $("#order-status").textContent =
        labels[order.status] || "Situação em análise";
      $("#order-details").innerHTML =
        `<div class="receipt-card"><p>Referência: <strong>${escapeHTML(order.id.slice(0, 8).toUpperCase())}</strong></p><p>Cliente: ${escapeHTML(order.customer.name)}</p><p>Entrega: ${escapeHTML(order.customer.street)}, ${escapeHTML(order.customer.number)} — ${escapeHTML(order.customer.city)}/${escapeHTML(order.customer.state)}</p><div>${order.items.map((i) => `<div class="receipt-line"><span>${i.qty} × ${escapeHTML(i.name)}<small>${escapeHTML(i.variant)}</small></span><b>${money(i.price * i.qty)}</b></div>`).join("")}</div><div class="totals"><div><span>Frete</span><b>${money(order.shipping)}</b></div><div class="grand-total"><span>Total</span><b>${money(order.total)}</b></div></div>${order.status === "paid" ? `<p>Preparação e entrega: ${fulfillment[order.fulfillment] || "A consultar"}</p>` : "<p>O retorno do Mercado Pago não confirma pagamento. A situação acima vem do servidor.</p>"}</div>`;
      if (["pending", "creating"].includes(order.status))
        timer = setTimeout(refresh, 12000);
    } catch (error) {
      $("#order-status").textContent = error.message;
    } finally {
      $("#refresh-order").disabled = false;
    }
  }
  $("#refresh-order").addEventListener("click", refresh);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearTimeout(timer);
    else refresh();
  });
  refresh();
}
