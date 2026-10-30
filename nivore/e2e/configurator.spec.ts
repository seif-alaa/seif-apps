import { expect, test } from "@playwright/test";
import { gotoStep, settledPrice } from "./helpers";

test.describe("Build your watch", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/build");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/build");
    await expect(page.getByTestId("build-name")).toHaveText(/ALBA 39 · Ivory/);
  });

  test("dial change updates name, preview and price immediately", async ({ page }) => {
    const before = await settledPrice(page);
    await gotoStep(page, "Dial");
    await page.evaluate(() => {
      (window as unknown as { __clicks: number[] }).__clicks = [];
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) if ((e as unknown as { interactionId?: number }).interactionId && e.name === "click") (window as unknown as { __clicks: number[] }).__clicks.push(e.duration);
      }).observe({ type: "event", durationThreshold: 16 } as PerformanceObserverInit);
    });
    // Let the step's camera move settle (760 ms). Clicks during the move measured up to ~250 ms in
    // headless Chromium, which rasterises SVG in software; see PROGRESS.md › Performance.
    await page.waitForTimeout(900);
    await page.getByTestId("opt-dial-rose-linen").click();
    await expect(page.getByTestId("opt-dial-rose-linen")).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(300);
    // Event Timing: click → next paint (what INP measures). Entries under 16 ms are not reported.
    const clicks = await page.evaluate(() => (window as unknown as { __clicks: number[] }).__clicks);
    expect(Math.max(0, ...clicks)).toBeLessThan(200);
    await expect(page.getByTestId("build-name")).toHaveText(/ALBA 39 · Rosé/);
    const after = await settledPrice(page);
    expect(after - before).toBe(200); // Rosé linen is EGP 200 more than Ivory
  });

  test("incompatible options are explained, not offered", async ({ page }) => {
    await gotoStep(page, "Dial");
    await page.getByRole("button", { name: /Not available with your choices/ }).click();
    const dd = page.getByTestId("opt-dial-ivory-daydate");
    await expect(dd).toHaveAttribute("aria-disabled", "true");
    await expect(dd).toContainText(/day-date movement/);
    await dd.click({ force: true });
    await expect(page.getByTestId("build-name")).toHaveText(/Ivory/);
  });

  test("changing an earlier part asks before replacing later parts", async ({ page }) => {
    await page.getByTestId("opt-mv-nh36-white-3").click();
    const dialog = page.getByRole("dialog", { name: "This changes other parts" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Ivory sunburst · Day-date");
    await dialog.getByRole("button", { name: "Keep my current choice" }).click();
    await expect(page.getByTestId("opt-mv-nh35-white-3")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("opt-mv-nh36-white-3").click();
    await page.getByTestId("confirm-changes").click();
    await expect(page.getByTestId("opt-mv-nh36-white-3")).toHaveAttribute("aria-pressed", "true");
    await gotoStep(page, "Dial");
    await expect(page.getByTestId("opt-dial-ivory-daydate")).toHaveAttribute("aria-pressed", "true");
  });

  test("GMT movement repairs case and hands; review shows every part", async ({ page }) => {
    await page.getByTestId("opt-mv-nh34-white-3").click();
    await page.getByTestId("confirm-changes").click();
    await gotoStep(page, "Review");
    const review = page.getByTestId("review");
    await expect(review).toContainText("Voyager 40");
    await expect(review).toContainText(/GMT/);
    await expect(review).toContainText(/ordered in for your build, about 14 days/);
    await expect(page.getByTestId("build-name")).toHaveText(/40 GMT/);
  });

  test("rapid repeated selections stay consistent", async ({ page }) => {
    await gotoStep(page, "Dial");
    const ids = ["dial-rose-linen", "dial-teal-explorer", "dial-cognac-roman", "dial-ivory-date", "dial-teal-explorer", "dial-cognac-roman"];
    for (const id of ids) await page.getByTestId(`opt-${id}`).click();
    await expect(page.getByTestId("opt-dial-cognac-roman")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("build-name")).toHaveText(/SERA 39 · Cognac/);
    const price = await settledPrice(page);
    await gotoStep(page, "Review");
    const total = Number(((await page.getByTestId("review-total").textContent()) ?? "").replace(/[^\d]/g, ""));
    expect(total).toBe(price);
  });

  test("going back keeps choices, refresh restores, link shares the exact build", async ({ page, browser }) => {
    await gotoStep(page, "Dial");
    await page.getByTestId("opt-dial-teal-explorer").click();
    await page.getByTestId("continue").click(); // case
    await page.getByTestId("continue").click(); // hands
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByTestId("opt-dial-teal-explorer")).toHaveAttribute("aria-pressed", "true");
    const ref = await page.getByTestId("build-ref").textContent();
    await page.waitForTimeout(400); // URL sync is debounced
    await page.reload();
    await expect(page.getByTestId("build-ref")).toHaveText(ref!);
    const url = page.url();
    expect(url).toContain("b=");
    const other = await browser.newPage();
    await other.goto(url);
    await expect(other.getByTestId("build-ref")).toHaveText(ref!);
    await expect(other.getByTestId("review")).toBeVisible();
    await other.close();
  });

  test("engraving updates price and is limited", async ({ page }) => {
    await gotoStep(page, "Personalisation");
    const before = await settledPrice(page);
    const input = page.getByTestId("engraving-input");
    await input.fill("For L. 2026");
    expect(await settledPrice(page)).toBe(before + 400);
    await input.fill("x".repeat(60));
    expect((await input.inputValue()).length).toBe(30);
  });

  test("save, then add to bag with a server-confirmed price", async ({ page }) => {
    await gotoStep(page, "Review");
    await page.getByTestId("save-design").click();
    await expect(page.getByRole("status").filter({ hasText: "Saved on this device" })).toBeVisible();
    const total = await page.getByTestId("review-total").textContent();
    await page.getByTestId("review-add").click();
    await page.goto("/saved");
    await expect(page.getByText(/ALBA 39 · Ivory/).first()).toBeVisible();
    await page.goto("/bag");
    await expect(page.getByTestId("bag-items")).toContainText("ALBA 39 · Ivory");
    await expect(page.getByTestId("bag-items")).toContainText(total!.replace(/\s/g, " "));
    await expect(page.getByText("Prices confirmed by the atelier’s server.")).toBeVisible();
  });

  test("reduced motion: back view still switches", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("button", { name: "Show the back of the watch" }).click();
    await expect(page.locator('[data-layer="caseback"]').first()).toBeAttached();
  });
});
