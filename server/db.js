import pg from "pg";
import { readFile } from "node:fs/promises";
import { products } from "../js/products.js";
let shared;
export function getDatabase(env = process.env) {
  if (!env.DATABASE_URL) return null;
  if (shared) return shared;
  const url = new URL(env.DATABASE_URL);
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("DATABASE_URL deve usar PostgreSQL");
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(
    url.hostname,
  );
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
    url.searchParams.delete(key);
  const pool = new pg.Pool({
    connectionString: url.toString(),
    ssl: local
      ? false
      : {
          rejectUnauthorized: true,
          ...(env.DATABASE_CA_CERT ? { ca: env.DATABASE_CA_CERT } : {}),
        },
    max: 3,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 15000,
  });
  shared = {
    query: (sql, args) => pool.query(sql, args),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const value = await fn(client);
        await client.query("COMMIT");
        return value;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
  return shared;
}
export async function initializeDatabase(db) {
  const schema = await readFile(
    new URL("../db/schema.sql", import.meta.url),
    "utf8",
  );
  await db.transaction(async (tx) => {
    for (const statement of schema
      .split(";")
      .map((v) => v.trim())
      .filter(Boolean))
      await tx.query(statement);
    for (const p of products)
      await tx.query(
        `INSERT INTO products(id,name,brand,category,description,label,image_url,tag,variants) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) ON CONFLICT(id) DO NOTHING`,
        [
          p.id,
          p.name,
          p.brand,
          p.category,
          p.description,
          p.label,
          `assets/product-${p.image}.webp`,
          p.tag,
          JSON.stringify(
            p.variants.map((name) => ({ name, price: p.price, stock: 0 })),
          ),
        ],
      );
  });
}
