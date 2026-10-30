import { expect, test } from "@playwright/test";

test.describe("Mobile", () => {
  test("configurator is usable one-handed without horizontal scroll", async ({ page }) => {
    await page.goto("/build");
    await expect(page.getByTestId("build-name")).toBeVisible();
    await expect(page.getByTestId("continue")).toBeInViewport();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: "Expand options" }).click();
    await page.getByTestId("continue").click();
    await page.getByTestId("opt-dial-teal-explorer").click();
    await expect(page.getByTestId("build-name")).toHaveText(/Teal/);
    const box = await page.getByTestId("continue").boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test("storefront pages have no horizontal overflow", async ({ page }) => {
    for (const path of ["/", "/timepieces", "/timepieces/notte-40-black", "/rare-pieces", "/atelier", "/contact", "/bag", "/checkout"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});
