import { escapeHTML } from "./safe.js";
import { money } from "./products.js";
export const imagePath = (image) => `assets/product-${image}.webp`;
export const imageSources = (image) =>
  `assets/product-${image}-320.webp 320w, assets/product-${image}-640.webp 640w`;
export const productImage = (p) => p.imageUrl || imagePath(p.image);
const asset = productImage;
export const renderProductCards = (list, favorites = []) =>
  list
    .map(
      (p) =>
        `<article class="product-card" data-id="${escapeHTML(p.id)}"><div class="product-visual"><button data-detail="${escapeHTML(p.id)}" aria-label="Ver detalhes de ${escapeHTML(p.name)}"><img src="${escapeHTML(asset(p))}" srcset="${p.imageUrl && !/^assets\/product-[0-5]\.webp$/.test(p.imageUrl) ? "" : imageSources(p.image)}" sizes="(max-width:700px) 45vw, (max-width:1050px) 30vw, 23vw" decoding="async" alt="Embalagem ilustrativa ${escapeHTML(p.name)}" width="400" height="400" loading="lazy"></button><span class="product-tag">${escapeHTML(p.tag)}</span><button class="icon-btn favorite-btn" data-favorite="${escapeHTML(p.id)}" aria-label="${favorites.includes(p.id) ? "Remover" : "Adicionar"} ${escapeHTML(p.name)} ${favorites.includes(p.id) ? "dos" : "aos"} favoritos" aria-pressed="${favorites.includes(p.id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg></button></div><div class="product-info"><p class="brand">${escapeHTML(p.brand)}${p.demonstrative !== false ? " · DEMO" : ""}</p><h3>${escapeHTML(p.name)}</h3><p class="product-category">${escapeHTML(p.category)}</p><div class="price">${money(p.price)}</div><small>${p.demonstrative !== false ? "Preço ilustrativo" : "Preço à vista"}</small><div class="card-bottom"><select aria-label="Variação de ${escapeHTML(p.name)}" data-variant>${p.variants.map((v) => `<option>${escapeHTML(v)}</option>`).join("")}</select><button class="add-btn" data-add="${escapeHTML(p.id)}" aria-label="Adicionar ${escapeHTML(p.name)} ao carrinho">+</button></div><button class="details-btn" data-detail="${escapeHTML(p.id)}">Ver detalhes <span>↗</span></button></div></article>`,
    )
    .join("");
