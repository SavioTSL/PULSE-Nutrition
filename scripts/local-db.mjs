import { spawnSync } from "node:child_process";
import { mkdir, writeFile, chmod } from "node:fs/promises";
import { createHash } from "node:crypto";
import { localDirectory, developmentDatabaseEnv } from "../dev/database.mjs";
import { getDatabase, initializeDatabase } from "../server/db.js";
if (process.env.NODE_ENV === "production" || process.env.VERCEL || process.env.DATABASE_URL) throw Error("Banco local exclusivo para desenvolvimento sem DATABASE_URL externa.");
const name = `pulse-db-${createHash("sha256").update(localDirectory).digest("hex").slice(0, 12)}`;
function docker(args, capture = false) {
  const result = spawnSync("docker", args, { encoding: "utf8", stdio: capture ? "pipe" : "inherit" });
  if (result.status !== 0) throw Error("Falha no Docker. Verifique se o serviço está disponível.");
  return result.stdout?.trim();
}
await mkdir(localDirectory, { recursive: true, mode: 0o700 });
await chmod(localDirectory, 0o700);
await mkdir(`${localDirectory}data`, { recursive: true });
await mkdir(`${localDirectory}socket`, { recursive: true, mode: 0o700 });
const existing = docker(["ps", "-a", "--filter", `name=^/${name}$`, "--format", "{{.Names}}"], true);
if (existing) {
  if (docker(["inspect", "--format", '{{index .Config.Labels "pulse.local-directory"}}', name], true) !== localDirectory) throw Error("Container existente não pertence a este projeto.");
  docker(["start", name]);
} else {
  docker(["run", "-d", "--name", name, "--network", "none", "--label", `pulse.local-directory=${localDirectory}`, "--mount", `type=bind,source=${localDirectory}data,target=/var/lib/postgresql/data`, "--mount", `type=bind,source=${localDirectory}socket,target=/var/run/postgresql`, "-e", "POSTGRES_USER=pulse", "-e", "POSTGRES_DB=pulse", "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24", "postgres", "-c", "listen_addresses=", "-c", "unix_socket_permissions=0777"]);
}
let ready = false;
for (let attempt = 0; attempt < 30; attempt++) {
  const result = spawnSync("docker", ["exec", name, "pg_isready", "-U", "pulse", "-d", "pulse"], { stdio: "ignore" });
  if (result.status === 0) { ready = true; break; }
  await new Promise(resolve => setTimeout(resolve, 500));
}
if (!ready) throw Error("PostgreSQL não iniciou a tempo.");
await writeFile(`${localDirectory}enabled`, "PostgreSQL local; não publicar este diretório.\n", { mode: 0o600 });
const db = getDatabase(developmentDatabaseEnv());
try {
  await initializeDatabase(db);
  const result = await db.query("SELECT count(*)::int AS count FROM products");
  console.log(`PostgreSQL local conectado: ${result.rows[0].count} produtos. Dados persistentes, rede desabilitada, sem portas públicas.`);
} finally { await db.close(); }
