import {
  randomBytes,
  createHash,
  createHmac,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
export class HttpError extends Error {
  constructor(status, message, code = "REQUEST_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export const sha = (value) =>
  createHash("sha256").update(String(value)).digest("hex");
export const sign = (value, secret) =>
  createHmac("sha256", secret).update(value).digest("hex");
export const equal = (a, b) => {
  const x = Buffer.from(String(a)),
    y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};
export function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function validPassword(password, hash) {
  const match = /^scrypt:([a-f0-9]{32}):([a-f0-9]{128})$/.exec(hash || "");
  if (!match) return false;
  return equal(scryptSync(password, match[1], 64).toString("hex"), match[2]);
}
export function sessionConfig(env) {
  return Boolean(
    env.ADMIN_EMAIL &&
      /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(
        env.ADMIN_PASSWORD_HASH || "",
      ) &&
      (env.SESSION_SECRET || "").length >= 32 &&
      env.SITE_URL,
  );
}
export function makeSession(env) {
  const payload = {
    email: env.ADMIN_EMAIL.toLowerCase(),
    expires: Date.now() + 8 * 60 * 60 * 1000,
    csrf: randomBytes(24).toString("hex"),
    sessionId: randomBytes(24).toString("hex"),
  };
  const raw = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { payload, token: `${raw}.${sign(raw, env.SESSION_SECRET)}` };
}
export function readSession(req, env) {
  if (!sessionConfig(env)) return null;
  const token = (req.headers.cookie || "")
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith("pulse_admin="))
    ?.slice(12);
  if (!token) return null;
  const [raw, sig] = token.split(".");
  if (!raw || !equal(sig || "", sign(raw, env.SESSION_SECRET))) return null;
  try {
    const data = JSON.parse(Buffer.from(raw, "base64url").toString());
    return data.expires > Date.now() &&
      data.email === env.ADMIN_EMAIL.toLowerCase() &&
      typeof data.csrf === "string" &&
      /^[a-f0-9]{48}$/.test(data.sessionId || "")
      ? data
      : null;
  } catch {
    return null;
  }
}
export function cookie(token, env, clear = false) {
  return `pulse_admin=${clear ? "" : token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : 28800}${env.NODE_ENV === "production" || env.SITE_URL?.startsWith("https:") ? "; Secure" : ""}`;
}
export function requireOrigin(req, env) {
  let expected;
  try {
    expected = new URL(env.SITE_URL).origin;
  } catch {
    throw new HttpError(
      503,
      "Configure SITE_URL no servidor.",
      "CONFIG_REQUIRED",
    );
  }
  if (req.headers.origin !== expected)
    throw new HttpError(
      403,
      "Origem da solicitação não autorizada.",
      "ORIGIN_REJECTED",
    );
}
export async function requireAdmin(req, env, mutation = false, db) {
  const session = readSession(req, env);
  if (!session)
    throw new HttpError(401, "Entre na conta administrativa.", "AUTH_REQUIRED");
  if (
    !db ||
    (
      await db.query(
        "SELECT id FROM admin_sessions WHERE id=$1 AND expires_at>NOW()",
        [sha(session.sessionId)],
      )
    ).rows.length !== 1
  )
    throw new HttpError(
      401,
      "Sessão encerrada. Entre novamente.",
      "AUTH_REQUIRED",
    );
  if (mutation) {
    requireOrigin(req, env);
    if (!equal(req.headers["x-csrf-token"] || "", session.csrf))
      throw new HttpError(
        403,
        "Sessão inválida. Entre novamente.",
        "CSRF_REJECTED",
      );
  }
  return session;
}
export async function rateLimit(db, key, max, seconds) {
  const result = await db.query(
    `INSERT INTO rate_limits(key,hits,expires_at) VALUES($1,1,NOW()+($2::text||' seconds')::interval) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN rate_limits.expires_at<NOW() THEN 1 ELSE rate_limits.hits+1 END,expires_at=CASE WHEN rate_limits.expires_at<NOW() THEN EXCLUDED.expires_at ELSE rate_limits.expires_at END RETURNING hits`,
    [key, seconds],
  );
  if (result.rows[0].hits > max)
    throw new HttpError(
      429,
      "Muitas tentativas. Aguarde alguns minutos.",
      "RATE_LIMIT",
    );
}
export function webhookValid(req, url, env) {
  const secret = env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return false;
  const parts = Object.fromEntries(
    String(req.headers["x-signature"] || "")
      .split(",")
      .map((s) => s.trim().split("=")),
  );
  const requestId = req.headers["x-request-id"];
  const rawId = url.searchParams.get("data.id");
  if (
    !requestId ||
    !rawId ||
    !/^\d+$/.test(parts.ts || "") ||
    !/^[a-f0-9]{64}$/i.test(parts.v1 || "")
  )
    return false;
  const timestamp = Number(parts.ts);
  const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
  if (Math.abs(Date.now() - ms) > 5 * 60 * 1000) return false;
  const manifest = `id:${rawId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  return equal(parts.v1.toLowerCase(), sign(manifest, secret));
}
