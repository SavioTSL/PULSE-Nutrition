import { api, escapeHTML } from "./safe.js";
import {
  imagePath,
  imageSources,
  productImage,
  renderProductCards,
} from "./catalog.js";
import {
  products,
  categories,
  money,
  priceFor,
  replaceProducts,
} from "./products.js";
import { Cart, safeRead, persist, normalize } from "./cart.js";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const icons = {
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  heart:
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  bag: '<path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  message:
    '<path d="M21 11.5a9 9 0 0 1-9 9 10 10 0 0 1-4-.8L3 21l1.3-4.8A9 9 0 1 1 21 11.5Z"/><path d="M8 10h8M8 14h5"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.bag}</svg>`;
function hydrate() {
  $$("[data-icon]").forEach((el) => {
    el.innerHTML = icon(el.dataset.icon);
  });
}
hydrate();
const cart = new Cart(),
  favoriteKey = "pulse-favorites-v1";
let favorites = safeRead(favoriteKey, []);
favorites = Array.isArray(favorites)
  ? [...new Set(favorites.filter((id) => products.some((p) => p.id === id)))]
  : [];
let category = "all",
  onlyFavorites = false,
  toastTimer;
const selectedVariants = new Map();
let loadingStore = true;
function toast(message) {
  const dialog = $("dialog[open]");
  let target = $("#toast");
  if (dialog) {
    target = dialog.querySelector(".dialog-feedback");
    if (!target) {
      target = document.createElement("div");
      target.className = "dialog-feedback";
      target.setAttribute("role", "status");
      target.setAttribute("aria-live", "polite");
      dialog.append(target);
    }
    $("#toast").classList.remove("visible");
  }
  target.textContent = message;
  target.hidden = false;
  target.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    target.classList.remove("visible");
    if (target.classList.contains("dialog-feedback")) target.hidden = true;
  }, 4500);
}
function cartMessage(message) {
  return cart.persisted === false
    ? `${message} Armazenamento indisponível: salvo apenas nesta sessão.`
    : message;
}
const normalizeSearch = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const asset = productImage;
const inStock = (p, variant) =>
  p.demonstrative !== false ||
  !Number.isInteger(p.variantStock?.[variant]) ||
  p.variantStock[variant] > 0;
function updateCardStock(card, p) {
  const ready = inStock(p, card.querySelector("[data-variant]").value);
  card.querySelector("[data-add]").disabled = loadingStore || !ready;
  card
    .querySelectorAll("[data-detail]")
    .forEach((button) => (button.disabled = loadingStore));
  if (p.demonstrative === false)
    card.querySelector(".product-info small").textContent = ready
      ? "Preço à vista · disponível"
      : "Indisponível no momento";
}
$("#category-grid").innerHTML = categories
  .map(
    (c, i) =>
      `<button class="category-card" data-category="${i}"><img src="${imagePath(i)}" srcset="${imageSources(i)}" sizes="(max-width:1050px) 28vw, 14vw" decoding="async" alt="" loading="lazy" width="160" height="160"><span>${c}</span><b>↗</b></button>`,
  )
  .join("");
$("#filter-chips").innerHTML = ["Todos", ...categories]
  .map(
    (c, i) =>
      `<button data-filter="${i - 1}" class="${i === 0 ? "active" : ""}" aria-pressed="${i === 0}">${c}</button>`,
  )
  .join("");
