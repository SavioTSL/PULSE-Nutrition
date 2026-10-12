import { products, categories, money } from "./products.js";
import { Cart, safeRead, persist } from "./cart.js";
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
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 3500);
}
const asset = (p) => `assets/product-${p.image}.svg`;
$("#category-grid").innerHTML = categories
  .map(
    (c, i) =>
      `<button class="category-card" data-category="${i}"><img src="assets/product-${i}.svg" alt="" loading="lazy" width="160" height="160"><span>${c}</span><b>↗</b></button>`,
  )
  .join("");
$("#filter-chips").innerHTML = ["Todos", ...categories]
  .map(
    (c, i) =>
      `<button data-filter="${i - 1}" class="${i === 0 ? "active" : ""}" aria-pressed="${i === 0}">${c}</button>`,
  )
  .join("");
function renderProducts() {
  const query = $("#search")
    .value.trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  let list = products.filter(
    (p) =>
      (category === "all" || p.category === category) &&
      p.price <= Number($("#price").value) * 100 &&
      (!onlyFavorites || favorites.includes(p.id)) &&
      p.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .includes(query),
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
  $("#product-grid").innerHTML = list
    .map(
      (p) =>
        `<article class="product-card" data-id="${p.id}"><div class="product-visual"><button data-detail="${p.id}" aria-label="Ver detalhes de ${p.name}"><img src="${asset(p)}" alt="Embalagem ilustrativa ${p.name}" width="400" height="400" loading="lazy"></button><span class="product-tag">${p.tag}</span><button class="icon-btn favorite-btn" data-favorite="${p.id}" aria-label="${favorites.includes(p.id) ? "Remover" : "Adicionar"} ${p.name} ${favorites.includes(p.id) ? "dos" : "aos"} favoritos" aria-pressed="${favorites.includes(p.id)}">${icon("heart")}</button></div><div class="product-info"><p class="brand">PULSE NUTRITION · DEMO</p><h3>${p.name}</h3><p class="product-category">${p.category}</p><div class="price">${money(p.price)}</div><small>Preço ilustrativo</small><div class="card-bottom"><select aria-label="Variação de ${p.name}" data-variant>${p.variants.map((v) => `<option>${v}</option>`).join("")}</select><button class="add-btn" data-add="${p.id}" aria-label="Adicionar ${p.name} ao carrinho">+</button></div><button class="details-btn" data-detail="${p.id}">Ver detalhes <span>↗</span></button></div></article>`,
    )
    .join("");
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
let returnFocus;
function openDialog(d) {
  if (d.open) return;
  returnFocus = document.activeElement;
  $("#header").classList.remove("away");
  d.showModal();
  document.body.classList.add("modal-open");
  pauseTimer();
}
$$("dialog").forEach((d) => {
  d.addEventListener("close", () => {
    document.body.classList.remove("modal-open");
    returnFocus?.focus({ preventScroll: true });
    schedule();
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
    `<div class="product-detail-grid"><div class="detail-gallery"><img id="gallery-main" src="${asset(p)}" alt="${p.name}, vista da embalagem ilustrativa" width="500" height="500"><div class="gallery-thumbs"><button data-view="front" aria-label="Vista da embalagem" aria-pressed="true"><img src="${asset(p)}" alt=""></button><button data-view="back" aria-label="Ver rótulo demonstrativo" aria-pressed="false"><img src="assets/product-label.svg" alt=""></button><button data-view="zoom" aria-label="Ampliar embalagem" aria-pressed="false"><img src="${asset(p)}" alt=""></button></div></div><div class="detail-copy"><p class="eyebrow">${p.brand} · PRODUTO DEMONSTRATIVO</p><h2 id="detail-title">${p.name}</h2><div class="price">${money(p.price)}</div><p>${p.description}</p><label for="detail-variant">Escolha sua variação</label><select id="detail-variant">${p.variants.map((v) => `<option>${v}</option>`).join("")}</select><label for="detail-qty">Quantidade</label><div class="qty-control"><button id="qty-minus" aria-label="Diminuir quantidade">−</button><input id="detail-qty" type="number" min="1" max="99" value="1" inputmode="numeric"><button id="qty-plus" aria-label="Aumentar quantidade">+</button></div><button id="detail-add" class="button dark">Adicionar à seleção +</button><div class="label-info"><strong>Informações ilustrativas do rótulo</strong><p>${p.label}</p><p>Não é recomendação de consumo. Consulte orientação profissional. Imagens demonstrativas; tamanho e sabor não alteram o preço ilustrativo.</p></div></div></div>`;
  // Labels em português para leitores de tela.
  $("#gallery-main").alt = `${p.name}, vista da embalagem ilustrativa`;
  $$("[data-view]")[0].ariaLabel = "Vista da embalagem";
  $$("[data-view]")[2].ariaLabel = "Ampliar embalagem";
  $("#detail-add").addEventListener("click", () => {
    const qty = Number($("#detail-qty").value);
    if (!cart.add(p.id, $("#detail-variant").value, qty)) {
      toast("Informe uma quantidade inteira de 1 a 99.");
      $("#detail-qty").focus();
      return;
    }
    toast("Produto adicionado à sua seleção.");
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
  let touchX;
  $(".detail-gallery").addEventListener(
    "touchstart",
    (e) => (touchX = e.changedTouches[0].clientX),
    { passive: true },
  );
  $(".detail-gallery").addEventListener(
    "touchend",
    (e) => {
      if (Math.abs(e.changedTouches[0].clientX - touchX) > 40) {
        const active = $('[data-view][aria-pressed="true"]');
        $$("[data-view]")[($$("[data-view]").indexOf(active) + 1) % 3].click();
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
    $(`[data-favorite="${id}"]`)?.focus({ preventScroll: true });
    toast(
      stored
        ? added
          ? "Salvo nos favoritos."
          : "Removido dos favoritos."
        : "Armazenamento indisponível. Favoritos salvos apenas nesta sessão.",
    );
  } else if (add) {
    cart.add(
      add.dataset.add,
      add.closest(".product-card").querySelector("[data-variant]").value,
    );
    toast("Produto adicionado à sua seleção.");
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
          return `<article class="cart-item"><img src="${asset(p)}" alt="" width="80" height="80"><div><h3>${p.name}</h3><p>${item.variant}</p><strong>${money(p.price * item.qty)}</strong><div class="cart-item-bottom"><div class="cart-qty"><button data-index="${index}" data-delta="-1" aria-label="Diminuir quantidade de ${p.name}" ${item.qty === 1 ? "disabled" : ""}>−</button><span aria-label="Quantidade">${item.qty}</span><button data-index="${index}" data-delta="1" aria-label="Aumentar quantidade de ${p.name}" ${item.qty === 99 ? "disabled" : ""}>+</button></div><button class="remove-btn" data-remove="${index}" aria-label="Remover ${p.name} do carrinho">Remover</button></div></div></article>`;
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
let lastY = scrollY;
window.addEventListener(
  "scroll",
  () => {
    const y = scrollY;
    $("#header").classList.toggle(
      "away",
      y > 180 && y > lastY && !$$("dialog").some((d) => d.open) && menu.hidden,
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
  $("#hero-product").src = `assets/product-${s.image}.svg`;
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
    !$$("dialog").some((d) => d.open)
  )
    timer = setTimeout(() => showSlide(slide + 1), 6500);
}
function updatePause() {
  $("#slide-pause").textContent = paused ? "▷" : "II";
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
  renderProducts();
  toast("Carrinho e favoritos apagados.");
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
