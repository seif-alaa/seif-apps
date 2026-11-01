import { expect, test } from "@playwright/test";

test.describe("Build your watch (photo layers)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/build");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/build");
  });

  test("new visitors start at Model; the movement is fixed text; unfinished families are greyed out", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Model/ })).toBeVisible();
    await expect(page.getByTestId("family-SKX")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("list", { name: "Coming soon" })).toContainText("Classic 36");
    await expect(page.getByRole("list", { name: "Coming soon" })).toContainText("Octa 40");
    await page.getByTestId("continue").click();
    await expect(page.getByTestId("movement")).toContainText("NH35");
    await expect(page.getByTestId("movement").locator("button, select, input")).toHaveCount(0);
  });

  test("the stage stacks the real photo layers in manifest order", async ({ page }) => {
    const order = await page.locator('[role="img"] img').evaluateAll((els) => els.map((e) => (e as HTMLImageElement).getAttribute("src")?.replace(/^\/parts\/|\.webp$/g, "")));
    expect(order[0]).toMatch(/^(bracelet|strap)_SKX/);
    expect(order[1]).toBe("case_SKX_steel");
    expect(order[2]).toMatch(/^dial_SKX/);
    expect(order[3]).toBe("ring_SKX_brushed");
    expect(order.at(-1)).toBe("bezel_SKX_dive_black");
    expect(await page.locator('[role="img"] svg').count()).toBe(0); // no drawn watch
  });

  test("changing the dial swaps only that layer and updates the name; hands rotate from the centre", async ({ page }) => {
    await page.getByTestId("continue").click(); // case
    await page.getByTestId("continue").click(); // bezel
    await page.getByTestId("continue").click(); // dial
    await page.getByTestId("opt-dial_SKX_navy").click();
    await expect(page.getByTestId("opt-dial_SKX_navy")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("build-name")).toHaveText(/SKX 42 · navy/);
    await expect(page.locator('[role="img"] img[src="/parts/dial_SKX_navy.webp"]')).toHaveCount(1);
    const hand = page.locator('[role="img"] img[src*="hands_SKX"]').first().locator("xpath=..");
    await expect(hand).toHaveCSS("transform-origin", /50% 50%|\d+(\.\d+)?px \d+(\.\d+)?px/);
    expect(await hand.evaluate((e) => (e as HTMLElement).style.transform)).toMatch(/rotate\(/);
  });

  test("the live-time toggle moves the seconds hand", async ({ page }) => {
    const second = page.locator('[role="img"] img[src*="hands_SKX_mercedes_second"]').locator("xpath=..");
    const before = await second.evaluate((e) => (e as HTMLElement).style.transform);
    expect(before).toBe("rotate(210deg)");
    await page.getByTestId("live-time").click();
    await page.waitForTimeout(1300);
    const after = await second.evaluate((e) => (e as HTMLElement).style.transform);
    expect(after).not.toBe(before);
  });

  test("total is parts plus assembly fee; share link opens at Review; old links open the default build", async ({ page, browser }) => {
    for (let i = 0; i < 6; i++) await page.getByTestId("continue").click();
    await expect(page.getByTestId("review")).toBeVisible();
    await expect(page.getByTestId("review-total")).toHaveText("EGP 1,500"); // parts are 0 (TODO prices) + 1,500 assembly
    await page.getByTestId("review").getByRole("button", { name: "Edit" }).nth(3).click(); // dial
    await page.getByTestId("opt-dial_SKX_emerald").click();
    for (let i = 0; i < 3; i++) await page.getByTestId("continue").click();
    await page.waitForTimeout(400);
    const url = page.url();
    expect(url).toContain("b=SKX.");
    const other = await browser.newPage();
    await other.goto(url);
    await expect(other.getByTestId("review")).toBeVisible();
    await expect(other.getByTestId("build-name")).toHaveText(/emerald/);
    await other.goto("/build?b=M1.D03.C02.H01.Z03.X05.S02.K01.B04");
    await expect(other.getByRole("heading", { name: /Model/ })).toBeVisible();
    await other.close();
  });

  test("save, add to bag and edit from the bag", async ({ page }) => {
    for (let i = 0; i < 6; i++) await page.getByTestId("continue").click();
    await page.getByTestId("save-design").click();
    await expect(page.getByRole("status").filter({ hasText: "Saved on this device" })).toBeVisible();
    await page.getByTestId("review-add").click();
    await page.goto("/saved");
    await expect(page.getByText(/SKX 42/).first()).toBeVisible();
    await page.goto("/bag");
    await expect(page.getByTestId("bag-items")).toContainText("SKX 42");
    await expect(page.getByText("Prices confirmed by the atelier’s server.")).toBeVisible();
    await page.getByRole("link", { name: "Edit composition" }).click();
    await expect(page.getByTestId("review")).toBeVisible();
    await expect(page.getByTestId("review-add")).toHaveText("Update bag");
  });

  test("download image produces a PNG", async ({ page }) => {
    for (let i = 0; i < 6; i++) await page.getByTestId("continue").click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download image" }).click()]);
    expect(download.suggestedFilename()).toMatch(/^nivore-nv-.*\.png$/);
  });
});
