// O catálogo já está no HTML antes de o JavaScript iniciar.
// Os mesmos dados e cards são usados pela filtragem no navegador.
import { readFile, writeFile } from "node:fs/promises";
import { products } from "../js/products.js";
import { renderProductCards } from "../js/catalog.js";
const file = new URL("../index.html", import.meta.url);
const html = await readFile(file, "utf8");
const next = html.replace(
  /(<div id="product-grid" class="product-grid">)[\s\S]*?(<\/div>\s*<div id="empty-results")/,
  `$1${renderProductCards(products)}$2`,
);
if (next === html && !html.includes('data-id="whey"'))
  throw new Error("Container de catálogo não encontrado");
await writeFile(file, next);
