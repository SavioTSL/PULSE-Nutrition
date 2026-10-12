(() => {
  // js/products.js
  var categories = [
    "Whey Protein",
    "Creatina",
    "Pr\xE9-treino",
    "Vitaminas e minerais",
    "Barras proteicas",
    "Acess\xF3rios fitness"
  ];
  var products = [
    {
      id: "whey",
      name: "Whey Essential",
      category: categories[0],
      price: 14990,
      variants: ["Chocolate \xB7 900 g", "Baunilha \xB7 900 g", "Morango \xB7 900 g"],
      image: 0,
      label: "Prote\xEDna em p\xF3. Por\xE7\xE3o ilustrativa: 30 g. Cont\xE9m leite e derivados.",
      tag: "Sele\xE7\xE3o da casa"
    },
    {
      id: "creatine",
      name: "Creatina Pure",
      category: categories[1],
      price: 8990,
      variants: ["Sem sabor \xB7 300 g", "Sem sabor \xB7 150 g"],
      image: 1,
      label: "Creatina em p\xF3. Embalagem e composi\xE7\xE3o ilustrativas.",
      tag: "Essencial"
    },
    {
      id: "pre",
      name: "Pre Workout Focus",
      category: categories[2],
      price: 11990,
      variants: ["Frutas vermelhas \xB7 300 g", "Lim\xE3o \xB7 300 g"],
      image: 2,
      label: "Pr\xE9-treino demonstrativo com cafe\xEDna. N\xE3o indicado para crian\xE7as, gestantes ou pessoas sens\xEDveis \xE0 cafe\xEDna.",
      tag: "Na sua rotina"
    },
    {
      id: "vits",
      name: "Daily Vitamins",
      category: categories[3],
      price: 5990,
      variants: ["60 c\xE1psulas"],
      image: 3,
      label: "Mix ilustrativo de vitaminas e minerais. Consulte orienta\xE7\xE3o profissional para uso.",
      tag: "Dia a dia"
    },
    {
      id: "bar",
      name: "Protein Bar Crunch",
      category: categories[4],
      price: 1290,
      variants: ["Chocolate \xB7 45 g", "Cookies \xB7 45 g"],
      image: 4,
      label: "Barra proteica ilustrativa. Cont\xE9m leite, soja e pode conter castanhas.",
      tag: "Pr\xE1tico"
    },
    {
      id: "shaker",
      name: "Shaker Pulse",
      category: categories[5],
      price: 3990,
      variants: ["Preto \xB7 600 ml", "Verde \xB7 600 ml"],
      image: 5,
      label: "Acess\xF3rio demonstrativo. Capacidade ilustrativa: 600 ml.",
      tag: "Seu pr\xF3ximo treino"
    },
    {
      id: "isolate",
      name: "Whey Isolate Studio",
      category: categories[0],
      price: 19990,
      variants: ["Chocolate \xB7 900 g", "Baunilha \xB7 900 g"],
      image: 0,
      label: "Prote\xEDna isolada ilustrativa. Cont\xE9m leite e derivados.",
      tag: "Destaque"
    },
    {
      id: "kit",
      name: "Protein Bar Box",
      category: categories[4],
      price: 10990,
      variants: ["Chocolate \xB7 12 unidades", "Cookies \xB7 12 unidades"],
      image: 4,
      label: "Caixa demonstrativa com 12 barras de 45 g. Cont\xE9m leite e soja.",
      tag: "Para levar"
    }
  ].map((p) => ({
    ...p,
    brand: "PULSE Nutrition",
    description: "Uma escolha para compor a sua rotina. Produto fict\xEDcio da cole\xE7\xE3o PULSE, com pre\xE7o, embalagem e informa\xE7\xF5es de r\xF3tulo exclusivamente ilustrativos. N\xE3o dispon\xEDvel para compra real."
  }));
  var money = (cents) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100
  );

  // js/catalog.js
  var imagePath = (image) => `assets/product-${image}.${image === 0 || image === 1 ? "webp" : "svg"}`;
  var asset = (p) => imagePath(p.image);
  var renderProductCards = (list, favorites2 = []) => list.map(
    (p) => `<article class="product-card" data-id="${p.id}"><div class="product-visual"><button data-detail="${p.id}" aria-label="Ver detalhes de ${p.name}"><img src="${asset(p)}" alt="Embalagem ilustrativa ${p.name}" width="400" height="400" loading="lazy"></button><span class="product-tag">${p.tag}</span><button class="icon-btn favorite-btn" data-favorite="${p.id}" aria-label="${favorites2.includes(p.id) ? "Remover" : "Adicionar"} ${p.name} ${favorites2.includes(p.id) ? "dos" : "aos"} favoritos" aria-pressed="${favorites2.includes(p.id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg></button></div><div class="product-info"><p class="brand">PULSE NUTRITION \xB7 DEMO</p><h3>${p.name}</h3><p class="product-category">${p.category}</p><div class="price">${money(p.price)}</div><small>Pre\xE7o ilustrativo</small><div class="card-bottom"><select aria-label="Varia\xE7\xE3o de ${p.name}" data-variant>${p.variants.map((v) => `<option>${v}</option>`).join("")}</select><button class="add-btn" data-add="${p.id}" aria-label="Adicionar ${p.name} ao carrinho">+</button></div><button class="details-btn" data-detail="${p.id}">Ver detalhes <span>\u2197</span></button></div></article>`
  ).join("");

  // js/cart.js
  var CART_KEY = "pulse-cart-v1";
  function safeRead(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  }
  function persist(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
  function normalize(items) {
    if (!Array.isArray(items)) return [];
    const result = [];
    for (const item of items) {
      const p = products.find((p2) => p2.id === item?.id);
      if (!p || !p.variants.includes(item.variant) || !Number.isInteger(item.qty) || item.qty < 1)
        continue;
      const existing = result.find(
        (x) => x.id === p.id && x.variant === item.variant
      );
      if (existing) existing.qty = Math.min(99, existing.qty + item.qty);
      else
        result.push({
          id: p.id,
          variant: item.variant,
          qty: Math.min(99, item.qty)
        });
    }
    return result;
  }
  var Cart = class {
    constructor() {
      this.items = normalize(safeRead(CART_KEY, []));
    }
    save() {
      const stored = persist(CART_KEY, this.items);
      window.dispatchEvent(new CustomEvent("cartchange", { detail: { stored } }));
    }
    add(id, variant, qty = 1) {
      const p = products.find((p2) => p2.id === id);
      if (!p || !p.variants.includes(variant) || !Number.isInteger(qty) || qty < 1 || qty > 99)
        return false;
      const item = this.items.find((i) => i.id === id && i.variant === variant);
      if (item) item.qty = Math.min(99, item.qty + qty);
      else this.items.push({ id, variant, qty });
      this.save();
      return true;
    }
    set(index, qty) {
      if (!this.items[index] || !Number.isInteger(qty) || qty < 1 || qty > 99)
        return false;
      this.items[index].qty = qty;
      this.save();
      return true;
    }
    remove(index) {
      this.items.splice(index, 1);
      this.save();
    }
    get count() {
      return this.items.reduce((sum, i) => sum + i.qty, 0);
    }
    get total() {
      return this.items.reduce(
        (sum, i) => sum + products.find((p) => p.id === i.id).price * i.qty,
        0
      );
    }
    summary() {
      return "PULSE Nutrition \u2014 solicita\xE7\xE3o de or\xE7amento demonstrativo\n\n" + this.items.map((i) => {
        const p = products.find((p2) => p2.id === i.id);
        return `${i.qty} \xD7 ${p.name} (${i.variant}) \u2014 ${money(p.price * i.qty)}`;
      }).join("\n") + `

Subtotal ilustrativo: ${money(this.total)}
Frete e disponibilidade a consultar. N\xE3o \xE9 confirma\xE7\xE3o de pedido ou pagamento.`;
    }
  };

  // js/script.js
  var $ = (s) => document.querySelector(s);
  var $$ = (s) => [...document.querySelectorAll(s)];
  var icons = {
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
    bag: '<path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    message: '<path d="M21 11.5a9 9 0 0 1-9 9 10 10 0 0 1-4-.8L3 21l1.3-4.8A9 9 0 1 1 21 11.5Z"/><path d="M8 10h8M8 14h5"/>'
  };
  var icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.bag}</svg>`;
  function hydrate() {
    $$("[data-icon]").forEach((el) => {
      el.innerHTML = icon(el.dataset.icon);
    });
  }
  hydrate();
  var cart = new Cart();
  var favoriteKey = "pulse-favorites-v1";
  var favorites = safeRead(favoriteKey, []);
  favorites = Array.isArray(favorites) ? [...new Set(favorites.filter((id) => products.some((p) => p.id === id)))] : [];
  var category = "all";
  var onlyFavorites = false;
  var toastTimer;
  function toast(message) {
    $("#toast").textContent = message;
    $("#toast").classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 3500);
  }
  var asset2 = (p) => imagePath(p.image);
  $("#category-grid").innerHTML = categories.map(
    (c, i) => `<button class="category-card" data-category="${i}"><img src="${imagePath(i)}" alt="" loading="lazy" width="160" height="160"><span>${c}</span><b>\u2197</b></button>`
  ).join("");
  $("#filter-chips").innerHTML = ["Todos", ...categories].map(
    (c, i) => `<button data-filter="${i - 1}" class="${i === 0 ? "active" : ""}" aria-pressed="${i === 0}">${c}</button>`
  ).join("");
  function renderProducts() {
    const query = $("#search").value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    let list = products.filter(
      (p) => (category === "all" || p.category === category) && p.price <= Number($("#price").value) * 100 && (!onlyFavorites || favorites.includes(p.id)) && p.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(query)
    );
    const sort = $("#sort").value;
    if (sort === "price-up") list.sort((a, b) => a.price - b.price);
    if (sort === "price-down") list.sort((a, b) => b.price - a.price);
    if (sort === "name")
      list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    $("#result-count").textContent = `${list.length} produto${list.length === 1 ? "" : "s"}${onlyFavorites ? " favorito" + (list.length === 1 ? "" : "s") : ""}`;
    $("#price-output").textContent = money(Number($("#price").value) * 100);
    $("#favorites-toggle").setAttribute("aria-pressed", String(onlyFavorites));
    $$("#filter-chips button").forEach((b) => {
      const active = Number(b.dataset.filter) === -1 ? category === "all" : categories[Number(b.dataset.filter)] === category;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    $("#empty-results").hidden = list.length > 0;
    $("#product-grid").innerHTML = renderProductCards(list, favorites);
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
  ["search", "price", "sort"].forEach(
    (id) => $("#" + id).addEventListener(
      id === "sort" ? "change" : "input",
      renderProducts
    )
  );
  $("#filter-chips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-filter]");
    if (!b) return;
    category = Number(b.dataset.filter) === -1 ? "all" : categories[Number(b.dataset.filter)];
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
      behavior: motion.matches ? "auto" : "smooth"
    });
  });
  $("#favorites-toggle").addEventListener("click", () => {
    onlyFavorites = !onlyFavorites;
    category = "all";
    $("#search").value = "";
    $("#price").value = "250";
    renderProducts();
    $("#catalogo").scrollIntoView({
      behavior: motion.matches ? "auto" : "smooth"
    });
  });
  $("#search-toggle").addEventListener("click", () => {
    $("#catalogo").scrollIntoView({ behavior: "auto" });
    $("#search").focus();
  });
  var returnFocus;
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
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom)
          d.close();
      }
    });
  });
  function detail(id) {
    const p = products.find((p2) => p2.id === id);
    if (!p) return;
    $("#product-detail").innerHTML = `<div class="product-detail-grid"><div class="detail-gallery"><img id="gallery-main" src="${asset2(p)}" alt="${p.name}, vista da embalagem ilustrativa" width="500" height="500"><div class="gallery-thumbs"><button data-view="front" aria-label="Vista da embalagem" aria-pressed="true"><img src="${asset2(p)}" alt=""></button><button data-view="back" aria-label="Ver r\xF3tulo demonstrativo" aria-pressed="false"><img src="assets/product-label.svg" alt=""></button><button data-view="zoom" aria-label="Ampliar embalagem" aria-pressed="false"><img src="${asset2(p)}" alt=""></button></div></div><div class="detail-copy"><p class="eyebrow">${p.brand} \xB7 PRODUTO DEMONSTRATIVO</p><h2 id="detail-title">${p.name}</h2><div class="price">${money(p.price)}</div><p>${p.description}</p><label for="detail-variant">Escolha sua varia\xE7\xE3o</label><select id="detail-variant">${p.variants.map((v) => `<option>${v}</option>`).join("")}</select><label for="detail-qty">Quantidade</label><div class="qty-control"><button id="qty-minus" aria-label="Diminuir quantidade">\u2212</button><input id="detail-qty" type="number" min="1" max="99" value="1" inputmode="numeric"><button id="qty-plus" aria-label="Aumentar quantidade">+</button></div><button id="detail-add" class="button dark">Adicionar \xE0 sele\xE7\xE3o +</button><div class="label-info"><strong>Informa\xE7\xF5es ilustrativas do r\xF3tulo</strong><p>${p.label}</p><p>N\xE3o \xE9 recomenda\xE7\xE3o de consumo. Consulte orienta\xE7\xE3o profissional. Imagens demonstrativas; tamanho e sabor n\xE3o alteram o pre\xE7o ilustrativo.</p></div></div></div>`;
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
      toast("Produto adicionado \xE0 sua sele\xE7\xE3o.");
    });
    function changeQty(delta) {
      const n = Number($("#detail-qty").value);
      $("#detail-qty").value = String(
        Math.max(1, Math.min(99, (Number.isInteger(n) ? n : 1) + delta))
      );
    }
    $("#qty-minus").addEventListener("click", () => changeQty(-1));
    $("#qty-plus").addEventListener("click", () => changeQty(1));
    $$("[data-view]").forEach(
      (b) => b.addEventListener("click", () => {
        $("#gallery-main").src = b.dataset.view === "back" ? "assets/product-label.svg" : asset2(p);
        $("#gallery-main").alt = b.dataset.view === "back" ? "R\xF3tulo demonstrativo PULSE" : `${p.name}, embalagem ilustrativa`;
        $("#gallery-main").style.transform = b.dataset.view === "zoom" ? "scale(1.12)" : "none";
        $$("[data-view]").forEach(
          (x) => x.setAttribute("aria-pressed", String(x === b))
        );
      })
    );
    let touchX;
    $(".detail-gallery").addEventListener(
      "touchstart",
      (e) => touchX = e.changedTouches[0].clientX,
      { passive: true }
    );
    $(".detail-gallery").addEventListener(
      "touchend",
      (e) => {
        if (Math.abs(e.changedTouches[0].clientX - touchX) > 40) {
          const active = $('[data-view][aria-pressed="true"]');
          $$("[data-view]")[($$("[data-view]").indexOf(active) + 1) % 3].click();
        }
      },
      { passive: true }
    );
    openDialog($("#product-dialog"));
  }
  $("#product-grid").addEventListener("click", (e) => {
    const favorite = e.target.closest("[data-favorite]"), add = e.target.closest("[data-add]"), details = e.target.closest("[data-detail]");
    if (favorite) {
      const id = favorite.dataset.favorite;
      const added = !favorites.includes(id);
      favorites = added ? [...favorites, id] : favorites.filter((x) => x !== id);
      const stored = persist(favoriteKey, favorites);
      renderProducts();
      $(`[data-favorite="${id}"]`)?.focus({ preventScroll: true });
      toast(
        stored ? added ? "Salvo nos favoritos." : "Removido dos favoritos." : "Armazenamento indispon\xEDvel. Favoritos salvos apenas nesta sess\xE3o."
      );
    } else if (add) {
      cart.add(
        add.dataset.add,
        add.closest(".product-card").querySelector("[data-variant]").value
      );
      toast("Produto adicionado \xE0 sua sele\xE7\xE3o.");
    } else if (details) detail(details.dataset.detail);
  });
  function renderCart() {
    $("#cart-count").textContent = String(cart.count);
    $("#cart-open").ariaLabel = `Abrir carrinho com ${cart.count} itens`;
    $("#cart-total").textContent = money(cart.total);
    $("#cart-footer").hidden = cart.items.length === 0;
    $("#cart-items").innerHTML = cart.items.length ? cart.items.map((item, index) => {
      const p = products.find((p2) => p2.id === item.id);
      return `<article class="cart-item"><img src="${asset2(p)}" alt="" width="80" height="80"><div><h3>${p.name}</h3><p>${item.variant}</p><strong>${money(p.price * item.qty)}</strong><div class="cart-item-bottom"><div class="cart-qty"><button data-index="${index}" data-delta="-1" aria-label="Diminuir quantidade de ${p.name}" ${item.qty === 1 ? "disabled" : ""}>\u2212</button><span aria-label="Quantidade">${item.qty}</span><button data-index="${index}" data-delta="1" aria-label="Aumentar quantidade de ${p.name}" ${item.qty === 99 ? "disabled" : ""}>+</button></div><button class="remove-btn" data-remove="${index}" aria-label="Remover ${p.name} do carrinho">Remover</button></div></div></article>`;
    }).join("") : `<div class="empty-state"><h3>Seu carrinho est\xE1 esperando.</h3><p>Explore o cat\xE1logo e encontre seus essenciais.</p><button class="button dark" id="cart-explore">Explorar produtos \u2197</button></div>`;
    $("#cart-explore")?.addEventListener("click", () => {
      $("#cart-dialog").close();
      $("#catalogo").scrollIntoView();
    });
    $("#order-summary").hidden = true;
    const phone = window.PULSE_CONFIG?.whatsappNumber || "";
    $("#order-button").textContent = /^[1-9]\d{9,14}$/.test(phone) ? "Preparar or\xE7amento no WhatsApp \u2197" : "Copiar resumo do or\xE7amento \u2197";
  }
  window.addEventListener("cartchange", (e) => {
    renderCart();
    if (!e.detail.stored)
      toast("Armazenamento indispon\xEDvel. Carrinho salvo apenas nesta sess\xE3o.");
  });
  $("#cart-items").addEventListener("click", (e) => {
    const remove = e.target.closest("[data-remove]"), change = e.target.closest("[data-delta]");
    if (remove) {
      const i = Number(remove.dataset.remove);
      cart.remove(i);
      $("[data-remove]")?.focus();
    } else if (change) {
      const i = Number(change.dataset.index), delta = Number(change.dataset.delta);
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
    const summary = cart.summary(), phone = window.PULSE_CONFIG?.whatsappNumber || "";
    if (/^[1-9]\d{9,14}$/.test(phone)) {
      window.open(
        `https://wa.me/${phone}?text=${encodeURIComponent(summary)}`,
        "_blank",
        "noopener,noreferrer"
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
      favorites = Array.isArray(value) ? value.filter((id) => products.some((p) => p.id === id)) : [];
      renderProducts();
    }
    if (e.key === "pulse-cart-v1" || e.key === null) {
      cart.items = new Cart().items;
      renderCart();
    }
  });
  var menu = $("#mobile-menu");
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
    if (!menu.hidden && !menu.contains(e.target) && !$("#menu-toggle").contains(e.target))
      closeMenu();
  });
  window.addEventListener("resize", () => {
    if (innerWidth > 700) closeMenu();
  });
  var lastY = scrollY;
  window.addEventListener(
    "scroll",
    () => {
      const y = scrollY;
      $("#header").classList.toggle(
        "away",
        y > 180 && y > lastY && !$$("dialog").some((d) => d.open) && menu.hidden
      );
      lastY = y;
    },
    { passive: true }
  );
  var motion = matchMedia("(prefers-reduced-motion: reduce)");
  var slides = [
    {
      title: "SUA EVOLU\xC7\xC3O<br>COME\xC7A <em>AQUI.</em>",
      description: "Sua rotina. Seu ritmo. Suas escolhas.<br>Encontre os essenciais para acompanhar voc\xEA.",
      image: 0,
      name: "WHEY PROTEIN"
    },
    {
      title: "SEU RITMO.<br>SUA <em>ESS\xCANCIA.</em>",
      description: "Pequenas escolhas fazem parte do dia.<br>Conhe\xE7a nossa cole\xE7\xE3o de essenciais.",
      image: 1,
      name: "CREATINA PURE"
    },
    {
      title: "LEVE A ROTINA<br>COM <em>VOC\xCA.</em>",
      description: "Do treino aos momentos de pausa.<br>Explore escolhas para acompanhar sua rotina.",
      image: 4,
      name: "PROTEIN BAR"
    }
  ];
  var slide = 0;
  var paused = motion.matches;
  var timer;
  var hover = false;
  $("#slide-dots").innerHTML = slides.map(
    (_, i) => `<button data-slide="${i}" aria-label="Ir para slide ${i + 1}" aria-current="${i === 0}"></button>`
  ).join("");
  function showSlide(i) {
    slide = (i + slides.length) % slides.length;
    const s = slides[slide];
    $("#hero-title").innerHTML = s.title;
    $("#hero-description").innerHTML = s.description;
    $("#hero-product").src = imagePath(s.image);
    $("#hero-product").alt = `Embalagem demonstrativa ${s.name}`;
    $("#hero-product-name").textContent = s.name;
    $$("[data-slide]").forEach(
      (b) => b.setAttribute("aria-current", String(Number(b.dataset.slide) === slide))
    );
    if (!motion.matches)
      $("#hero-product").animate(
        [
          { opacity: 0, transform: "rotate(4deg) translateY(12px)" },
          { opacity: 1, transform: "rotate(7deg) translateY(0)" }
        ],
        { duration: 450 }
      );
    schedule();
  }
  function pauseTimer() {
    clearTimeout(timer);
  }
  function schedule() {
    pauseTimer();
    if (!paused && !hover && !document.hidden && !$$("dialog").some((d) => d.open))
      timer = setTimeout(() => showSlide(slide + 1), 6500);
  }
  function updatePause() {
    $("#slide-pause").textContent = paused ? "\u25B7" : "II";
    $("#slide-pause").ariaLabel = paused ? "Retomar slides autom\xE1ticos" : "Pausar slides autom\xE1ticos";
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
  $("#privacy-open").addEventListener(
    "click",
    () => openDialog($("#privacy-dialog"))
  );
  $("#clear-data").addEventListener("click", () => {
    favorites = [];
    persist(favoriteKey, []);
    cart.items = [];
    cart.save();
    renderProducts();
    toast("Carrinho e favoritos apagados.");
  });
  var endpoint = window.PULSE_CONFIG?.newsletterEndpoint || "";
  if (!endpoint) {
    $("#email").disabled = true;
    $("#newsletter-form button").disabled = true;
    $("#email").placeholder = "Newsletter em breve \u2014 demonstra\xE7\xE3o";
    $("#newsletter-form").ariaLabel = "Newsletter indispon\xEDvel nesta demonstra\xE7\xE3o";
  } else
    $("#newsletter-note").textContent = "Seu e-mail ser\xE1 enviado ao servi\xE7o de newsletter configurado.";
  $("#newsletter-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!endpoint) return;
    const button = $("#newsletter-form button");
    button.disabled = true;
    try {
      const url = new URL(endpoint);
      if (url.protocol !== "https:") throw new Error("HTTPS obrigat\xF3rio");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: $("#email").value })
      });
      if (!res.ok) throw new Error("Falha");
      toast("Inscri\xE7\xE3o enviada ao servi\xE7o configurado.");
      $("#newsletter-form").reset();
    } catch {
      toast("N\xE3o foi poss\xEDvel enviar. Tente novamente mais tarde.");
    } finally {
      button.disabled = false;
    }
  });
  if ("IntersectionObserver" in window && !motion.matches) {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          observer.unobserve(e.target);
        }
      }),
      { threshold: 0.12 }
    );
    $$(".reveal").forEach((el) => {
      el.classList.add("is-pending");
      observer.observe(el);
    });
  }
  renderProducts();
  renderCart();
  updatePause();
})();
