import { randomUUID } from "node:crypto";
import { HttpError, sha, sign, equal } from "./security.js";
import { categories } from "../js/products.js";
export function publicProduct(p) {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    description: p.description,
    label: p.label,
    imageUrl: p.image_url,
    image: Number(/product-(\d)/.exec(p.image_url)?.[1] || 0),
    tag: p.tag,
    price: Math.min(...p.variants.map((v) => v.price)),
    variants: p.variants.map((v) => v.name),
    variantPrices: Object.fromEntries(p.variants.map((v) => [v.name, v.price])),
    variantStock: Object.fromEntries(p.variants.map((v) => [v.name, v.stock])),
    demonstrative: p.demonstrative,
  };
}
export function validateProduct(data) {
  const text = (key, max, required = true) => {
    const value = String(data[key] ?? "").trim();
    if ((required && !value) || value.length > max)
      throw new HttpError(400, `Campo ${key} inválido.`);
    return value;
  };
  const product = {
    id: text("id", 60),
    name: text("name", 120),
    brand: text("brand", 80),
    category: text("category", 80),
    description: text("description", 3000),
    label: text("label", 1800, false),
    image_url: text("image_url", 600),
    tag: text("tag", 40, false),
    active: data.active === true,
    demonstrative: data.demonstrative !== false,
  };
  if (
    !/^[a-z0-9][a-z0-9_-]{0,59}$/.test(product.id) ||
    !categories.includes(product.category)
  )
    throw new HttpError(400, "Identificação ou categoria inválida.");
  if (
    !/^assets\/[a-zA-Z0-9/_.-]+\.(webp|png|jpe?g|svg)$/.test(product.image_url)
  ) {
    try {
      const url = new URL(product.image_url);
      if (url.protocol !== "https:" || url.username || url.password)
        throw Error();
    } catch {
      throw new HttpError(400, "Use imagem local em assets/ ou uma URL HTTPS.");
    }
  }
  if (
    !Array.isArray(data.variants) ||
    data.variants.length < 1 ||
    data.variants.length > 20
  )
    throw new HttpError(400, "Cadastre de 1 a 20 variações.");
  product.variants = data.variants.map((v) => {
    const name = String(v.name || "").trim();
    if (
      !name ||
      name.length > 100 ||
      !Number.isInteger(v.price) ||
      v.price < 100 ||
      v.price > 10000000 ||
      !Number.isInteger(v.stock) ||
      v.stock < 0 ||
      v.stock > 100000
    )
      throw new HttpError(400, "Variação, preço ou estoque inválido.");
    return { name, price: v.price, stock: v.stock };
  });
  if (
    new Set(product.variants.map((v) => v.name)).size !==
    product.variants.length
  )
    throw new HttpError(400, "Nomes das variações precisam ser diferentes.");
  return product;
}
export function customerInput(data) {
  const fields = {
    name: 120,
    email: 254,
    phone: 20,
    zip: 9,
    street: 160,
    number: 20,
    complement: 100,
    neighborhood: 100,
    city: 100,
    state: 2,
  };
  const customer = {};
  for (const [key, max] of Object.entries(fields)) {
    const value = String(data?.[key] ?? "").trim();
    if (value.length > max || (!value && !["complement"].includes(key)))
      throw new HttpError(400, `Preencha corretamente o campo ${key}.`);
    customer[key] = value;
  }
  customer.email = customer.email.toLowerCase();
  customer.phone = customer.phone.replace(/\D/g, "");
  customer.zip = customer.zip.replace(/\D/g, "");
  customer.state = customer.state.toUpperCase();
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email) ||
    !/^\d{10,13}$/.test(customer.phone) ||
    !/^\d{8}$/.test(customer.zip) ||
    ![
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
    ].includes(customer.state)
  )
    throw new HttpError(400, "Confira e-mail, telefone, CEP e estado.");
  if (data.consent !== true)
    throw new HttpError(
      400,
      "Confirme os dados e as informações de privacidade antes de continuar.",
    );
  return customer;
}
export function merchantConfigured(env) {
  try {
    const site = new URL(env.SITE_URL);
    return Boolean(
      env.MERCADOPAGO_ACCESS_TOKEN &&
        env.MERCADOPAGO_WEBHOOK_SECRET &&
        (env.SESSION_SECRET || "").length >= 32 &&
        (site.protocol === "https:" ||
          (env.NODE_ENV !== "production" &&
            ["localhost", "127.0.0.1"].includes(site.hostname))),
    );
  } catch {
    return false;
  }
}
export async function storeSettings(db) {
  return (await db.query("SELECT * FROM store_settings WHERE id=1")).rows[0];
}
async function saveVariants(tx, id, variants) {
  await tx.query(
    "UPDATE products SET variants=$2::jsonb,updated_at=NOW(),version=version+1 WHERE id=$1",
    [id, JSON.stringify(variants)],
  );
}
export async function releaseStock(tx, order) {
  for (const line of order.items) {
    const p = (
      await tx.query("SELECT * FROM products WHERE id=$1 FOR UPDATE", [line.id])
    ).rows[0];
    if (!p) continue;
    const v = p.variants.find((v) => v.name === line.variant);
    if (v) {
      v.stock += line.qty;
      await saveVariants(tx, p.id, p.variants);
    }
  }
}
export async function expireOrders(db) {
  await db.transaction(async (tx) => {
    const expired = (
      await tx.query(
        "SELECT * FROM orders WHERE status IN ('creating','pending') AND expires_at<NOW() ORDER BY expires_at LIMIT 20 FOR UPDATE SKIP LOCKED",
      )
    ).rows;
    for (const order of expired) {
      await releaseStock(tx, order);
      await tx.query(
        "UPDATE orders SET status='expired',updated_at=NOW() WHERE id=$1",
        [order.id],
      );
    }
  });
}
async function providerRequest(path, env, fetchImpl, options = {}) {
  let response;
  try {
    response = await fetchImpl(`https://api.mercadopago.com${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new HttpError(
      502,
      "Não foi possível contatar o Mercado Pago. Tente novamente mais tarde.",
      "PAYMENT_UNAVAILABLE",
    );
  }
  if (!response.ok)
    throw new HttpError(
      502,
      "O provedor de pagamento não respondeu. Tente novamente mais tarde.",
      "PAYMENT_UNAVAILABLE",
    );
  return response.json();
}
export function orderAccess(order, env) {
  return sign(`${order.id}:${order.checkout_key}`, env.SESSION_SECRET);
}
function checkoutResult(order, env) {
  if (!equal(sha(orderAccess(order, env)), order.access_hash))
    throw new HttpError(
      409,
      "Configuração da loja atualizada. Inicie uma nova tentativa.",
      "CHECKOUT_RETRY",
    );
  if (order.status === "creating")
    throw new HttpError(
      409,
      "Pagamento sendo preparado. Aguarde e tente novamente.",
      "CHECKOUT_BUSY",
    );
  if (!order.checkout_url || !["pending", "paid"].includes(order.status))
    throw new HttpError(
      409,
      "Esta tentativa expirou. Atualize o carrinho e tente novamente.",
      "CHECKOUT_RETRY",
    );
  return {
    orderId: order.id,
    accessToken: orderAccess(order, env),
    checkoutUrl: order.checkout_url,
    total: order.total_cents,
  };
}
export async function createCheckout(db, env, fetchImpl, data) {
  const settings = await storeSettings(db);
  if (
    !merchantConfigured(env) ||
    !settings?.checkout_enabled ||
    settings.shipping_fee_cents === null ||
    !settings.contact_email
  )
    throw new HttpError(
      503,
      "Pagamentos ainda não foram ativados pela administração.",
      "CONFIG_REQUIRED",
    );
  const customer = customerInput(data.customer);
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
      data.checkoutKey || "",
    ) ||
    !Number.isInteger(data.expectedTotal)
  )
    throw new HttpError(400, "Solicitação inválida. Atualize a página.");
  if (
    !Array.isArray(data.items) ||
    data.items.length < 1 ||
    data.items.length > 60
  )
    throw new HttpError(400, "Seu carrinho está vazio ou tem itens demais.");
  const grouped = new Map();
  for (const item of data.items) {
    if (
      typeof item.id !== "string" ||
      typeof item.variant !== "string" ||
      !Number.isInteger(item.qty) ||
      item.qty < 1 ||
      item.qty > 99
    )
      throw new HttpError(400, "Quantidade ou variação inválida.");
    const key = JSON.stringify([item.id, item.variant]);
    const prior = grouped.get(key);
    if (prior) {
      prior.qty += item.qty;
      if (prior.qty > 99)
        throw new HttpError(400, "Limite de 99 unidades por variação.");
    } else
      grouped.set(key, { id: item.id, variant: item.variant, qty: item.qty });
  }
  const requested = [...grouped.values()].sort(
    (a, b) => a.id.localeCompare(b.id) || a.variant.localeCompare(b.variant),
  );
  const requestHash = sha(
    JSON.stringify({
      customer,
      items: requested,
      expectedTotal: data.expectedTotal,
    }),
  );
  let order,
    existing = false;
  try {
    await db.transaction(async (tx) => {
      const prior = (
        await tx.query("SELECT * FROM orders WHERE checkout_key=$1", [
          data.checkoutKey,
        ])
      ).rows[0];
      if (prior) {
        if (prior.request_hash !== requestHash)
          throw new HttpError(
            409,
            "Dados alterados. Inicie uma nova tentativa.",
            "CHECKOUT_RETRY",
          );
        order = prior;
        existing = true;
        return;
      }
      const rows = (
        await tx.query(
          "SELECT * FROM products WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE",
          [[...new Set(requested.map((i) => i.id))]],
        )
      ).rows;
      const items = [];
      let subtotal = 0;
      for (const item of requested) {
        const p = rows.find((p) => p.id === item.id);
        const v = p?.variants.find((v) => v.name === item.variant);
        if (!p?.active || !v)
          throw new HttpError(
            409,
            "Um produto foi alterado ou está indisponível. Atualize o carrinho.",
            "CART_CHANGED",
          );
        if (p.demonstrative)
          throw new HttpError(
            409,
            `${p.name} é demonstrativo e não pode receber cobranças.`,
            "DEMO_PRODUCT",
          );
        if (v.stock < item.qty)
          throw new HttpError(
            409,
            `Estoque insuficiente para ${p.name} (${v.name}).`,
            "STOCK_LIMIT",
          );
        items.push({
          id: p.id,
          name: p.name,
          variant: v.name,
          qty: item.qty,
          price: v.price,
          imageUrl: p.image_url,
        });
        subtotal += v.price * item.qty;
        v.stock -= item.qty;
      }
      const total = subtotal + settings.shipping_fee_cents;
      if (!Number.isSafeInteger(total) || total > 100000000)
        throw new HttpError(
          400,
          "O valor do pedido excede o limite permitido.",
        );
      if (total !== data.expectedTotal)
        throw new HttpError(
          409,
          "Preço ou frete atualizado. Revise os valores antes de pagar.",
          "PRICES_CHANGED",
        );
      for (const p of rows) await saveVariants(tx, p.id, p.variants);
      const id = randomUUID();
      const access = orderAccess({ id, checkout_key: data.checkoutKey }, env);
      order = (
        await tx.query(
          `INSERT INTO orders(id,checkout_key,request_hash,access_hash,customer,items,subtotal_cents,shipping_cents,total_cents,expires_at) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,NOW()+INTERVAL '30 minutes') RETURNING *`,
          [
            id,
            data.checkoutKey,
            requestHash,
            sha(access),
            JSON.stringify(customer),
            JSON.stringify(items),
            subtotal,
            settings.shipping_fee_cents,
            total,
          ],
        )
      ).rows[0];
    });
  } catch (error) {
    if (error.code === "23505") {
      order = (
        await db.query("SELECT * FROM orders WHERE checkout_key=$1", [
          data.checkoutKey,
        ])
      ).rows[0];
      if (!order || order.request_hash !== requestHash)
        throw new HttpError(
          409,
          "Outra tentativa está em andamento.",
          "CHECKOUT_BUSY",
        );
      existing = true;
    } else throw error;
  }
  if (existing) return checkoutResult(order, env);
  try {
    const origin = new URL(env.SITE_URL).origin;
    const back = `${origin}/pedido?order=${order.id}`;
    const preference = await providerRequest(
      "/checkout/preferences",
      env,
      fetchImpl,
      {
        method: "POST",
        headers: { "X-Idempotency-Key": order.id },
        body: JSON.stringify({
          items: order.items.map((i) => ({
            id: i.id,
            title: `${i.name} — ${i.variant}`,
            quantity: i.qty,
            unit_price: i.price / 100,
            currency_id: "BRL",
          })),
          shipments: {
            cost: order.shipping_cents / 100,
            mode: "not_specified",
          },
          payer: { name: customer.name, email: customer.email },
          external_reference: order.id,
          back_urls: { success: back, pending: back, failure: back },
          auto_return: "approved",
          notification_url: `${origin}/api/payments/webhook`,
          expires: true,
          expiration_date_from: new Date().toISOString(),
          expiration_date_to: new Date(order.expires_at).toISOString(),
          payment_methods: {
            excluded_payment_types: [{ id: "ticket" }, { id: "atm" }],
          },
          statement_descriptor: "PULSE NUTRITION",
        }),
      },
    );
    const checkoutUrl =
      env.MERCADOPAGO_SANDBOX === "false"
        ? preference.init_point
        : preference.sandbox_init_point;
    let parsed;
    try {
      parsed = new URL(checkoutUrl);
    } catch {
      throw new HttpError(
        502,
        "O provedor não retornou um endereço válido.",
        "PAYMENT_UNAVAILABLE",
      );
    }
    if (
      parsed.protocol !== "https:" ||
      !/(^|\.)mercadopago\.(com|com\.br|com\.ar|com\.mx|cl|com\.uy|com\.co|com\.pe)$/.test(
        parsed.hostname,
      )
    )
      throw new HttpError(
        502,
        "Endereço de pagamento inválido.",
        "PAYMENT_UNAVAILABLE",
      );
    order = (
      await db.query(
        "UPDATE orders SET status='pending',preference_id=$2,checkout_url=$3,updated_at=NOW() WHERE id=$1 RETURNING *",
        [order.id, String(preference.id), checkoutUrl],
      )
    ).rows[0];
    return checkoutResult(order, env);
  } catch (error) {
    await db.transaction(async (tx) => {
      const current = (
        await tx.query("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [
          order.id,
        ])
      ).rows[0];
      if (current?.status === "creating") {
        await releaseStock(tx, current);
        await tx.query(
          "UPDATE orders SET status='failed',updated_at=NOW() WHERE id=$1",
          [order.id],
        );
      }
    });
    throw error;
  }
}
export async function applyPayment(db, payment) {
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
      payment.external_reference || "",
    )
  )
    throw new HttpError(400, "Pagamento sem referência válida.");
  return db.transaction(async (tx) => {
    const order = (
      await tx.query("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [
        payment.external_reference,
      ])
    ).rows[0];
    if (!order) throw new HttpError(404, "Pedido não encontrado.");
    if (
      payment.currency_id !== "BRL" ||
      Math.round(Number(payment.transaction_amount) * 100) !== order.total_cents
    )
      throw new HttpError(
        409,
        "O valor do pagamento não corresponde ao pedido.",
        "PAYMENT_MISMATCH",
      );
    if (
      order.payment_id &&
      order.payment_id !== String(payment.id) &&
      ["paid", "refunded"].includes(order.status)
    )
      throw new HttpError(409, "Outro pagamento já está vinculado.");
    let status = order.status,
      fulfillment = order.fulfillment;
    if (payment.status === "approved" && order.status !== "paid") {
      if (["expired", "failed"].includes(order.status)) {
        let canAllocate = true;
        const allocations = new Map();
        for (const line of order.items) {
          const p =
            allocations.get(line.id) ||
            (
              await tx.query("SELECT * FROM products WHERE id=$1 FOR UPDATE", [
                line.id,
              ])
            ).rows[0];
          const v = p?.variants.find((v) => v.name === line.variant);
          if (!v || v.stock < line.qty) {
            canAllocate = false;
            break;
          }
          v.stock -= line.qty;
          allocations.set(p.id, p);
        }
        if (canAllocate) {
          for (const p of allocations.values())
            await saveVariants(tx, p.id, p.variants);
        } else fulfillment = "review";
      }
      status = "paid";
    } else if (
      ["rejected", "cancelled"].includes(payment.status) &&
      ["creating", "pending"].includes(order.status)
    ) {
      await releaseStock(tx, order);
      status = "failed";
    } else if (
      ["refunded", "charged_back"].includes(payment.status) &&
      order.status === "paid"
    ) {
      status = "refunded";
      fulfillment = "review";
    }
    await tx.query(
      "UPDATE orders SET status=$2,fulfillment=$3,payment_id=$4,payment_status=$5,updated_at=NOW() WHERE id=$1",
      [
        order.id,
        status,
        fulfillment,
        String(payment.id),
        String(payment.status),
      ],
    );
    return { status, fulfillment };
  });
}
function validatePaymentMode(payment, env) {
  if (
    typeof payment.live_mode === "boolean" &&
    payment.live_mode === (env.MERCADOPAGO_SANDBOX !== "false")
  )
    throw new HttpError(
      409,
      "O modo do pagamento não corresponde ao ambiente configurado.",
      "PAYMENT_MODE_MISMATCH",
    );
}
export async function receivePayment(db, env, fetchImpl, id) {
  if (!/^\d{1,30}$/.test(id))
    throw new HttpError(400, "Identificação de pagamento inválida.");
  const payment = await providerRequest(`/v1/payments/${id}`, env, fetchImpl);
  if (String(payment.id) !== id)
    throw new HttpError(502, "O provedor retornou outro pagamento.");
  validatePaymentMode(payment, env);
  return applyPayment(db, payment);
}
export async function syncOrder(db, env, fetchImpl, id) {
  const found = await providerRequest(
    `/v1/payments/search?external_reference=${encodeURIComponent(id)}&sort=date_created&criteria=desc`,
    env,
    fetchImpl,
  );
  const payment =
    found.results?.find(
      (p) => p.external_reference === id && p.status === "approved",
    ) || found.results?.find((p) => p.external_reference === id);
  if (payment) {
    validatePaymentMode(payment, env);
    return applyPayment(db, payment);
  }
  return { status: "pending" };
}
export async function orderReceipt(db, id, token) {
  const order = (await db.query("SELECT * FROM orders WHERE id=$1", [id]))
    .rows[0];
  if (!order || !token || !equal(sha(token), order.access_hash))
    throw new HttpError(404, "Pedido não encontrado ou acesso inválido.");
  return {
    id: order.id,
    status: order.status,
    fulfillment: order.fulfillment,
    customer: order.customer,
    items: order.items,
    subtotal: order.subtotal_cents,
    shipping: order.shipping_cents,
    total: order.total_cents,
    createdAt: order.created_at,
    paymentStatus: order.payment_status,
  };
}
