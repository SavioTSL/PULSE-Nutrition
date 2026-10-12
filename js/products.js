export const categories = [
  "Whey Protein",
  "Creatina",
  "Pré-treino",
  "Vitaminas e minerais",
  "Barras proteicas",
  "Acessórios fitness",
];
export const products = [
  {
    id: "whey",
    name: "Whey Essential",
    category: categories[0],
    price: 14990,
    variants: ["Chocolate · 900 g", "Baunilha · 900 g", "Morango · 900 g"],
    image: 0,
    label:
      "Proteína em pó. Porção ilustrativa: 30 g. Contém leite e derivados.",
    tag: "Seleção da casa",
  },
  {
    id: "creatine",
    name: "Creatina Pure",
    category: categories[1],
    price: 8990,
    variants: ["Sem sabor · 300 g", "Sem sabor · 150 g"],
    image: 1,
    label: "Creatina em pó. Embalagem e composição ilustrativas.",
    tag: "Essencial",
  },
  {
    id: "pre",
    name: "Pre Workout Focus",
    category: categories[2],
    price: 11990,
    variants: ["Frutas vermelhas · 300 g", "Limão · 300 g"],
    image: 2,
    label:
      "Pré-treino demonstrativo com cafeína. Não indicado para crianças, gestantes ou pessoas sensíveis à cafeína.",
    tag: "Na sua rotina",
  },
  {
    id: "vits",
    name: "Daily Vitamins",
    category: categories[3],
    price: 5990,
    variants: ["60 cápsulas"],
    image: 3,
    label:
      "Mix ilustrativo de vitaminas e minerais. Consulte orientação profissional para uso.",
    tag: "Dia a dia",
  },
  {
    id: "bar",
    name: "Protein Bar Crunch",
    category: categories[4],
    price: 1290,
    variants: ["Chocolate · 45 g", "Cookies · 45 g"],
    image: 4,
    label:
      "Barra proteica ilustrativa. Contém leite, soja e pode conter castanhas.",
    tag: "Prático",
  },
  {
    id: "shaker",
    name: "Shaker Pulse",
    category: categories[5],
    price: 3990,
    variants: ["Preto · 600 ml", "Verde · 600 ml"],
    image: 5,
    label: "Acessório demonstrativo. Capacidade ilustrativa: 600 ml.",
    tag: "Seu próximo treino",
  },
  {
    id: "isolate",
    name: "Whey Isolate Studio",
    category: categories[0],
    price: 19990,
    variants: ["Chocolate · 900 g", "Baunilha · 900 g"],
    image: 0,
    label: "Proteína isolada ilustrativa. Contém leite e derivados.",
    tag: "Destaque",
  },
  {
    id: "kit",
    name: "Protein Bar Box",
    category: categories[4],
    price: 10990,
    variants: ["Chocolate · 12 unidades", "Cookies · 12 unidades"],
    image: 4,
    label: "Caixa demonstrativa com 12 barras de 45 g. Contém leite e soja.",
    tag: "Para levar",
  },
].map((p) => ({
  ...p,
  demonstrative: true,
  brand: "PULSE Nutrition",
  description:
    "Uma escolha para compor a sua rotina. Produto fictício da coleção PULSE, com preço, embalagem e informações de rótulo exclusivamente ilustrativos. Não disponível para compra real.",
}));
export const money = (cents) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );

export const priceFor = (product, variant) =>
  product.variantPrices?.[variant] ?? product.price;

// Catálogo público em cache preserva o carrinho de SKUs criados no painel.
// Valores do navegador nunca são usados como autoridade para a cobrança.
export function replaceProducts(records) {
  if (!Array.isArray(records) || records.length > 1000)
    throw new Error("Catálogo inválido.");
  const validated = records.filter(
    (p) =>
      typeof p.id === "string" &&
      /^[a-z0-9][a-z0-9_-]{0,59}$/.test(p.id) &&
      typeof p.name === "string" &&
      typeof p.brand === "string" &&
      typeof p.description === "string" &&
      categories.includes(p.category) &&
      Number.isInteger(p.price) &&
      p.price >= 0 &&
      p.price <= 10000000 &&
      Array.isArray(p.variants) &&
      p.variants.length > 0 &&
      p.variants.length <= 20 &&
      p.variants.every((v) => typeof v === "string" && v.length <= 100) &&
      typeof p.imageUrl === "string" &&
      (/^assets\/[a-zA-Z0-9/_.-]+\.(webp|png|jpe?g|svg)$/.test(p.imageUrl) ||
        /^https:\/\//.test(p.imageUrl)),
  );
  if (validated.length !== records.length)
    throw new Error("Catálogo inválido.");
  products.splice(0, products.length, ...validated);
  if (typeof window !== "undefined")
    try {
      localStorage.setItem("pulse-products-v1", JSON.stringify(validated));
    } catch {}
}
if (typeof window !== "undefined")
  try {
    const cached = JSON.parse(
      localStorage.getItem("pulse-products-v1") || "null",
    );
    if (cached) replaceProducts(cached);
  } catch {}
