import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { developmentDatabaseEnv, localDirectory } from "../dev/database.mjs";
import { getDatabase, initializeDatabase } from "../server/db.js";

test("PostgreSQL local: persistência após reiniciar, transações e isolamento de produção", async () => {
  const env = developmentDatabaseEnv({});
  assert.ok(env.DATABASE_URL, "Execute npm run db:local antes deste teste.");
  assert.equal(developmentDatabaseEnv({ NODE_ENV: "production" }).DATABASE_URL, undefined);
  assert.equal(developmentDatabaseEnv({ VERCEL: "1" }).DATABASE_URL, undefined);
  assert.equal(developmentDatabaseEnv({ DATABASE_URL: "postgresql://external/db" }).DATABASE_URL, "postgresql://external/db");
  const db = getDatabase(env);
  const key = `persistence-check-${randomUUID()}`;
  const name = `pulse-db-${createHash("sha256").update(localDirectory).digest("hex").slice(0, 12)}`;
  try {
    const before = (await db.query("SELECT count(*)::int AS count FROM products")).rows[0].count;
    await initializeDatabase(db);
    assert.equal((await db.query("SELECT count(*)::int AS count FROM products")).rows[0].count, before);
    await assert.rejects(db.transaction(async tx => {
      await tx.query("INSERT INTO rate_limits(key,hits,expires_at) VALUES($1,1,NOW()+interval '1 hour')", [key]);
      throw Error("rollback-test");
    }), /rollback-test/);
    assert.equal((await db.query("SELECT key FROM rate_limits WHERE key=$1", [key])).rows.length, 0);
    await db.query("INSERT INTO rate_limits(key,hits,expires_at) VALUES($1,7,NOW()+interval '1 hour')", [key]);
  } finally { await db.close(); }
  assert.equal(spawnSync("docker", ["restart", name], { stdio: "ignore" }).status, 0);
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL, ssl: false });
  try {
    let ready = false;
    for (let i = 0; i < 30; i++) {
      try { await pool.query("SELECT 1"); ready = true; break; }
      catch { await new Promise(resolve => setTimeout(resolve, 500)); }
    }
    assert.ok(ready, "PostgreSQL deve voltar após restart.");
    assert.equal((await pool.query("SELECT hits FROM rate_limits WHERE key=$1", [key])).rows[0]?.hits, 7);
    await pool.query("DELETE FROM rate_limits WHERE key=$1", [key]);
    const info = JSON.parse(spawnSync("docker", ["inspect", "--format", "{{json .HostConfig}}", name], { encoding: "utf8" }).stdout);
    assert.equal(info.NetworkMode, "none");
    assert.deepEqual(info.PortBindings || {}, {});
  } finally { await pool.end(); }
});
