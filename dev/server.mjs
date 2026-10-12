import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { createHandler } from "../server/app.js";
import { getDatabase } from "../server/db.js";
import { developmentDatabaseEnv } from "./database.mjs";
const env = developmentDatabaseEnv();
const handler = createHandler({ database: getDatabase(env), env });
const root = resolve(new URL("..", import.meta.url).pathname),
  port = Number(process.env.PORT || 8000);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
};
http
  .createServer(async (req, res) => {
    if (req.url.startsWith("/api/")) return handler(req, res);
    try {
      const url = new URL(req.url, "http://localhost");
      let path = decodeURIComponent(url.pathname);
      if (path === "/") path = "/index.html";
      if (!extname(path)) path += ".html";
      if (
        !/^\/(index|admin|checkout|pedido|pedidos|privacidade)\.html$/.test(
          path,
        ) &&
        !/^\/(assets|css|js)\//.test(path)
      )
        throw Error();
      const file = resolve(root, "." + path);
      if (!file.startsWith(root + "/") || !(await stat(file)).isFile())
        throw Error();
      res.setHeader(
        "Content-Type",
        types[extname(file)] || "application/octet-stream",
      );
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.end(await readFile(file));
    } catch {
      res.statusCode = 404;
      res.end("Página não encontrada");
    }
  })
  .listen(port, "0.0.0.0", () =>
    console.log(
      `PULSE: servidor iniciado na porta ${port}. Banco conectado quando configurado. Login e pagamentos exigem as variáveis seguras.`,
    ),
  );
