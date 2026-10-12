const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const failures = [];
    page.on("pageerror", (error) => failures.push(error.message));
    page.on("response", (res) => {
      if (res.status() >= 400) failures.push(`${res.status()} ${res.url()}`);
    });
    await page.clock.install();
    await page.goto("http://127.0.0.1:8000");
    await page.evaluate(() => document.fonts.ready);
    await page.locator("#slide-next").focus();
    await page.keyboard.press("Enter");
    const slide = await page.locator("#hero-product-name").textContent();
    await page.clock.fastForward(7000);
    assert.equal(
      await page.locator("#hero-product-name").textContent(),
      slide,
      "slider deve pausar com foco de teclado",
    );
    await page
      .locator('[data-id="whey"] [data-variant]')
      .selectOption("Morango · 900 g");
    await page.locator('[data-favorite="whey"]').click();
    assert.equal(
      await page.locator('[data-id="whey"] [data-variant]').inputValue(),
      "Morango · 900 g",
      "favoritar deve preservar a variação",
    );
    await page.locator("#favorites-toggle").click();
    await page.locator('[data-favorite="whey"]').click();
    assert.equal(await page.locator("#empty-results").isVisible(), true);
    assert.equal(
      await page
        .locator("#favorites-toggle")
        .evaluate((el) => document.activeElement === el),
      true,
      "foco deve permanecer em controle visível após remover último favorito",
    );
    await page.locator("#clear-filters").click();
    assert.equal(
      await page
        .locator(".category-card img")
        .evaluateAll((imgs) =>
          imgs.every((i) => i.getAttribute("src").endsWith(".webp")),
        ),
      true,
    );
    for (const width of [320, 375, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        `overflow ${width}`,
      );
    }
    await page.setViewportSize({ width: 390, height: 844 });
    for (const selector of [
      ".favorite-btn",
      ".add-btn",
      "#cart-open",
      "#menu-toggle",
      "#slide-next",
    ]) {
      const sizes = await page
        .locator(selector)
        .evaluateAll((els) =>
          els.map((el) => ({
            w: el.getBoundingClientRect().width,
            h: el.getBoundingClientRect().height,
          })),
        );
      assert.ok(
        sizes.every((s) => s.w >= 44 && s.h >= 44),
        `alvo de toque menor que 44 px: ${selector}`,
      );
    }
    await page.evaluate(() => document.activeElement.blur());
    await page.evaluate(() => {
      scrollTo(0, 0);
      document.querySelector("#header").classList.add("away");
    });
    await page.locator("#header .logo").focus();
    assert.equal(
      await page
        .locator("#header")
        .evaluate((el) => el.classList.contains("away")),
      false,
      "header deve aparecer ao receber foco",
    );
    await page.evaluate(() =>
      localStorage.setItem(
        "pulse-cart-v1",
        JSON.stringify([{ id: "whey", variant: "Chocolate · 900 g", qty: 99 }]),
      ),
    );
    await page.reload();
    await page.locator('[data-add="whey"]').click();
    assert.equal(await page.locator("#cart-count").textContent(), "99");
    assert.match(await page.locator("#toast").textContent(), /Limite de 99/);
    await page.locator("#cart-open").click();
    assert.equal(
      await page
        .locator(".cart-qty button")
        .first()
        .evaluate(
          (el) =>
            el.getBoundingClientRect().width >= 44 &&
            el.getBoundingClientRect().height >= 44,
        ),
      true,
    );
    await page.keyboard.press("Escape");
    await page.evaluate(() => localStorage.clear());
    assert.deepEqual(failures, []);
    console.log(
      "PASS: variações preservadas, foco de favoritos/header, pausa por teclado, limite real de quantidade, imagens 3D, toque 44 px e layouts 320–1440 sem overflow. Nenhum erro JS/HTTP.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
