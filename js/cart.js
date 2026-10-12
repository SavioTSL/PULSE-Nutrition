import { products, money, priceFor } from "./products.js";
export const CART_KEY = "pulse-cart-v1";
export function safeRead(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
export function persist(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function normalize(items) {
  if (!Array.isArray(items)) return [];
  const result = [];
  for (const item of items) {
    const p = products.find((p) => p.id === item?.id);
    if (
      !p ||
      !p.variants.includes(item.variant) ||
      !Number.isInteger(item.qty) ||
      item.qty < 1
    )
      continue;
    const existing = result.find(
      (x) => x.id === p.id && x.variant === item.variant,
    );
    if (existing) existing.qty = Math.min(99, existing.qty + item.qty);
    else
      result.push({
        id: p.id,
        variant: item.variant,
        qty: Math.min(99, item.qty),
      });
  }
  return result;
}
export class Cart {
  constructor() {
    this.items = normalize(safeRead(CART_KEY, []));
  }
  save() {
    const stored = persist(CART_KEY, this.items);
    this.persisted = stored;
    window.dispatchEvent(new CustomEvent("cartchange", { detail: { stored } }));
  }
  add(id, variant, qty = 1) {
    this.lastError = null;
    const p = products.find((p) => p.id === id);
    if (
      !p ||
      !p.variants.includes(variant) ||
      !Number.isInteger(qty) ||
      qty < 1 ||
      qty > 99
    )
      return false;
    const item = this.items.find((i) => i.id === id && i.variant === variant);
    if (item && item.qty + qty > 99) {
      this.lastError = "QUANTITY_LIMIT";
      return false;
    }
    if (
      p.demonstrative === false &&
      Number.isInteger(p.variantStock?.[variant]) &&
      (item?.qty || 0) + qty > p.variantStock[variant]
    ) {
      this.lastError = "STOCK_LIMIT";
      return false;
    }
    if (item) item.qty += qty;
    else this.items.push({ id, variant, qty });
    this.save();
    return true;
  }
  set(index, qty) {
    if (!this.items[index] || !Number.isInteger(qty) || qty < 1 || qty > 99)
      return false;
    const current = this.items[index],
      p = products.find((p) => p.id === current.id);
    if (
      p.demonstrative === false &&
      Number.isInteger(p.variantStock?.[current.variant]) &&
      qty > p.variantStock[current.variant]
    ) {
      this.lastError = "STOCK_LIMIT";
      return false;
    }
    this.items[index].qty = qty;
    this.save();
    return true;
  }
  remove(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.items.length)
      return false;
    this.items.splice(index, 1);
    this.save();
    return true;
  }
  get count() {
    return this.items.reduce((sum, i) => sum + i.qty, 0);
  }
  get total() {
    return this.items.reduce(
      (sum, i) =>
        sum +
        priceFor(
          products.find((p) => p.id === i.id),
          i.variant,
        ) *
          i.qty,
      0,
    );
  }
  summary() {
    const demo = this.items.some(
      (item) => products.find((p) => p.id === item.id)?.demonstrative !== false,
    );
    return (
      `PULSE Nutrition — solicitação de orçamento${demo ? " demonstrativo" : ""}\n\n` +
      this.items
        .map((i) => {
          const p = products.find((p) => p.id === i.id);
          return `${i.qty} × ${p.name} (${i.variant}) — ${money(priceFor(p, i.variant) * i.qty)}`;
        })
        .join("\n") +
      `\n\nSubtotal${demo ? " ilustrativo" : ""}: ${money(this.total)}\nFrete e disponibilidade a consultar. Não é confirmação de pedido ou pagamento.`
    );
  }
}
