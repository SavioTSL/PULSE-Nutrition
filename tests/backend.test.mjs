import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { testDatabase } from "./helpers/database.mjs";
import { initializeDatabase } from "../server/db.js";
import { createHandler } from "../server/app.js";
import { passwordHash, sign } from "../server/security.js";

test("backend real: autenticação, catálogo, estoque, checkout e confirmação verificável", async (t) => {
  const db = await testDatabase();
  await initializeDatabase(db);
  const env = {
    NODE_ENV: "test",
    ADMIN_EMAIL: "admin@pulse.test",
    ADMIN_PASSWORD_HASH: passwordHash("fixture-password-not-for-production"),
    SESSION_SECRET: "fixture-session-secret-for-isolated-test-123456789",
    MERCADOPAGO_ACCESS_TOKEN: "TEST_FAKE_GATEWAY_FIXTURE",
    MERCADOPAGO_WEBHOOK_SECRET: "fixture-webhook-secret",
    MERCADOPAGO_SANDBOX: "true",
  };
  let preferenceCalls = 0,
    failProvider = false;
  const payments = new Map();
  const gateway = async (url, options) => {
    assert.ok(url.startsWith("https://api.mercadopago.com/"));
    if (failProvider) return new Response("{}", { status: 503 });
    if (url.endsWith("/checkout/preferences")) {
      preferenceCalls++;
      const data = JSON.parse(options.body);
      assert.equal(data.items[0].unit_price, 149.9);
      return Response.json({
        id: `pref-${preferenceCalls}`,
        init_point: "https://www.mercadopago.com.br/checkout/v1/redirect",
        sandbox_init_point:
          "https://sandbox.mercadopago.com.br/checkout/v1/redirect",
      });
    }
    if (url.includes("/v1/payments/search")) {
      const id = new URL(url).searchParams.get("external_reference");
      return Response.json({
        results: [...payments.values()].filter(
          (p) => p.external_reference === id,
        ),
      });
    }
    const id = url.split("/").at(-1);
    return payments.has(id)
      ? Response.json(payments.get(id))
      : new Response("{}", { status: 404 });
  };
  const handler = createHandler({ database: db, env, fetchImpl: gateway });
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  env.SITE_URL = `http://127.0.0.1:${server.address().port}`;
  let adminCookie = "",
    csrf = "",
    realProduct,
    order;
  async function call(
    path,
    { method = "GET", data, admin = false, headers = {} } = {},
  ) {
    const response = await fetch(`${env.SITE_URL}/api/${path}`, {
      method,
      headers: {
        ...(method !== "GET" ? { Origin: env.SITE_URL } : {}),
        ...(data ? { "Content-Type": "application/json" } : {}),
        ...(admin ? { Cookie: adminCookie, "X-CSRF-Token": csrf } : {}),
        ...headers,
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    return {
      status: response.status,
      data: await response.json(),
      cookie: response.headers.get("set-cookie"),
    };
  }
  const customer = {
    name: "Cliente de teste",
    email: "cliente@example.test",
    phone: "85999999999",
    zip: "60000000",
    street: "Rua de teste",
    number: "10",
    complement: "",
    neighborhood: "Centro",
    city: "Fortaleza",
    state: "CE",
    consent: true,
  };
  function checkout(key = randomUUID(), qty = 2) {
    return {
      checkoutKey: key,
      customer,
      items: [{ id: "whey", variant: "Chocolate · 900 g", qty }],
      expectedTotal: 14990 * qty + 1200,
    };
  }
  function webhook(id) {
    const ts = String(Math.floor(Date.now() / 1000)),
      requestId = "fixture-request";
    return {
      "x-request-id": requestId,
      "x-signature": `ts=${ts},v1=${sign(`id:${id};request-id:${requestId};ts:${ts};`, env.MERCADOPAGO_WEBHOOK_SECRET)}`,
    };
  }
  try {
    await t.test(
      "páginas privadas exigem login; credenciais e origem são validadas",
      async () => {
        assert.equal((await call("admin/products")).status, 401);
        assert.equal(
          (
            await call("admin/login", {
              method: "POST",
              data: { email: env.ADMIN_EMAIL, password: "incorreta" },
            })
          ).status,
          401,
        );
        const login = await call("admin/login", {
          method: "POST",
          data: {
            email: env.ADMIN_EMAIL,
            password: "fixture-password-not-for-production",
          },
        });
        assert.equal(login.status, 200);
        assert.match(login.cookie, /HttpOnly/);
        assert.match(login.cookie, /SameSite=Strict/);
        adminCookie = login.cookie.split(";")[0];
        csrf = login.data.csrf;
        assert.equal(
          (await call("admin/session", { headers: { Cookie: adminCookie } }))
            .status,
          200,
        );
        assert.equal(
          (
            await call("admin/settings", {
              method: "PUT",
              data: {},
              headers: { Cookie: adminCookie },
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await call("admin/settings", {
              method: "PUT",
              data: {},
              admin: true,
              headers: { Origin: "https://attack.example" },
            })
          ).status,
          403,
        );
      },
    );
    await t.test(
      "configurações e edição persistem no banco, com proteção contra sobrescrita",
      async () => {
        const list = await call("admin/products", { admin: true });
        assert.equal(list.data.products.length, 8);
        realProduct = {
          ...list.data.products.find((p) => p.id === "whey"),
          demonstrative: false,
          variants: list.data.products
            .find((p) => p.id === "whey")
            .variants.map((v) => ({ ...v, stock: 10 })),
        };
        assert.equal(
          (
            await call("admin/products", {
              method: "PUT",
              admin: true,
              data: realProduct,
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await call("admin/products", {
              method: "PUT",
              admin: true,
              data: realProduct,
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await call("admin/settings", {
              method: "PUT",
              admin: true,
              data: {
                shipping_fee_cents: 1200,
                contact_email: "contato@example.test",
                whatsapp: "5585999999999",
                checkout_enabled: true,
              },
            })
          ).status,
          200,
        );
        assert.equal((await call("status")).data.checkoutEnabled, true);
      },
    );
    await t.test(
      "não cobra produtos fictícios nem aceita preços ou quantidades manipulados",
      async () => {
        assert.equal(
          (
            await call("checkout", {
              method: "POST",
              data: {
                ...checkout(),
                items: [
                  { id: "creatine", variant: "Sem sabor · 300 g", qty: 1 },
                ],
              },
            })
          ).data.code,
          "DEMO_PRODUCT",
        );
        assert.equal(
          (
            await call("checkout", {
              method: "POST",
              data: { ...checkout(), expectedTotal: 1 },
            })
          ).data.code,
          "PRICES_CHANGED",
        );
        assert.equal(
          (
            await call("checkout", {
              method: "POST",
              data: checkout(randomUUID(), 0),
            })
          ).status,
          400,
        );
        const p = (await call("products")).data.products.find(
          (p) => p.id === "whey",
        );
        assert.equal(p.variantStock["Chocolate · 900 g"], 10);
        assert.equal(preferenceCalls, 0);
      },
    );
    await t.test(
      "checkout é idempotente, reserva estoque e protege o acompanhamento",
      async () => {
        const data = checkout();
        const first = await call("checkout", { method: "POST", data });
        assert.equal(first.status, 200);
        order = first.data;
        assert.equal(order.total, 31180);
        const again = await call("checkout", { method: "POST", data });
        assert.equal(again.data.orderId, order.orderId);
        assert.equal(again.data.accessToken, order.accessToken);
        assert.equal(preferenceCalls, 1);
        assert.equal((await call(`orders/${order.orderId}`)).status, 404);
        const receipt = await call(`orders/${order.orderId}`, {
          headers: { Authorization: `Bearer ${order.accessToken}` },
        });
        assert.equal(receipt.data.order.status, "pending");
        assert.equal(
          (
            await call(`orders/${order.orderId}?status=approved`, {
              headers: { Authorization: `Bearer ${order.accessToken}` },
            })
          ).data.order.status,
          "pending",
        );
        assert.equal(
          (await call("products")).data.products.find((p) => p.id === "whey")
            .variantStock["Chocolate · 900 g"],
          8,
        );
        assert.equal(
          (
            await call(`admin/orders/${order.orderId}/fulfillment`, {
              method: "POST",
              admin: true,
              data: { fulfillment: "shipped" },
            })
          ).status,
          409,
        );
      },
    );
    await t.test(
      "webhook precisa de assinatura e confirmação de valor no provedor",
      async () => {
        payments.set("123", {
          id: 123,
          external_reference: order.orderId,
          status: "approved",
          currency_id: "BRL",
          transaction_amount: 1,
        });
        assert.equal(
          (
            await call("payments/webhook?data.id=123", {
              method: "POST",
              data: { type: "payment" },
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await call("payments/webhook?data.id=123", {
              method: "POST",
              data: { type: "payment" },
              headers: webhook("123"),
            })
          ).status,
          409,
        );
        payments.get("123").transaction_amount = 311.8;
        assert.equal(
          (
            await call("payments/webhook?data.id=123", {
              method: "POST",
              data: { type: "payment" },
              headers: webhook("123"),
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await call("payments/webhook?data.id=123", {
              method: "POST",
              data: { type: "payment" },
              headers: webhook("123"),
            })
          ).status,
          200,
        );
        const receipt = (
          await call(`orders/${order.orderId}`, {
            headers: { Authorization: `Bearer ${order.accessToken}` },
          })
        ).data.order;
        assert.equal(receipt.status, "paid");
        assert.equal(
          (await call("products")).data.products.find((p) => p.id === "whey")
            .variantStock["Chocolate · 900 g"],
          8,
        );
        assert.equal(
          (
            await call(`admin/orders/${order.orderId}/fulfillment`, {
              method: "POST",
              admin: true,
              data: { fulfillment: "shipped" },
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await call(`orders/${order.orderId}`, {
              headers: { Authorization: `Bearer ${order.accessToken}` },
            })
          ).data.order.fulfillment,
          "shipped",
        );
      },
    );
    await t.test(
      "expiração devolve reserva e falha do provedor não consome estoque",
      async () => {
        const pending = (
          await call("checkout", {
            method: "POST",
            data: checkout(randomUUID(), 1),
          })
        ).data;
        await db.query(
          "UPDATE orders SET expires_at=NOW()-INTERVAL '1 minute' WHERE id=$1",
          [pending.orderId],
        );
        await call("products");
        assert.equal(
          (
            await call(`orders/${pending.orderId}`, {
              headers: { Authorization: `Bearer ${pending.accessToken}` },
            })
          ).data.order.status,
          "expired",
        );
        failProvider = true;
        const failed = await call("checkout", {
          method: "POST",
          data: checkout(randomUUID(), 1),
        });
        assert.equal(failed.status, 502);
        failProvider = false;
        assert.equal(
          (await call("products")).data.products.find((p) => p.id === "whey")
            .variantStock["Chocolate · 900 g"],
          8,
        );
      },
    );
    await t.test(
      "pagamento tardio restaura alocação das duas variações sem sobrescrever estoque",
      async () => {
        const data = checkout();
        data.items = [
          { id: "whey", variant: "Chocolate · 900 g", qty: 1 },
          { id: "whey", variant: "Baunilha · 900 g", qty: 1 },
        ];
        const result = (await call("checkout", { method: "POST", data })).data;
        await db.query(
          "UPDATE orders SET expires_at=NOW()-INTERVAL '1 minute' WHERE id=$1",
          [result.orderId],
        );
        await call("products");
        payments.set("777", {
          id: 777,
          external_reference: result.orderId,
          status: "approved",
          currency_id: "BRL",
          transaction_amount: 311.8,
        });
        assert.equal(
          (
            await call("payments/webhook?data.id=777", {
              method: "POST",
              data: { type: "payment" },
              headers: webhook("777"),
            })
          ).status,
          200,
        );
        const product = (await call("products")).data.products.find(
          (p) => p.id === "whey",
        );
        assert.equal(product.variantStock["Chocolate · 900 g"], 7);
        assert.equal(product.variantStock["Baunilha · 900 g"], 9);
      },
    );
    await t.test(
      "nova tentativa aprovada pelo provedor substitui pagamento rejeitado",
      async () => {
        const result = (
          await call("checkout", {
            method: "POST",
            data: checkout(randomUUID(), 1),
          })
        ).data;
        payments.set("888", {
          id: 888,
          external_reference: result.orderId,
          status: "rejected",
          currency_id: "BRL",
          transaction_amount: 161.9,
        });
        assert.equal(
          (
            await call("payments/webhook?data.id=888", {
              method: "POST",
              data: { type: "payment" },
              headers: webhook("888"),
            })
          ).status,
          200,
        );
        payments.set("889", {
          id: 889,
          external_reference: result.orderId,
          status: "approved",
          currency_id: "BRL",
          transaction_amount: 161.9,
        });
        assert.equal(
          (
            await call("payments/webhook?data.id=889", {
              method: "POST",
              data: { type: "payment" },
              headers: webhook("889"),
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await call(`orders/${result.orderId}`, {
              headers: { Authorization: `Bearer ${result.accessToken}` },
            })
          ).data.order.status,
          "paid",
        );
      },
    );
    await t.test("logout invalida a sessão do navegador", async () => {
      const logout = await call("admin/logout", {
        method: "POST",
        admin: true,
      });
      assert.equal(logout.status, 200);
      assert.match(logout.cookie, /Max-Age=0/);
      assert.equal((await call("admin/products", { admin: true })).status, 401);
      assert.equal(
        (
          await call("admin/products", {
            headers: { Cookie: "pulse_admin=invalid" },
          })
        ).status,
        401,
      );
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await db.close();
  }
});
