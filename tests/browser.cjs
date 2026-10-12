const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  await context.route("https://wa.me/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<p>Destino WhatsApp interceptado pelo teste; nenhuma mensagem enviada.</p>",
    }),
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:8000");
  await page.waitForSelector(".product-card");
  assert.equal(await page.locator(".product-card").count(), 8);
  await page.screenshot({ path: "/tmp/pulse-desktop.png", fullPage: true });
  await page.locator("#search").fill("creatina");
  assert.equal(await page.locator(".product-card").count(), 1);
  await page.locator("#search").fill("não existe");
  assert.equal(await page.locator("#empty-results").isVisible(), true);
  await page.locator("#empty-reset").click();
  await page.locator('[data-filter="0"]').click();
  assert.equal(await page.locator(".product-card").count(), 2);
  await page.locator("#clear-filters").click();
  await page.locator("#price").fill("50");
  assert.equal(await page.locator(".product-card").count(), 2);
  await page.locator("#clear-filters").click();
  await page.locator("#sort").selectOption("price-up");
  assert.equal(
    await page.locator(".product-card").first().getAttribute("data-id"),
    "bar",
  );
  await page.locator("#sort").selectOption("name");
  assert.equal(
    await page.locator(".product-card").first().getAttribute("data-id"),
    "creatine",
  );
  await page.locator("#clear-filters").click();
  await page.locator('[data-favorite="whey"]').click();
  await page.locator("#favorites-toggle").click();
  assert.equal(await page.locator(".product-card").count(), 1);
  await page.reload();
  assert.equal(
    await page.locator('[data-favorite="whey"]').getAttribute("aria-pressed"),
    "true",
  );
  await page
    .locator('[data-id="whey"] [data-variant]')
    .selectOption("Baunilha · 900 g");
  await page.locator('[data-add="whey"]').click();
  assert.equal(await page.locator("#cart-count").textContent(), "1");
  await page.locator('[data-detail="whey"]').first().click();
  await page.locator("#detail-qty").fill("2");
  await page.locator("#detail-variant").selectOption("Chocolate · 900 g");
  await page.locator('[data-view="zoom"]').click();
  assert.equal(
    await page.locator('[data-view="zoom"]').getAttribute("aria-pressed"),
    "true",
  );
  await page.locator("#detail-add").click();
  await page.locator("#detail-qty").fill("0");
  await page.locator("#detail-add").click();
  assert.equal(await page.locator("#cart-count").textContent(), "3");
  await page.keyboard.press("Escape");
  await page.locator("#cart-open").click();
  assert.equal(await page.locator("#cart-total").textContent(), "R$ 449,70");
  assert.equal(await page.locator(".cart-item").count(), 2);
  await page.locator('[data-index="0"][data-delta="1"]').click();
  assert.equal(await page.locator("#cart-total").textContent(), "R$ 599,60");
  await page.locator('[data-index="0"][data-delta="-1"]').click();
  await page.locator("#order-button").click();
  assert.match(
    await page.evaluate(() => navigator.clipboard.readText()),
    /Baunilha/,
  );
  await page.keyboard.press("Escape");
  await page.reload();
  assert.equal(await page.locator("#cart-count").textContent(), "3");
  await page.locator("#cart-open").click();
  await page.locator('[data-remove="0"]').click();
  assert.equal(await page.locator("#cart-total").textContent(), "R$ 299,80");
  await page.locator('[data-remove="0"]').click();
  assert.equal(await page.locator("#cart-explore").isVisible(), true);
  await page.keyboard.press("Escape");
  await page.evaluate(
    () => (window.PULSE_CONFIG = { whatsappNumber: "5585999999999" }),
  );
  await page.locator('[data-add="bar"]').click();
  await page.locator("#cart-open").click();
  const popup = page.waitForEvent("popup");
  await page.locator("#order-button").click();
  const whatsapp = await popup;
  assert.match(whatsapp.url(), /^https:\/\/wa.me\/5585999999999\?text=/);
  await whatsapp.close();
  await page.keyboard.press("Escape");
  await page.locator("#slide-pause").click();
  const first = await page.locator("#hero-product-name").textContent();
  await page.locator("#slide-next").click();
  assert.notEqual(
    await page.locator("#hero-product-name").textContent(),
    first,
  );
  await page.locator("#privacy-open").click();
  await page.locator("#clear-data").click();
  assert.equal(await page.locator("#cart-count").textContent(), "0");
  await page.keyboard.press("Escape");
  for (const width of [320, 375, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `overflow ${width}`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.locator("#menu-toggle").click();
  assert.equal(await page.locator("#mobile-menu").isVisible(), true);
  await page.locator("#mobile-menu a").first().click();
  assert.equal(await page.locator("#mobile-menu").isVisible(), false);
  await page.locator('[data-detail="whey"]').first().click();
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelector("#product-dialog").scrollWidth <=
        document.querySelector("#product-dialog").clientWidth,
    ),
    true,
  );
  await page.keyboard.press("Escape");
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: "/tmp/pulse-mobile.png", fullPage: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page.locator("#slide-pause").getAttribute("aria-label"),
    "Retomar slides automáticos",
  );
  assert.deepEqual(errors, []);
  assert.equal(
    await page
      .locator("img")
      .evaluateAll((imgs) =>
        imgs.every((i) => i.complete && i.naturalWidth > 0),
      ),
    true,
  );
  await browser.close();
  console.log(
    "PASS: desktop/mobile, pesquisa, filtros, ordenação, variações, carrinho, cálculos, persistência, favoritos, clipboard, WhatsApp, modais, menu, slider, reduced-motion e imagens. Nenhum erro JavaScript.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
