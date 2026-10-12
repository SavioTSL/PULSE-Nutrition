import { products, money, priceFor, replaceProducts } from "./products.js";
import { Cart, safeRead, normalize } from "./cart.js";
import { api, escapeHTML, saveOrderAccess } from "./safe.js";
import { productImage } from "./catalog.js";
const $ = (s) => document.querySelector(s),
  cart = new Cart();
let status,
  checkoutKey = crypto.randomUUID(),
  payloadSignature = "";
const states = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];
$("select[name=state]").innerHTML +=
  "<option>" + states.join("</option><option>") + "</option>";
function render() {
  $("#checkout-items").innerHTML = cart.items.length
    ? cart.items
        .map((i) => {
          const p = products.find((p) => p.id === i.id);
          return `<article class="checkout-item"><img src="${escapeHTML(productImage(p))}" alt="" width="80" height="80"><div><strong>${escapeHTML(p.name)}</strong><p>${escapeHTML(i.variant)} · ${i.qty} unidade${i.qty === 1 ? "" : "s"}</p><b>${money(priceFor(p, i.variant) * i.qty)}</b>${p.demonstrative !== false ? '<small class="demo-warning">Produto demonstrativo — sem cobrança</small>' : ""}</div></article>`;
        })
        .join("")
    : "<p>Seu carrinho está vazio. Volte ao catálogo para escolher produtos.</p>";
  $("#checkout-subtotal").textContent = money(cart.total);
  $("#checkout-shipping").textContent =
    status?.shippingFee !== null && status?.shippingFee !== undefined
      ? money(status.shippingFee)
      : "A configurar";
  $("#checkout-total").textContent = money(
    cart.total + (status?.shippingFee || 0),
  );
  const unavailable = cart.items.some((i) => {
    const p = products.find((p) => p.id === i.id);
    return (
      p?.demonstrative === false &&
      Number.isInteger(p.variantStock?.[i.variant]) &&
      p.variantStock[i.variant] < i.qty
    );
  });
  const demo = cart.items.some(
    (i) => products.find((p) => p.id === i.id)?.demonstrative !== false,
  );
  $("#pay-button").disabled =
    !cart.items.length || !status?.checkoutEnabled || demo || unavailable;
  $("#checkout-notice").textContent = !status?.databaseReady
    ? "A loja ainda precisa conectar o banco e ativar os pagamentos. Seu carrinho continua salvo; nenhuma cobrança será realizada."
    : !status.checkoutEnabled
      ? "A administração ainda não ativou o pagamento. Aguarde a configuração de frete, contato e Mercado Pago."
      : demo
        ? "Sua seleção contém produtos demonstrativos. Remova esses itens e selecione produtos reais cadastrados pela loja."
        : unavailable
          ? "Estoque alterado. Volte ao carrinho e ajuste as quantidades antes de continuar."
          : status.sandbox
            ? "Ambiente de testes do Mercado Pago: não utilize dados reais de pagamento."
            : "Seleção pronta. Confira o total e continue para o Mercado Pago.";
}
async function load() {
  try {
    status = await api("status");
    if (status.databaseReady) {
      const data = await api("products");
      replaceProducts(data.products);
      cart.items = normalize(safeRead("pulse-cart-v1", []));
    }
  } catch {
    status = null;
  }
  render();
}
$("#checkout-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if ($("#pay-button").disabled) return;
  const values = Object.fromEntries(new FormData(event.target));
  values.consent = event.target.elements.consent.checked;
  const data = {
    items: cart.items,
    customer: values,
    expectedTotal: cart.total + status.shippingFee,
  };
  const signature = JSON.stringify(data);
  if (signature !== payloadSignature) {
    checkoutKey = crypto.randomUUID();
    payloadSignature = signature;
  }
  $("#checkout-error").hidden = true;
  $("#pay-button").disabled = true;
  $("#pay-button").textContent = "Preparando pagamento...";
  try {
    const result = await api("checkout", {
      timeout: 30000,
      method: "POST",
      data: { ...data, checkoutKey },
    });
    if (!saveOrderAccess(result)) {
      try {
        sessionStorage.setItem(
          `pulse-order-${result.orderId}`,
          result.accessToken,
        );
      } catch {}
      $("#checkout-error").textContent =
        "Seu navegador bloqueou o armazenamento. Guarde a referência do pedido: " +
        result.orderId;
      $("#checkout-error").hidden = false;
    }
    const target = new URL(result.checkoutUrl);
    if (
      target.protocol !== "https:" ||
      !/(^|\.)mercadopago\./.test(target.hostname)
    )
      throw Error("Endereço de pagamento inválido.");
    location.assign(result.checkoutUrl);
  } catch (error) {
    $("#checkout-error").textContent = error.message;
    $("#checkout-error").hidden = false;
    if (
      [
        "CHECKOUT_RETRY",
        "PRICES_CHANGED",
        "CART_CHANGED",
        "STOCK_LIMIT",
        "DEMO_PRODUCT",
      ].includes(error.code)
    ) {
      checkoutKey = crypto.randomUUID();
      await load();
    }
  } finally {
    $("#pay-button").textContent = "Ir para pagamento ↗";
    render();
  }
});
window.addEventListener("storage", (event) => {
  if (event.key === "pulse-cart-v1" || event.key === null) {
    cart.items = normalize(safeRead("pulse-cart-v1", []));
    render();
  }
});
load();
