const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.emulateMedia({ reducedMotion: "reduce" });
  await p.goto("http://127.0.0.1:8000");
  await p.evaluate(() => document.fonts.ready);
  await p.addScriptTag({
    path: require.resolve(process.env.AXE_PATH || "axe-core/axe.min.js"),
  });
  for (const target of ["page", "product", "cart", "privacy", "mobile-menu"]) {
    if (target === "product")
      await p.locator('[data-detail="whey"]').first().click();
    if (target === "cart") {
      await p.keyboard.press("Escape");
      await p.locator("#cart-open").click();
    }
    if (target === "privacy") {
      await p.keyboard.press("Escape");
      await p.locator("#privacy-open").click();
    }
    if (target === "mobile-menu") {
      await p.keyboard.press("Escape");
      await p.setViewportSize({ width: 390, height: 844 });
      await p.locator("#menu-toggle").click();
    }
    const r = await p.evaluate(() =>
      axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
        },
      }),
    );
    if (r.violations.length) process.exitCode = 1;
    console.log(
      target,
      JSON.stringify(
        r.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => ({
            html: n.html,
            summary: n.failureSummary,
          })),
        })),
        null,
        2,
      ),
    );
  }
  await b.close();
})();
