import assert from "node:assert/strict";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { testDatabase } from "./helpers/database.mjs";
import { initializeDatabase } from "../server/db.js";
import { createHandler } from "../server/app.js";
import { passwordHash, sign } from "../server/security.js";
const { chromium } = await import(
  process.env.PLAYWRIGHT_PATH
    ? `${process.env.PLAYWRIGHT_PATH}/index.mjs`
    : "playwright"
);
const root = resolve(new URL("..", import.meta.url).pathname),
  db = await testDatabase();
await initializeDatabase(db);
const env = {
  NODE_ENV: "test",
  ADMIN_EMAIL: "admin@pulse.test",
  ADMIN_PASSWORD_HASH: passwordHash("fixture-password-not-for-production"),
  SESSION_SECRET: "isolated-test-session-secret-12345678901234567890",
  MERCADOPAGO_ACCESS_TOKEN: "TEST_FAKE_GATEWAY_FIXTURE",
  MERCADOPAGO_WEBHOOK_SECRET: "fixture-webhook",
  MERCADOPAGO_SANDBOX: "true",
};
const preferences = new Map(),
  payments = new Map();
const gateway = async (url, options) => {
  if (url.endsWith("/checkout/preferences")) {
    const data = JSON.parse(options.body);
    preferences.set(data.external_reference, data);
    return Response.json({
      id: "fixture-preference",
      sandbox_init_point: `https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=fixture`,
      init_point: "https://www.mercadopago.com.br/checkout/v1/redirect",
    });
  }
  if (url.includes("/payments/search")) {
    const id = new URL(url).searchParams.get("external_reference");
    return Response.json({
      results: [...payments.values()].filter(
        (p) => p.external_reference === id,
      ),
    });
  }
  const payment = payments.get(url.split("/").at(-1));
  return payment ? Response.json(payment) : new Response("{}", { status: 404 });
};
const handler = createHandler({ database: db, env, fetchImpl: gateway });
const server = http.createServer(async (req, res) => {
  if (req.url.startsWith("/api/")) return handler(req, res);
  try {
    let path = new URL(req.url, "http://localhost").pathname;
    if (path === "/") path = "/index.html";
    if (!extname(path)) path += ".html";
    const file = resolve(root, "." + path);
    if (!file.startsWith(root + "/") || path.includes("..")) throw Error();
    const types = {
      ".js": "application/javascript",
      ".css": "text/css",
      ".html": "text/html",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".woff2": "font/woff2",
    };
    res.setHeader(
      "Content-Type",
      types[extname(path)] || "application/octet-stream",
    );
    res.end(await readFile(file));
  } catch {
    res.statusCode = 404;
    res.end("not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
env.SITE_URL = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const adminContext = await browser.newContext({
      viewport: { width: 1440, height: 950 },
    }),
    admin = await adminContext.newPage(),
    errors = [];
  admin.on("pageerror", (e) => errors.push(e.message));
  await admin.goto(`${env.SITE_URL}/admin`);
  await admin.locator("#admin-email").fill(env.ADMIN_EMAIL);
  await admin
    .locator("#admin-password")
    .fill("fixture-password-not-for-production");
  await admin.locator("#login-button").click();
  await admin.locator("#admin-shell").waitFor({ state: "visible" });
  await admin.locator('[data-section="products"]').click();
  await admin.locator('[data-edit="whey"]').click();
  await admin.locator('[name="demonstrative"]').uncheck();
  await admin.locator("[data-v-stock]").nth(0).fill("10");
  await admin.locator("[data-v-stock]").nth(1).fill("10");
  await admin.locator("[data-v-price]").nth(1).fill("169.90");
  await admin.locator("#save-product").click();
  await admin.locator("#product-editor").waitFor({ state: "hidden" });
  await admin.locator('[data-section="settings"]').click();
  await admin.locator('[name="contact_email"]').fill("loja@example.test");
  await admin.locator('[name="shipping_fee"]').fill("20");
  await admin.locator('[name="checkout_enabled"]').check();
  await admin.locator("#settings-form button[type=submit]").click();
  await admin.waitForFunction(() =>
    document
      .querySelector("#admin-message")
      .textContent.includes("Configurações salvas"),
  );
  await admin.locator('[data-section="overview"]').click();
  await admin.screenshot({
    path: "/tmp/pulse-admin-desktop.png",
    fullPage: true,
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  let postedResult, postedStatus;
  await context.route("**/api/checkout", async (route) => {
    const result = await route.fetch();
    postedStatus = result.status();
    postedResult = await result.json();
    await route.fulfill({ response: result });
  });
  await context.route("https://sandbox.mercadopago.com.br/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<p>Provedor interceptado pelo teste. Nenhuma cobrança real.</p>",
    }),
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(env.SITE_URL);
  await page.waitForFunction(() => window.PULSE_STORE_STATUS?.checkoutEnabled);
  await page
    .locator('[data-id="whey"] [data-variant]')
    .selectOption("Baunilha · 900 g");
  assert.equal(
    await page.locator('[data-id="whey"] .price').textContent(),
    "R$ 169,90",
  );
  await page.locator('[data-detail="whey"]').first().click();
  assert.equal(
    await page.locator("#detail-variant").inputValue(),
    "Baunilha · 900 g",
  );
  await page.locator("#detail-qty").fill("2");
  await page.locator("#detail-add").click();
  assert.match(
    await page.locator("#product-dialog .dialog-feedback").textContent(),
    /adicionado/,
  );
  await page.locator("#detail-view-cart").click();
  assert.equal(await page.locator("#cart-dialog").isVisible(), true);
  assert.equal(
    await page.evaluate(() => document.body.classList.contains("modal-open")),
    true,
  );
  await page.locator("#checkout-link").click();
  await page.waitForURL("**/checkout.html");
  await page.waitForFunction(
    () => !document.querySelector("#pay-button").disabled,
  );
  assert.equal(
    await page.locator("#checkout-total").textContent(),
    "R$ 359,80",
  );
  const customer = {
    name: "Cliente Teste",
    email: "cliente@example.test",
    phone: "85999999999",
    zip: "60000000",
    street: "Rua Teste",
    number: "10",
    neighborhood: "Centro",
    city: "Fortaleza",
  };
  for (const [name, value] of Object.entries(customer))
    await page.locator(`[name="${name}"]`).fill(value);
  await page.locator('[name="state"]').selectOption("CE");
  await page.locator('[name="consent"]').check();
  await page.screenshot({
    path: "/tmp/pulse-checkout-mobile.png",
    fullPage: true,
  });
  if (process.env.AXE_PATH) {
    for (const target of [admin, page]) {
      await target.emulateMedia({ reducedMotion: "reduce" });
      await target.addScriptTag({ path: process.env.AXE_PATH });
      const result = await target.evaluate(() =>
        axe.run(document, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
          },
        }),
      );
      assert.deepEqual(
        result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.html),
        })),
        [],
        `acessibilidade ${target.url()}`,
      );
    }
  }
  await page.locator("#pay-button").click();
  await page.waitForURL("https://sandbox.mercadopago.com.br/**");
  assert.equal(postedStatus, 200);
  const result = postedResult;
  await page.goto(
    `${env.SITE_URL}/pedido?order=${result.orderId}&status=approved`,
  );
  await page.waitForFunction(() =>
    document.querySelector("#order-status").textContent.includes("Aguardando"),
  );
  assert.match(
    await page.locator("#order-status").textContent(),
    /Aguardando pagamento/,
  );
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pulse-cart-v1"))[0].qty,
    ),
    2,
  );
  const preference = preferences.get(result.orderId);
  assert.equal(preference.items[0].unit_price, 169.9);
  payments.set("999", {
    id: 999,
    external_reference: result.orderId,
    status: "approved",
    currency_id: "BRL",
    transaction_amount: 359.8,
    live_mode: false,
  });
  const ts = String(Math.floor(Date.now() / 1000)),
    rid = "fixture-e2e";
  const hook = await fetch(`${env.SITE_URL}/api/payments/webhook?data.id=999`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": rid,
      "x-signature": `ts=${ts},v1=${sign(`id:999;request-id:${rid};ts:${ts};`, env.MERCADOPAGO_WEBHOOK_SECRET)}`,
    },
    body: JSON.stringify({ type: "payment" }),
  });
  assert.equal(hook.status, 200);
  await page.locator("#refresh-order").click();
  await page.waitForFunction(() =>
    document.querySelector("#order-status").textContent.includes("confirmado"),
  );
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("pulse-cart-v1")).length,
    ),
    0,
  );
  await admin.locator('[data-section="orders"]').click();
  await admin.locator("#reload-orders").click();
  await admin.locator("[data-delivery]").waitFor();
  await admin.locator("[data-delivery]").selectOption("shipped");
  await admin.waitForFunction(() =>
    document
      .querySelector("#admin-message")
      .textContent.includes("atualizadas"),
  );
  await page.locator("#refresh-order").click();
  await page.waitForFunction(() =>
    document.querySelector("#order-details").textContent.includes("Enviado"),
  );
  for (const target of [admin, page])
    for (const width of [320, 390, 768, 1440]) {
      await target.setViewportSize({ width, height: 900 });
      assert.equal(
        await target.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        `overflow ${target.url()} @ ${width}`,
      );
    }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: login HTTP real, painel, edição de estoque/preço, configuração, carrinho, checkout, provedor interceptado, webhook assinado, acompanhamento, entrega e layouts. Banco PostgreSQL isolado; nenhuma cobrança real.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await db.close();
}
