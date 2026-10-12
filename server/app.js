import { getDatabase } from "./db.js";
import {
  HttpError,
  sha,
  equal,
  validPassword,
  sessionConfig,
  makeSession,
  readSession,
  cookie,
  requireAdmin,
  requireOrigin,
  rateLimit,
  webhookValid,
} from "./security.js";
import {
  publicProduct,
  validateProduct,
  merchantConfigured,
  storeSettings,
  expireOrders,
  createCheckout,
  orderReceipt,
  receivePayment,
  syncOrder,
} from "./commerce.js";
export async function body(req) {
  if (req.body !== undefined) {
    const raw =
      typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (raw.length > 50000) throw new HttpError(413, "Dados muito grandes.");
    try {
      return JSON.parse(raw);
    } catch {
      throw new HttpError(400, "JSON inválido.");
    }
  }
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 50000) throw new HttpError(413, "Dados muito grandes.");
  }
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new HttpError(400, "JSON inválido.");
  }
}
export function createHandler({
  database,
  env = process.env,
  fetchImpl = fetch,
} = {}) {
  return async (req, res) => {
    const json = (status, data) => {
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.end(JSON.stringify(data));
    };
    try {
      const url = new URL(req.url, "http://localhost");
      let path =
        req.query?.route ||
        url.searchParams.get("route") ||
        url.pathname.replace(/^\/api\/?/, "");
      if (Array.isArray(path)) path = path.join("/");
      path = String(path).replace(/^\/|\/$/g, "");
      const method = req.method || "GET";
      const db = database === undefined ? getDatabase(env) : database;
      if (path === "status" && method === "GET") {
        let settings = null,
          ready = false;
        if (db) {
          try {
            settings = await storeSettings(db);
            ready = Boolean(settings);
          } catch {}
        }
        return json(200, {
          databaseConfigured: Boolean(db),
          databaseReady: ready,
          adminConfigured: sessionConfig(env),
          paymentsConfigured: merchantConfigured(env),
          checkoutEnabled: Boolean(
            ready &&
              settings.checkout_enabled &&
              settings.shipping_fee_cents !== null &&
              settings.contact_email &&
              merchantConfigured(env),
          ),
          sandbox: env.MERCADOPAGO_SANDBOX !== "false",
          shippingFee: settings?.shipping_fee_cents ?? null,
          contactEmail: settings?.contact_email || "",
          whatsapp: settings?.whatsapp || "",
        });
      }
      if (!db)
        throw new HttpError(
          503,
          "Banco de dados não configurado. Consulte as instruções de ativação.",
          "CONFIG_REQUIRED",
        );
      if (path === "admin/login" && method === "POST") {
        if (!sessionConfig(env))
          throw new HttpError(
            503,
            "Acesso administrativo ainda não configurado.",
            "CONFIG_REQUIRED",
          );
        requireOrigin(req, env);
        const data = await body(req);
        const email = String(data.email || "")
            .trim()
            .toLowerCase(),
          password = String(data.password || "");
        if (password.length > 128 || email.length > 254)
          throw new HttpError(400, "Dados inválidos.");
        await rateLimit(db, `login:${sha(email)}`, 10, 900);
        await rateLimit(db, "login-global", 30, 900);
        const passwordOK = validPassword(password, env.ADMIN_PASSWORD_HASH);
        if (
          !equal(sha(email), sha(env.ADMIN_EMAIL.toLowerCase())) ||
          !passwordOK
        )
          throw new HttpError(
            401,
            "E-mail ou senha incorretos.",
            "LOGIN_FAILED",
          );
        const session = makeSession(env);
        await db.query("DELETE FROM admin_sessions WHERE expires_at<NOW()");
        await db.query(
          "INSERT INTO admin_sessions(id,email,expires_at) VALUES($1,$2,$3)",
          [
            sha(session.payload.sessionId),
            session.payload.email,
            new Date(session.payload.expires),
          ],
        );
        res.setHeader("Set-Cookie", cookie(session.token, env));
        return json(200, {
          email: session.payload.email,
          csrf: session.payload.csrf,
        });
      }
      if (path === "admin/session" && method === "GET") {
        const session = await requireAdmin(req, env, false, db);
        return json(200, { email: session.email, csrf: session.csrf });
      }
      if (path === "admin/logout" && method === "POST") {
        const session = await requireAdmin(req, env, true, db);
        await db.query("DELETE FROM admin_sessions WHERE id=$1", [
          sha(session.sessionId),
        ]);
        res.setHeader("Set-Cookie", cookie("", env, true));
        return json(200, { ok: true });
      }
      if (path.startsWith("admin/")) {
        await requireAdmin(req, env, method !== "GET", db);
        if (path === "admin/products" && method === "GET")
          return json(200, {
            products: (
              await db.query("SELECT * FROM products ORDER BY created_at,id")
            ).rows,
          });
        if (path === "admin/products" && ["POST", "PUT"].includes(method)) {
          const input = await body(req);
          const p = validateProduct(input);
          await db.transaction(async (tx) => {
            const existing = (
              await tx.query("SELECT * FROM products WHERE id=$1 FOR UPDATE", [
                p.id,
              ])
            ).rows[0];
            if (method === "POST" && existing)
              throw new HttpError(409, "Este identificador já existe.");
            if (method === "PUT" && !existing)
              throw new HttpError(404, "Produto não encontrado.");
            if (method === "PUT" && input.version !== existing.version)
              throw new HttpError(
                409,
                "Produto alterado por outra operação. Recarregue antes de salvar.",
                "VERSION_CONFLICT",
              );
            if (
              existing &&
              JSON.stringify(existing.variants.map((v) => v.name)) !==
                JSON.stringify(p.variants.map((v) => v.name))
            ) {
              const pending = (
                await tx.query(
                  "SELECT id FROM orders WHERE status IN ('creating','pending') AND items @> $1::jsonb LIMIT 1",
                  [JSON.stringify([{ id: p.id }])],
                )
              ).rows;
              if (pending.length)
                throw new HttpError(
                  409,
                  "Não renomeie variações com pedidos pendentes.",
                );
            }
            await tx.query(
              `INSERT INTO products(id,name,brand,category,description,label,image_url,tag,variants,active,demonstrative) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,brand=EXCLUDED.brand,category=EXCLUDED.category,description=EXCLUDED.description,label=EXCLUDED.label,image_url=EXCLUDED.image_url,tag=EXCLUDED.tag,variants=EXCLUDED.variants,active=EXCLUDED.active,demonstrative=EXCLUDED.demonstrative,updated_at=NOW(),version=products.version+1`,
              [
                p.id,
                p.name,
                p.brand,
                p.category,
                p.description,
                p.label,
                p.image_url,
                p.tag,
                JSON.stringify(p.variants),
                p.active,
                p.demonstrative,
              ],
            );
          });
          return json(200, { product: p });
        }
        if (path.startsWith("admin/products/") && method === "DELETE") {
          const id = path.slice(15);
          await db.query(
            "UPDATE products SET active=FALSE,updated_at=NOW(),version=version+1 WHERE id=$1",
            [id],
          );
          return json(200, { ok: true });
        }
        if (path === "admin/settings" && method === "GET")
          return json(200, { settings: await storeSettings(db) });
        if (path === "admin/settings" && method === "PUT") {
          const data = await body(req),
            fee = data.shipping_fee_cents;
          if (
            fee !== null &&
            (!Number.isInteger(fee) || fee < 0 || fee > 100000)
          )
            throw new HttpError(400, "Informe um frete válido em centavos.");
          const email = String(data.contact_email || "").trim(),
            phone = String(data.whatsapp || "").replace(/\D/g, "");
          if (
            email &&
            (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
          )
            throw new HttpError(400, "E-mail de contato inválido.");
          if (phone && !/^[1-9]\d{9,14}$/.test(phone))
            throw new HttpError(400, "WhatsApp inválido; informe DDI e DDD.");
          if (
            data.checkout_enabled === true &&
            (!merchantConfigured(env) || fee === null || !email)
          )
            throw new HttpError(
              409,
              "Configure Mercado Pago, assinatura de webhook, contato e frete antes de ativar.",
              "CONFIG_REQUIRED",
            );
          const result = await db.query(
            "UPDATE store_settings SET checkout_enabled=$1,shipping_fee_cents=$2,contact_email=$3,whatsapp=$4,updated_at=NOW() WHERE id=1 RETURNING *",
            [data.checkout_enabled === true, fee, email, phone],
          );
          return json(200, { settings: result.rows[0] });
        }
        if (path === "admin/orders" && method === "GET") {
          await expireOrders(db);
          const orders = (
            await db.query(
              "SELECT id,customer,items,total_cents,status,fulfillment,payment_status,created_at FROM orders ORDER BY created_at DESC LIMIT 200",
            )
          ).rows;
          return json(200, { orders });
        }
        const orderMatch =
          /^admin\/orders\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/(fulfillment|sync)$/.exec(
            path,
          );
        if (orderMatch && method === "POST") {
          if (orderMatch[2] === "sync") {
            if (!merchantConfigured(env))
              throw new HttpError(503, "Mercado Pago não configurado.");
            return json(
              200,
              await syncOrder(db, env, fetchImpl, orderMatch[1]),
            );
          }
          const data = await body(req);
          if (
            ![
              "pending",
              "processing",
              "shipped",
              "delivered",
              "review",
            ].includes(data.fulfillment)
          )
            throw new HttpError(400, "Situação de entrega inválida.");
          const updated = await db.query(
            "UPDATE orders SET fulfillment=$2,updated_at=NOW() WHERE id=$1 AND status='paid' RETURNING id",
            [orderMatch[1], data.fulfillment],
          );
          if (!updated.rows.length)
            throw new HttpError(
              409,
              "Só atualize a entrega de um pagamento confirmado pelo provedor.",
            );
          return json(200, { ok: true });
        }
        throw new HttpError(404, "Recurso administrativo não encontrado.");
      }
      if (path === "products" && method === "GET") {
        await expireOrders(db);
        return json(200, {
          products: (
            await db.query(
              "SELECT * FROM products WHERE active=TRUE ORDER BY created_at,id",
            )
          ).rows.map(publicProduct),
        });
      }
      if (path === "checkout" && method === "POST") {
        requireOrigin(req, env);
        await rateLimit(
          db,
          `checkout:${sha(req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown")}`,
          30,
          600,
        );
        await expireOrders(db);
        return json(
          200,
          await createCheckout(db, env, fetchImpl, await body(req)),
        );
      }
      const receipt =
        /^orders\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/.exec(
          path,
        );
      if (receipt && method === "GET") {
        await expireOrders(db);
        return json(200, {
          order: await orderReceipt(
            db,
            receipt[1],
            String(req.headers.authorization || "").replace(/^Bearer /, ""),
          ),
        });
      }
      if (path === "payments/webhook" && method === "POST") {
        if (!webhookValid(req, url, env))
          throw new HttpError(401, "Assinatura de notificação inválida.");
        const data = await body(req);
        if (data.type && data.type !== "payment")
          return json(200, { ignored: true });
        const id = url.searchParams.get("data.id");
        return json(200, await receivePayment(db, env, fetchImpl, id));
      }
      throw new HttpError(404, "Recurso não encontrado.");
    } catch (error) {
      if (error instanceof HttpError)
        return json(error.status, { error: error.message, code: error.code });
      return json(503, {
        error:
          "Serviço indisponível. Verifique o banco e a configuração do servidor.",
        code: "SERVICE_UNAVAILABLE",
      });
    }
  };
}
export default createHandler();