function renderProducts() {
  $$(".product-card").forEach((card) =>
    selectedVariants.set(
      card.dataset.id,
      card.querySelector("[data-variant]").value,
    ),
  );
  const terms = normalizeSearch($("#search").value).split(" ").filter(Boolean);
  let list = products.filter(
    (p) =>
      (category === "all" || p.category === category) &&
      p.price <= Number($("#price").value) * 100 &&
      (!onlyFavorites || favorites.includes(p.id)) &&
      terms.every((term) =>
        normalizeSearch(`${p.name} ${p.category} ${p.brand}`).includes(term),
      ),
  );
  const sort = $("#sort").value;
  if (sort === "price-up") list.sort((a, b) => a.price - b.price);
  if (sort === "price-down") list.sort((a, b) => b.price - a.price);
  if (sort === "name")
    list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  $("#result-count").textContent =
    `${list.length} produto${list.length === 1 ? "" : "s"}${onlyFavorites ? " favorito" + (list.length === 1 ? "" : "s") : ""}`;
  $("#price-output").textContent = money(Number($("#price").value) * 100);
  $("#favorites-toggle").setAttribute("aria-pressed", String(onlyFavorites));
  $$("#filter-chips button").forEach((b) => {
    const active =
      Number(b.dataset.filter) === -1
        ? category === "all"
        : categories[Number(b.dataset.filter)] === category;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
  });
  $("#empty-results").hidden = list.length > 0;
  $("#product-grid").innerHTML = renderProductCards(list, favorites);
  $$(".product-card").forEach((card) => {
    const value = selectedVariants.get(card.dataset.id);
    const select = card.querySelector("[data-variant]");
    if (value && [...select.options].some((option) => option.value === value))
      select.value = value;
    const p = products.find((p) => p.id === card.dataset.id);
    card.querySelector(".price").textContent = money(priceFor(p, select.value));
    updateCardStock(card, p);
  });
}
function reset() {
  category = "all";
  onlyFavorites = false;
  $("#search").value = "";
  $("#price").value = "250";
  $("#sort").value = "featured";
  renderProducts();
}
$("#clear-filters").addEventListener("click", reset);
$("#empty-reset").addEventListener("click", reset);
["search", "price", "sort"].forEach((id) =>
  $("#" + id).addEventListener(
    id === "sort" ? "change" : "input",
    renderProducts,
  ),
);
$("#filter-chips").addEventListener("click", (e) => {
  const b = e.target.closest("[data-filter]");
  if (!b) return;
  category =
    Number(b.dataset.filter) === -1
      ? "all"
      : categories[Number(b.dataset.filter)];
  renderProducts();
});
$("#category-grid").addEventListener("click", (e) => {
  const b = e.target.closest("[data-category]");
  if (!b) return;
  category = categories[Number(b.dataset.category)];
  onlyFavorites = false;
  $("#search").value = "";
  $("#price").value = "250";
  renderProducts();
  $("#catalogo").scrollIntoView({
    behavior: motion.matches ? "auto" : "smooth",
  });
});
$("#favorites-toggle").addEventListener("click", () => {
  onlyFavorites = !onlyFavorites;
  category = "all";
  $("#search").value = "";
  $("#price").value = "250";
  renderProducts();
  $("#catalogo").scrollIntoView({
    behavior: motion.matches ? "auto" : "smooth",
  });
});
$("#search-toggle").addEventListener("click", () => {
  $("#catalogo").scrollIntoView({ behavior: "auto" });
  $("#search").focus();
});
const dialogTriggers = new WeakMap();
function openDialog(d) {
  if (d.open) return;
  const previous = $("dialog[open]");
  const trigger = previous
    ? dialogTriggers.get(previous)
    : document.activeElement;
  if (previous) previous.close();
  dialogTriggers.set(d, trigger);
  d.querySelector(".dialog-feedback")?.remove();
  $("#header").classList.remove("away");
  d.showModal();
  document.body.classList.add("modal-open");
  pauseTimer();
}
$$("dialog").forEach((d) => {
  d.addEventListener("close", () => {
    const anyOpen = $$("dialog").some((dialog) => dialog.open);
    document.body.classList.toggle("modal-open", anyOpen);
    if (!anyOpen) {
      const trigger = dialogTriggers.get(d);
      (trigger?.isConnected ? trigger : $("#cart-open")).focus({
        preventScroll: true,
      });
      schedule();
    }
  });
  d.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) d.close();
    else if (e.target === d) {
      const rect = d.getBoundingClientRect();
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      )
        d.close();
    }
  });
});
function detail(id) {
  const p = products.find((p) => p.id === id);
  if (!p) return;
  $("#product-detail").innerHTML =
    `<div class="product-detail-grid"><div class="detail-gallery"><img id="gallery-main" src="${escapeHTML(asset(p))}" alt="${escapeHTML(p.name)}, vista da embalagem ilustrativa" width="500" height="500"><div class="gallery-thumbs"><button data-view="front" aria-label="Vista da embalagem" aria-pressed="true"><img src="${escapeHTML(asset(p))}" alt=""></button><button data-view="back" aria-label="Ver rótulo demonstrativo" aria-pressed="false"><img src="assets/product-label.svg" alt=""></button><button data-view="zoom" aria-label="Ampliar embalagem" aria-pressed="false"><img src="${escapeHTML(asset(p))}" alt=""></button></div></div><div class="detail-copy"><p class="eyebrow">${escapeHTML(p.brand)}${p.demonstrative !== false ? " · PRODUTO DEMONSTRATIVO" : ""}</p><h2 id="detail-title">${escapeHTML(p.name)}</h2><div class="price">${money(p.price)}</div><p>${escapeHTML(p.description)}</p><label for="detail-variant">Escolha sua variação</label><select id="detail-variant">${p.variants.map((v) => `<option>${escapeHTML(v)}</option>`).join("")}</select><label for="detail-qty">Quantidade</label><div class="qty-control"><button id="qty-minus" aria-label="Diminuir quantidade">−</button><input id="detail-qty" type="number" min="1" max="99" value="1" inputmode="numeric"><button id="qty-plus" aria-label="Aumentar quantidade">+</button></div><button id="detail-add" class="button dark">Adicionar à seleção +</button><button id="detail-view-cart" class="button lime" hidden>Ver carrinho ↗</button><div class="label-info"><strong>Informações ilustrativas do rótulo</strong><p>${escapeHTML(p.label)}</p><p>Não é recomendação de consumo. Consulte orientação profissional. Imagens demonstrativas; tamanho e sabor não alteram o preço ilustrativo.</p></div></div></div>`;
  const cardVariant = $(`[data-id="${p.id}"] [data-variant]`);
  $("#detail-variant").value =
    cardVariant?.value || selectedVariants.get(p.id) || p.variants[0];
  $("#detail-variant").addEventListener("change", () => {
    selectedVariants.set(p.id, $("#detail-variant").value);
    if (cardVariant) {
      cardVariant.value = $("#detail-variant").value;
      cardVariant.closest(".product-card").querySelector(".price").textContent =
        money(priceFor(p, cardVariant.value));
    }
    $(".detail-copy .price").textContent = money(
      priceFor(p, $("#detail-variant").value),
    );
    $("#detail-add").disabled = !inStock(p, $("#detail-variant").value);
    $("#detail-add").disabled = !inStock(p, $("#detail-variant").value);
  });
  $(".detail-copy .price").textContent = money(
    priceFor(p, $("#detail-variant").value),
  );
  $("#detail-add").disabled = !inStock(p, $("#detail-variant").value);
  $("#detail-view-cart").addEventListener("click", () => {
    renderCart();
    openDialog($("#cart-dialog"));
  });
  // Labels em português para leitores de tela.
  $("#gallery-main").alt = `${p.name}, vista da embalagem ilustrativa`;
  $$("[data-view]")[0].ariaLabel = "Vista da embalagem";
  $$("[data-view]")[2].ariaLabel = "Ampliar embalagem";
  $("#detail-add").addEventListener("click", () => {
    const qty = Number($("#detail-qty").value);
    if (!cart.add(p.id, $("#detail-variant").value, qty)) {
      toast(
        cart.lastError === "STOCK_LIMIT"
          ? "A quantidade excede o estoque disponível para esta variação."
          : "Use uma quantidade inteira de 1 a 99, respeitando o limite de 99 por variação no carrinho.",
      );
      $("#detail-qty").focus();
      return;
    }
    $("#detail-view-cart").hidden = false;
    toast(
      cartMessage(
        "Produto adicionado à sua seleção. Abra o carrinho para continuar.",
      ),
    );
  });
  function changeQty(delta) {
    const n = Number($("#detail-qty").value);
    $("#detail-qty").value = String(
      Math.max(1, Math.min(99, (Number.isInteger(n) ? n : 1) + delta)),
    );
  }
  $("#qty-minus").addEventListener("click", () => changeQty(-1));
  $("#qty-plus").addEventListener("click", () => changeQty(1));
  $$("[data-view]").forEach((b) =>
    b.addEventListener("click", () => {
      $("#gallery-main").src =
        b.dataset.view === "back" ? "assets/product-label.svg" : asset(p);
      $("#gallery-main").alt =
        b.dataset.view === "back"
          ? "Rótulo demonstrativo PULSE"
          : `${p.name}, embalagem ilustrativa`;
      $("#gallery-main").style.transform =
        b.dataset.view === "zoom" ? "scale(1.12)" : "none";
      $$("[data-view]").forEach((x) =>
        x.setAttribute("aria-pressed", String(x === b)),
      );
    }),
  );
  let touchStart;
  $(".detail-gallery").addEventListener(
    "touchstart",
    (e) => {
      touchStart = {
        x: e.changedTouches[0].clientX,
        y: e.changedTouches[0].clientY,
      };
    },
    { passive: true },
  );
  $(".detail-gallery").addEventListener(
    "touchend",
    (e) => {
      if (!touchStart) return;
      const dx = e.changedTouches[0].clientX - touchStart.x;
      const dy = e.changedTouches[0].clientY - touchStart.y;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        const active = $('[data-view][aria-pressed="true"]');
        $$("[data-view]")[
          ($$("[data-view]").indexOf(active) + (dx < 0 ? 1 : 2)) % 3
        ].click();
      }
    },
    { passive: true },
  );
  openDialog($("#product-dialog"));
}
$("#product-grid").addEventListener("click", (e) => {
  const favorite = e.target.closest("[data-favorite]"),
    add = e.target.closest("[data-add]"),
    details = e.target.closest("[data-detail]");
  if (favorite) {
    const id = favorite.dataset.favorite;
    const added = !favorites.includes(id);
    favorites = added ? [...favorites, id] : favorites.filter((x) => x !== id);
    const stored = persist(favoriteKey, favorites);
    renderProducts();
    ($(`[data-favorite="${id}"]`) || $("#favorites-toggle")).focus({
      preventScroll: true,
    });
    toast(
      stored
        ? added
          ? "Salvo nos favoritos."
          : "Removido dos favoritos."
        : "Armazenamento indisponível. Favoritos salvos apenas nesta sessão.",
    );
  } else if (add) {
    const added = cart.add(
      add.dataset.add,
      add.closest(".product-card").querySelector("[data-variant]").value,
    );
    toast(
      added
        ? cartMessage("Produto adicionado à sua seleção.")
        : cart.lastError === "STOCK_LIMIT"
          ? "A quantidade excede o estoque disponível para esta variação."
          : "Limite de 99 unidades por produto e variação atingido.",
    );
  } else if (details) detail(details.dataset.detail);
});
function renderCart() {
  $("#cart-count").textContent = String(cart.count);
  $("#cart-open").ariaLabel = `Abrir carrinho com ${cart.count} itens`;
  $("#cart-total").textContent = money(cart.total);
  $("#cart-footer").hidden = cart.items.length === 0;
  $("#cart-items").innerHTML = cart.items.length
    ? cart.items
        .map((item, index) => {
          const p = products.find((p) => p.id === item.id);
          return `<article class="cart-item"><img src="${escapeHTML(asset(p))}" alt="" width="80" height="80"><div><h3>${escapeHTML(p.name)}</h3><p>${escapeHTML(item.variant)}</p><strong>${money(priceFor(p, item.variant) * item.qty)}</strong><div class="cart-item-bottom"><div class="cart-qty"><button data-index="${index}" data-delta="-1" aria-label="Diminuir quantidade de ${escapeHTML(p.name)}" ${item.qty === 1 ? "disabled" : ""}>−</button><span aria-label="Quantidade">${item.qty}</span><button data-index="${index}" data-delta="1" aria-label="Aumentar quantidade de ${escapeHTML(p.name)}" ${item.qty >= Math.min(99, p.demonstrative === false ? (p.variantStock?.[item.variant] ?? 99) : 99) ? "disabled" : ""}>+</button></div><button class="remove-btn" data-remove="${index}" aria-label="Remover ${escapeHTML(p.name)} do carrinho">Remover</button></div></div></article>`;
        })
        .join("")
    : `<div class="empty-state"><h3>Seu carrinho está esperando.</h3><p>Explore o catálogo e encontre seus essenciais.</p><button class="button dark" id="cart-explore">Explorar produtos ↗</button></div>`;
  $("#cart-explore")?.addEventListener("click", () => {
    $("#cart-dialog").close();
    $("#catalogo").scrollIntoView();
  });
  $("#order-summary").hidden = true;
  const phone = window.PULSE_CONFIG?.whatsappNumber || "";
  $("#order-button").textContent = /^[1-9]\d{9,14}$/.test(phone)
    ? "Preparar orçamento no WhatsApp ↗"
    : "Copiar resumo do orçamento ↗";
}
window.addEventListener("cartchange", (e) => {
  renderCart();
  if (!e.detail.stored)
    toast("Armazenamento indisponível. Carrinho salvo apenas nesta sessão.");
});
$("#cart-items").addEventListener("click", (e) => {
  const remove = e.target.closest("[data-remove]"),
    change = e.target.closest("[data-delta]");
  if (remove) {
    const i = Number(remove.dataset.remove);
    cart.remove(i);
    $("[data-remove]")?.focus();
  } else if (change) {
    const i = Number(change.dataset.index),
      delta = Number(change.dataset.delta);
    cart.set(i, cart.items[i].qty + delta);
    $(`[data-index="${i}"][data-delta="${delta}"]`)?.focus();
  }
});
$("#cart-open").addEventListener("click", () => {
  renderCart();
  openDialog($("#cart-dialog"));
});
$("#order-button").addEventListener("click", async () => {
  if (!cart.items.length) return;
  const summary = cart.summary(),
    phone = window.PULSE_CONFIG?.whatsappNumber || "";
  if (/^[1-9]\d{9,14}$/.test(phone)) {
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(summary)}`,
      "_blank",
      "noopener,noreferrer",
    );
    toast("Revise e envie a mensagem no WhatsApp.");
    return;
  }
  try {
    await navigator.clipboard.writeText(summary);
    toast("Resumo copiado. Nenhum pedido foi enviado.");
  } catch {
    $("#order-summary").hidden = false;
    $("#order-summary").value = summary;
    $("#order-summary").focus();
    $("#order-summary").select();
    toast("Selecione e copie o resumo abaixo.");
  }
});
window.addEventListener("storage", (e) => {
  if (e.key === favoriteKey || e.key === null) {
    const value = safeRead(favoriteKey, []);
    favorites = Array.isArray(value)
      ? value.filter((id) => products.some((p) => p.id === id))
      : [];
    renderProducts();
  }
  if (e.key === "pulse-cart-v1" || e.key === null) {
    cart.items = new Cart().items;
    renderCart();
  }
});
const menu = $("#mobile-menu");
function closeMenu() {
  menu.hidden = true;
  $("#menu-toggle").setAttribute("aria-expanded", "false");
  $("#menu-toggle").ariaLabel = "Abrir menu";
}
$("#menu-toggle").addEventListener("click", () => {
  menu.hidden = !menu.hidden;
  $("#menu-toggle").setAttribute("aria-expanded", String(!menu.hidden));
  $("#menu-toggle").ariaLabel = menu.hidden ? "Abrir menu" : "Fechar menu";
});
menu.addEventListener("click", (e) => {
  if (e.target.closest("a")) closeMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !menu.hidden) {
    closeMenu();
    $("#menu-toggle").focus();
  }
});
document.addEventListener("click", (e) => {
  if (
    !menu.hidden &&
    !menu.contains(e.target) &&
    !$("#menu-toggle").contains(e.target)
  )
    closeMenu();
});
window.addEventListener("resize", () => {
  if (innerWidth > 700) closeMenu();
});
$("#header").addEventListener("focusin", () =>
  $("#header").classList.remove("away"),
);
let lastY = scrollY;
window.addEventListener(
  "scroll",
  () => {
    const y = scrollY;
    $("#header").classList.toggle(
      "away",
      y > 180 &&
        y > lastY &&
        !$$("dialog").some((d) => d.open) &&
        menu.hidden &&
        !$("#header").contains(document.activeElement),
    );
    lastY = y;
  },
  { passive: true },
);
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const slides = [
  {
    title: "SUA EVOLUÇÃO<br>COMEÇA <em>AQUI.</em>",
    description:
      "Sua rotina. Seu ritmo. Suas escolhas.<br>Encontre os essenciais para acompanhar você.",
    image: 0,
    name: "WHEY PROTEIN",
  },
  {
    title: "SEU RITMO.<br>SUA <em>ESSÊNCIA.</em>",
    description:
      "Pequenas escolhas fazem parte do dia.<br>Conheça nossa coleção de essenciais.",
    image: 1,
    name: "CREATINA PURE",
  },
  {
    title: "LEVE A ROTINA<br>COM <em>VOCÊ.</em>",
    description:
      "Do treino aos momentos de pausa.<br>Explore escolhas para acompanhar sua rotina.",
    image: 4,
    name: "PROTEIN BAR",
  },
];
let slide = 0,
  paused = motion.matches,
  timer,
  hover = false;
$("#slide-dots").innerHTML = slides
  .map(
    (_, i) =>
      `<button data-slide="${i}" aria-label="Ir para slide ${i + 1}" aria-current="${i === 0}"></button>`,
  )
  .join("");
function showSlide(i) {
  slide = (i + slides.length) % slides.length;
  const s = slides[slide];
  $("#hero-title").innerHTML = s.title;
  $("#hero-description").innerHTML = s.description;
  $("#hero-product").src = imagePath(s.image);
  $("#hero-product").alt = `Embalagem demonstrativa ${s.name}`;
  $("#hero-product-name").textContent = s.name;
  $$("[data-slide]").forEach((b) =>
    b.setAttribute("aria-current", String(Number(b.dataset.slide) === slide)),
  );
  if (!motion.matches)
    $("#hero-product").animate(
      [
        { opacity: 0, transform: "rotate(4deg) translateY(12px)" },
        { opacity: 1, transform: "rotate(7deg) translateY(0)" },
      ],
      { duration: 450 },
    );
  schedule();
}
function pauseTimer() {
  clearTimeout(timer);
}
function schedule() {
  pauseTimer();
  if (
    !paused &&
    !hover &&
    !document.hidden &&
    !$(".hero").contains(document.activeElement) &&
    !$$("dialog").some((d) => d.open)
  )
    timer = setTimeout(() => showSlide(slide + 1), 6500);
}
function updatePause() {
  $("#slide-pause").innerHTML = paused
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg>';
  $("#slide-pause").ariaLabel = paused
    ? "Retomar slides automáticos"
    : "Pausar slides automáticos";
  schedule();
}
$("#slide-prev").addEventListener("click", () => showSlide(slide - 1));
$("#slide-next").addEventListener("click", () => showSlide(slide + 1));
$("#slide-pause").addEventListener("click", () => {
  paused = !paused;
  updatePause();
});
$("#slide-dots").addEventListener("click", (e) => {
  const b = e.target.closest("[data-slide]");
  if (b) showSlide(Number(b.dataset.slide));
});
$(".hero").addEventListener("mouseenter", () => {
  hover = true;
  pauseTimer();
});
$(".hero").addEventListener("mouseleave", () => {
  hover = false;
  schedule();
});
$(".hero").addEventListener("focusin", pauseTimer);
$(".hero").addEventListener("focusout", schedule);
document.addEventListener("visibilitychange", schedule);
motion.addEventListener("change", () => {
  paused = motion.matches;
  updatePause();
});
$("#privacy-open").addEventListener("click", () =>
  openDialog($("#privacy-dialog")),
);
$("#clear-data").addEventListener("click", () => {
  favorites = [];
  persist(favoriteKey, []);
  cart.items = [];
  cart.save();
  try {
    localStorage.removeItem("pulse-orders-v1");
  } catch {}
  renderProducts();
  toast("Carrinho, favoritos e acesso aos pedidos apagados deste navegador.");
});
const endpoint = window.PULSE_CONFIG?.newsletterEndpoint || "";
if (!endpoint) {
  $("#email").disabled = true;
  $("#newsletter-form button").disabled = true;
  $("#email").placeholder = "Newsletter em breve — demonstração";
  $("#newsletter-form").ariaLabel =
    "Newsletter indisponível nesta demonstração";
} else
  $("#newsletter-note").textContent =
    "Seu e-mail será enviado ao serviço de newsletter configurado.";
$("#newsletter-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!endpoint) return;
  const button = $("#newsletter-form button");
  button.disabled = true;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") throw new Error("HTTPS obrigatório");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: $("#email").value }),
    });
    if (!res.ok) throw new Error("Falha");
    toast("Inscrição enviada ao serviço configurado.");
    $("#newsletter-form").reset();
  } catch {
    toast("Não foi possível enviar. Tente novamente mais tarde.");
  } finally {
    button.disabled = false;
  }
});
if ("IntersectionObserver" in window && !motion.matches) {
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          observer.unobserve(e.target);
        }
      }),
    { threshold: 0.12 },
  );
  $$(".reveal").forEach((el) => {
    el.classList.add("is-pending");
    observer.observe(el);
  });
}
renderProducts();
renderCart();
updatePause();

$("#product-grid").addEventListener("change", (event) => {
  const select = event.target.closest("[data-variant]");
  if (!select) return;
  const card = select.closest(".product-card"),
    p = products.find((p) => p.id === card.dataset.id);
  selectedVariants.set(p.id, select.value);
  card.querySelector(".price").textContent = money(priceFor(p, select.value));
  updateCardStock(card, p);
});
async function loadStore() {
  try {
    const status = await api("status");
    window.PULSE_STORE_STATUS = status;
    if (status.whatsapp)
      window.PULSE_CONFIG = {
        ...window.PULSE_CONFIG,
        whatsappNumber: status.whatsapp,
      };
    if (status.databaseReady) {
      const data = await api("products");
      replaceProducts(data.products);
      cart.items = normalize(safeRead("pulse-cart-v1", []));
      renderProducts();
      renderCart();
    }
    if (status.checkoutEnabled) {
      $("#purchase-notice").textContent = status.sandbox
        ? "Pagamentos em ambiente de teste do Mercado Pago."
        : "Pix e cartão pelo Mercado Pago. Confira seu pedido antes de pagar.";
      $(".announcement").textContent = status.sandbox
        ? "PULSE NUTRITION · AMBIENTE DE TESTES DE PAGAMENTO"
        : "PULSE NUTRITION · PIX E CARTÃO PELO MERCADO PAGO";
      $(".subtotal span").textContent = "Subtotal";
      const about = $$("#sobre p:not(.eyebrow)");
      if (about[1])
        about[1].textContent =
          "O catálogo é gerenciado pela loja. Confira informações, variações e disponibilidade antes de finalizar seu pedido.";
      const questions = $$("#faq details");
      if (questions[0])
        questions[0].querySelector("p").textContent = status.sandbox
          ? "O checkout está no ambiente de testes do Mercado Pago, sem cobranças reais. Produtos demonstrativos não podem ser enviados para pagamento."
          : "Produtos reais com estoque podem ser comprados pelo checkout do Mercado Pago. Produtos marcados como demonstrativos não recebem cobranças.";
      if (questions[1]) {
        questions[1].querySelector("summary").textContent =
          "Como finalizo meu pedido?";
        questions[1].querySelector("p").textContent =
          "Monte seu carrinho, clique em continuar para finalizar, informe seus dados e endereço e siga para o Mercado Pago. Acompanhe a confirmação na página do pedido.";
      }
      if (questions[2])
        questions[2].querySelector("p").textContent =
          "Confira a identificação de cada item. Produtos marcados como demonstrativos são fictícios. Os demais são cadastrados pela loja, que administra suas informações e disponibilidade.";
      $(".catalog-footnote").textContent =
        "Confira produtos, variações e disponibilidade. Itens marcados como demonstrativos não podem receber pagamentos.";
      $(".footer-bottom").lastElementChild.textContent =
        "Pagamento e disponibilidade são confirmados no checkout.";
      $("#cart-footer > p").textContent =
        "Frete informado no checkout. Pagamentos processados pelo Mercado Pago.";
    } else
      $("#purchase-notice").textContent =
        "Checkout disponível como tela; pagamentos aguardam configuração da loja.";
  } catch {
    $("#purchase-notice").textContent =
      "Catálogo de demonstração. Para pagamentos e administração, publique com o backend configurado.";
  }
  loadingStore = false;
  renderProducts();
  renderCart();
  document.dispatchEvent(new Event("pulse-store-ready"));
}
loadStore();
