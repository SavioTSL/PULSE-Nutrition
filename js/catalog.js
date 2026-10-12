import { money } from "./products.js";
export const imagePath = (image) =>
  `assets/product-${image}.${image === 0 || image === 1 ? "webp" : "svg"}`;
const asset = (p) => imagePath(p.image);
export const renderProductCards = (list, favorites = []) =>
  list
    .map(
      (p) =>
        `<article class="product-card" data-id="${p.id}"><div class="product-visual"><button data-detail="${p.id}" aria-label="Ver detalhes de ${p.name}"><img src="${asset(p)}" alt="Embalagem ilustrativa ${p.name}" width="400" height="400" loading="lazy"></button><span class="product-tag">${p.tag}</span><button class="icon-btn favorite-btn" data-favorite="${p.id}" aria-label="${favorites.includes(p.id) ? "Remover" : "Adicionar"} ${p.name} ${favorites.includes(p.id) ? "dos" : "aos"} favoritos" aria-pressed="${favorites.includes(p.id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg></button></div><div class="product-info"><p class="brand">PULSE NUTRITION · DEMO</p><h3>${p.name}</h3><p class="product-category">${p.category}</p><div class="price">${money(p.price)}</div><small>Preço ilustrativo</small><div class="card-bottom"><select aria-label="Variação de ${p.name}" data-variant>${p.variants.map((v) => `<option>${v}</option>`).join("")}</select><button class="add-btn" data-add="${p.id}" aria-label="Adicionar ${p.name} ao carrinho">+</button></div><button class="details-btn" data-detail="${p.id}">Ver detalhes <span>↗</span></button></div></article>`,
    )
    .join("");
