import { api, escapeHTML } from "./safe.js";
import { categories, money } from "./products.js";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
let csrf = "",
  productData = [],
  orderData = [],
  settings = {},
  status = {},
  editing = null;
const paymentLabels = {
    creating: "Preparando",
    pending: "Aguardando pagamento",
    paid: "Pagamento confirmado",
    failed: "Não concluído",
    expired: "Expirado",
    refunded: "Estornado",
  },
  deliveryLabels = {
    pending: "Aguardando preparação",
    processing: "Em preparação",
    shipped: "Enviado",
    delivered: "Entregue",
    review: "Revisão necessária",
  };
function message(text, error = false) {
  const box = $("#admin-message");
  box.hidden = false;
  box.textContent = text;
  box.classList.toggle("error", error);
}
function showLogin(text = "") {
  csrf = "";
  $("#admin-shell").hidden = true;
  $("#admin-login").hidden = false;
  $("#login-message").textContent = text;
  $("#admin-password").value = "";
}
async function request(path, options = {}) {
  try {
    return await api(`admin/${path}`, { ...options, csrf });
  } catch (error) {
    if (error.status === 401) showLogin("Sessão expirada. Entre novamente.");
    throw error;
  }
}
async function load() {
  const [p, o, s, publicStatus] = await Promise.all([
    request("products"),
    request("orders"),
    request("settings"),
    api("status"),
  ]);
  productData = p.products;
  orderData = o.orders;
  settings = s.settings;
  status = publicStatus;
  renderProducts();
  renderOrders();
  renderOverview();
  fillSettings();
}
function renderOverview() {
  const paid = orderData.filter((o) => o.status === "paid");
  $("#admin-stats").innerHTML = [
    ["Produtos ativos", productData.filter((p) => p.active).length],
    ["Pedidos recentes", orderData.length],
    ["Pagamentos confirmados", paid.length],
    [
      "Receita confirmada",
      money(paid.reduce((sum, o) => sum + o.total_cents, 0)),
    ],
  ]
    .map(
      ([title, value]) =>
        `<article><span>${title}</span><strong>${value}</strong></article>`,
    )
    .join("");
  $("#admin-readiness").innerHTML = [
    ["Banco conectado", status.databaseReady],
    ["Mercado Pago configurado", status.paymentsConfigured],
    ["Frete definido", settings.shipping_fee_cents !== null],
    ["Contato publicado", Boolean(settings.contact_email)],
    ["Checkout ativado", status.checkoutEnabled],
  ]
    .map(
      ([label, ready]) =>
        `<p class="readiness"><span class="${ready ? "ready" : "waiting"}">${ready ? "✓" : "○"}</span>${label}</p>`,
    )
    .join("");
}
function renderProducts() {
  const term = $("#admin-product-search").value.toLowerCase();
  const list = productData.filter((p) =>
    `${p.name} ${p.category}`.toLowerCase().includes(term),
  );
  $("#admin-products").innerHTML = list.length
    ? list
        .map(
          (p) =>
            `<article class="admin-product-card"><img src="${escapeHTML(p.image_url)}" alt="" loading="lazy" width="180" height="180"><div><span class="status-pill">${p.active ? "Publicado" : "Oculto"}${p.demonstrative ? " · Demo" : ""}</span><h3>${escapeHTML(p.name)}</h3><p>${escapeHTML(p.category)} · ${p.variants.length} variação${p.variants.length === 1 ? "" : "s"}</p><strong>${money(Math.min(...p.variants.map((v) => v.price)))}</strong><p>${p.variants.reduce((sum, v) => sum + v.stock, 0)} unidades disponíveis</p><div class="admin-card-actions"><button class="button dark" data-edit="${escapeHTML(p.id)}">Editar</button><button class="text-link" data-hide="${escapeHTML(p.id)}">Ocultar</button></div></div></article>`,
        )
        .join("")
    : '<div class="notice">Nenhum produto encontrado.</div>';
}
function renderOrders() {
  const filter = $("#admin-order-filter").value,
    list = orderData.filter((o) => filter === "all" || o.status === filter);
  $("#admin-orders").innerHTML = list.length
    ? list
        .map(
          (o) =>
            `<article class="admin-order-card"><div class="order-card-heading"><h3>Pedido ${escapeHTML(o.id.slice(0, 8).toUpperCase())}</h3><span class="status-pill ${o.status === "paid" ? "paid" : ""}">${paymentLabels[o.status] || escapeHTML(o.status)}</span><b>${money(o.total_cents)}</b></div><p>${escapeHTML(o.customer.name)} · ${escapeHTML(o.customer.email)} · ${escapeHTML(o.customer.phone)}</p><p>${escapeHTML(o.customer.street)}, ${escapeHTML(o.customer.number)} ${escapeHTML(o.customer.complement)} — ${escapeHTML(o.customer.neighborhood)}, ${escapeHTML(o.customer.city)}/${escapeHTML(o.customer.state)} · CEP ${escapeHTML(o.customer.zip)}</p><ul>${o.items.map((i) => `<li>${i.qty} × ${escapeHTML(i.name)} — ${escapeHTML(i.variant)}</li>`).join("")}</ul><p>${escapeHTML(new Date(o.created_at).toLocaleString("pt-BR"))} · Preparação: ${deliveryLabels[o.fulfillment] || "A consultar"}</p><div class="admin-order-actions">${
              o.status === "paid"
                ? `<label>Situação da entrega<select data-delivery="${o.id}">${Object.entries(
                    deliveryLabels,
                  )
                    .map(
                      ([value, label]) =>
                        `<option value="${value}" ${value === o.fulfillment ? "selected" : ""}>${label}</option>`,
                    )
                    .join("")}</select></label>`
                : ""
            }<button data-sync="${o.id}" class="button dark">Consultar Mercado Pago ↻</button></div></article>`,
        )
        .join("")
    : '<div class="notice">Nenhum pedido nesta situação. Pagamentos só aparecem após pedidos reais ou testes configurados do provedor.</div>';
}
function fillSettings() {
  const form = $("#settings-form");
  form.elements.contact_email.value = settings.contact_email;
  form.elements.whatsapp.value = settings.whatsapp;
  form.elements.shipping_fee.value =
    settings.shipping_fee_cents === null
      ? ""
      : (settings.shipping_fee_cents / 100).toFixed(2);
  form.elements.checkout_enabled.checked = settings.checkout_enabled;
  $("#payment-readiness").textContent = !status.paymentsConfigured
    ? "Chaves do Mercado Pago, webhook ou URL do site ainda não configurados."
    : status.sandbox
      ? "Mercado Pago em ambiente de testes. Configure produção na hospedagem somente quando a operação real estiver pronta."
      : "Mercado Pago configurado em produção. Ative apenas produtos reais, com estoque e informações conferidas.";
}
function selectSection(section) {
  $$('[id^="panel-"]').forEach((p) => (p.hidden = p.id !== `panel-${section}`));
  $$("[data-section]").forEach((b) =>
    b.classList.toggle("selected", b.dataset.section === section),
  );
  $("#admin-title").innerHTML = {
    overview: "VISÃO <em>GERAL.</em>",
    products: "PRODUTOS E <em>ESTOQUE.</em>",
    orders: "SEUS <em>PEDIDOS.</em>",
    settings: "CONFIGURAÇÕES DA <em>LOJA.</em>",
  }[section];
  $("#admin-message").hidden = true;
}
$$("[data-section]").forEach((b) =>
  b.addEventListener("click", () => selectSection(b.dataset.section)),
);
$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#login-button").disabled = true;
  $("#login-message").textContent = "Validando acesso...";
  try {
    const session = await api("admin/login", {
      method: "POST",
      data: {
        email: $("#admin-email").value,
        password: $("#admin-password").value,
      },
    });
    csrf = session.csrf;
    $("#admin-account").textContent = session.email;
    await load();
    $("#admin-login").hidden = true;
    $("#admin-shell").hidden = false;
    $("#admin-password").value = "";
  } catch (error) {
    $("#login-message").textContent = error.message;
  } finally {
    $("#login-button").disabled = false;
  }
});
$("#logout-button").addEventListener("click", async () => {
  try {
    await request("logout", { method: "POST" });
    showLogin("Você saiu da conta.");
  } catch (error) {
    message(error.message, true);
  }
});
$("#admin-product-search").addEventListener("input", renderProducts);
$("#admin-order-filter").addEventListener("change", renderOrders);
$("#reload-orders").addEventListener("click", async () => {
  try {
    await load();
    message("Pedidos atualizados.");
  } catch (error) {
    message(error.message, true);
  }
});
function variantRow(v = { name: "", price: 0, stock: 0 }) {
  return `<div class="variant-row"><label>Nome / tamanho<input data-v-name value="${escapeHTML(v.name)}" maxlength="100" required></label><label>Preço (R$)<input data-v-price type="number" min="1" max="100000" step="0.01" value="${(v.price / 100).toFixed(2)}" required></label><label>Disponível<input data-v-stock type="number" min="0" max="100000" step="1" value="${v.stock}" required></label><button type="button" data-remove-variant aria-label="Remover variação">✕</button></div>`;
}
function editor(product) {
  editing = product || null;
  const f = $("#product-form");
  f.reset();
  $("#editor-title").textContent = product ? "EDITAR PRODUTO" : "NOVO PRODUTO";
  f.elements.id.readOnly = Boolean(product);
  for (const key of [
    "id",
    "name",
    "brand",
    "image_url",
    "tag",
    "description",
    "label",
  ])
    f.elements[key].value =
      product?.[key] || (key === "brand" ? "PULSE Nutrition" : "");
  f.elements.category.innerHTML = categories
    .map((c) => `<option>${c}</option>`)
    .join("");
  f.elements.category.value = product?.category || categories[0];
  f.elements.active.checked = product?.active ?? true;
  f.elements.demonstrative.checked = product?.demonstrative ?? true;
  $("#variant-editor").innerHTML = (
    product?.variants || [{ name: "", price: 0, stock: 0 }]
  )
    .map(variantRow)
    .join("");
  $("#editor-message").hidden = true;
  $("#product-editor").showModal();
  document.body.classList.add("modal-open");
}
$("#new-product").addEventListener("click", () => editor());
$("#editor-close").addEventListener("click", () =>
  $("#product-editor").close(),
);
$("#product-editor").addEventListener("close", () =>
  document.body.classList.remove("modal-open"),
);
$("#add-variant").addEventListener("click", () => {
  if ($(".variant-row") && $$(".variant-row").length >= 20) return;
  $("#variant-editor").insertAdjacentHTML("beforeend", variantRow());
});
$("#variant-editor").addEventListener("click", (event) => {
  if (
    event.target.closest("[data-remove-variant]") &&
    $$(".variant-row").length > 1
  )
    event.target.closest(".variant-row").remove();
});
$("#admin-products").addEventListener("click", async (event) => {
  const edit = event.target.closest("[data-edit]"),
    hide = event.target.closest("[data-hide]");
  if (edit) editor(productData.find((p) => p.id === edit.dataset.edit));
  if (
    hide &&
    confirm(
      "Ocultar este produto na loja? Pedidos existentes serão preservados.",
    )
  )
    try {
      await request(`products/${hide.dataset.hide}`, { method: "DELETE" });
      await load();
      message("Produto ocultado.");
    } catch (error) {
      message(error.message, true);
    }
});
$("#product-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#save-product").disabled = true;
  const f = event.target,
    data = Object.fromEntries(new FormData(f));
  data.active = f.elements.active.checked;
  data.demonstrative = f.elements.demonstrative.checked;
  data.version = editing?.version;
  data.variants = $$(".variant-row").map((row) => ({
    name: row.querySelector("[data-v-name]").value,
    price: Math.round(Number(row.querySelector("[data-v-price]").value) * 100),
    stock: Number(row.querySelector("[data-v-stock]").value),
  }));
  try {
    await request("products", { method: editing ? "PUT" : "POST", data });
    $("#product-editor").close();
    await load();
    message(
      "Produto salvo no banco e disponível conforme a visibilidade definida.",
    );
  } catch (error) {
    $("#editor-message").hidden = false;
    $("#editor-message").textContent = error.message;
  } finally {
    $("#save-product").disabled = false;
  }
});
$("#settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  try {
    await request("settings", {
      method: "PUT",
      data: {
        contact_email: form.elements.contact_email.value,
        whatsapp: form.elements.whatsapp.value,
        shipping_fee_cents:
          form.elements.shipping_fee.value === ""
            ? null
            : Math.round(Number(form.elements.shipping_fee.value) * 100),
        checkout_enabled: form.elements.checkout_enabled.checked,
      },
    });
    await load();
    message("Configurações salvas.");
  } catch (error) {
    message(error.message, true);
  }
});
$("#admin-orders").addEventListener("change", async (event) => {
  const select = event.target.closest("[data-delivery]");
  if (!select) return;
  try {
    await request(`orders/${select.dataset.delivery}/fulfillment`, {
      method: "POST",
      data: { fulfillment: select.value },
    });
    await load();
    message("Preparação e entrega atualizadas.");
  } catch (error) {
    message(error.message, true);
    await load();
  }
});
$("#admin-orders").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-sync]");
  if (!button) return;
  button.disabled = true;
  try {
    await request(`orders/${button.dataset.sync}/sync`, { method: "POST" });
    await load();
    message("Situação consultada na API do Mercado Pago.");
  } catch (error) {
    message(error.message, true);
  } finally {
    button.disabled = false;
  }
});
(async () => {
  try {
    status = await api("status");
    if (!status.databaseReady || !status.adminConfigured) {
      $("#login-message").textContent =
        "O painel foi implementado, mas o banco e o acesso ainda precisam ser ativados na hospedagem.";
      return;
    }
    const session = await api("admin/session");
    csrf = session.csrf;
    $("#admin-account").textContent = session.email;
    await load();
    $("#admin-login").hidden = true;
    $("#admin-shell").hidden = false;
  } catch (error) {
    if (error.status !== 401) $("#login-message").textContent = error.message;
  }
})();
