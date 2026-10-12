import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
export const localDirectory = fileURLToPath(new URL("../.local-db/", import.meta.url));
export function developmentDatabaseEnv(env = process.env) {
  if (env.DATABASE_URL || env.NODE_ENV === "production" || env.VERCEL || !existsSync(`${localDirectory}enabled`)) return env;
  const url = new URL("postgresql://pulse@localhost/pulse");
  url.searchParams.set("host", `${localDirectory}socket`);
  return { ...env, DATABASE_URL: url.toString() };
}
