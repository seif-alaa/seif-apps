import { expect, test } from "@playwright/test";

test.describe("Mobile", () => {
  test("builder keeps the watch visible while options scroll, with big tap targets", async ({ page }) => {
    await page.goto("/build");
    await expect(page.getByTestId("build-name")).toBeVisible();
    await expect(page.getByTestId("continue")).toBeInViewport();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: "Expand options" }).click();
    for (let i = 0; i < 3; i++) await page.getByTestId("continue").click();
    await page.getByTestId("opt-dial_SKX_navy").click();
    await expect(page.getByTestId("build-name")).toHaveText(/navy/);
    const stage = await page.getByRole("img", { name: /illustrative rendering/ }).boundingBox();
    expect(stage!.height).toBeGreaterThan(130); // the watch is still on screen with the sheet open
    const box = await page.getByTestId("continue").boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test("storefront pages have no horizontal overflow", async ({ page }) => {
    for (const path of ["/", "/timepieces", "/timepieces/gmt", "/rare-pieces", "/atelier", "/contact", "/bag", "/checkout"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});
