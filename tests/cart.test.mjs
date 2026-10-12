import test from "node:test";
import assert from "node:assert/strict";
import { Cart, normalize, CART_KEY } from "../js/cart.js";
import { products } from "../js/products.js";
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => store.get(k) || null,
  setItem: (k, v) => store.set(k, v),
};
globalThis.window = new EventTarget();
test("carrinho valida entradas, variações, quantidades, total e persistência", () => {
  store.clear();
  const cart = new Cart(),
    p = products[0];
  assert.equal(cart.add(p.id, p.variants[0], 0), false);
  assert.equal(cart.add(p.id, "inválida", 1), false);
  assert.equal(cart.add(p.id, p.variants[0], 1.5), false);
  assert.equal(cart.add(p.id, p.variants[0], 2), true);
  cart.add(p.id, p.variants[1], 1);
  assert.equal(cart.count, 3);
  assert.equal(cart.total, 44970);
  assert.equal(new Cart().total, 44970);
  assert.equal(cart.set(0, NaN), false);
  cart.set(0, 3);
  assert.equal(cart.total, 59960);
  cart.remove(0);
  assert.equal(cart.total, 14990);
  assert.match(cart.summary(), /Baunilha/);
  assert.match(cart.summary(), /Não é confirmação/);
  cart.remove(0);
  assert.equal(cart.total, 0);
});
test("dados corrompidos ou manipulados são normalizados", () => {
  store.set(CART_KEY, "{broken");
  assert.deepEqual(new Cart().items, []);
  const p = products[0];
  assert.deepEqual(
    normalize([
      { id: "fake", qty: 2 },
      { id: p.id, variant: p.variants[0], qty: -1 },
      { id: p.id, variant: p.variants[0], qty: 200, price: 1 },
      { id: p.id, variant: p.variants[0], qty: 3 },
    ]),
    [{ id: p.id, variant: p.variants[0], qty: 99 }],
  );
});
test("armazenamento indisponível não interrompe a sessão", () => {
  globalThis.localStorage = {
    getItem() {
      throw Error("blocked");
    },
    setItem() {
      throw Error("blocked");
    },
  };
  const cart = new Cart();
  assert.equal(cart.add(products[0].id, products[0].variants[0]), true);
  assert.equal(cart.total, 14990);
});

test("não descarta quantidades excedentes nem remove índices inválidos", () => {
  const cart = new Cart();
  const p = products[0];
  cart.add(p.id, p.variants[0], 98);
  assert.equal(cart.add(p.id, p.variants[0], 2), false);
  assert.equal(cart.count, 98);
  assert.equal(cart.add(p.id, p.variants[0], 1), true);
  assert.equal(cart.count, 99);
  assert.equal(cart.remove(-1), false);
  assert.equal(cart.remove(0.5), false);
  assert.equal(cart.remove(10), false);
  assert.equal(cart.count, 99);
});

test("estoque real limita adições sem modificar a quantidade solicitada", () => {
  const product = products[0],
    demo = product.demonstrative,
    stock = product.variantStock;
  try {
    product.demonstrative = false;
    product.variantStock = { [product.variants[0]]: 2 };
    const cart = new Cart();
    assert.equal(cart.add(product.id, product.variants[0], 3), false);
    assert.equal(cart.lastError, "STOCK_LIMIT");
    assert.equal(cart.add(product.id, product.variants[0], 2), true);
    assert.equal(cart.add(product.id, product.variants[0], 1), false);
    assert.equal(cart.set(0, 3), false);
    assert.equal(cart.count, 2);
  } finally {
    product.demonstrative = demo;
    product.variantStock = stock;
  }
});
