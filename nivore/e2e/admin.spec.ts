import { expect, test } from "@playwright/test";
import { adminLogin } from "./helpers";

test.describe("Admin", () => {
  test("admin area is protected", async ({ page, request }) => {
    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Forders/);
    const api = await request.get("/api/admin/export/orders");
    expect(api.status()).toBe(401);
  });

  test("a new dial created in the admin appears in the builder once active", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/components/new?type=dial");
    await page.getByLabel("Name", { exact: true }).fill("Saffron sunburst · Date");
    await page.getByLabel("Id (permanent)").fill("dial-saffron-date");
    await page.getByLabel("Selling price (EGP)").fill("1450");
    await page.getByLabel("Colour Name").fill("Saffron");
    await page.getByLabel("Colour (hex)", { exact: true }).fill("#b8862b");
    await page.getByLabel("Active in the builder").check();
    await page.getByTestId("admin-save").click();
    await page.waitForURL("**/admin/components/dial-saffron-date");

    await page.goto("/build");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/build");
    await page.getByRole("button", { name: /Step 02: Dial/ }).click();
    await page.getByTestId("opt-dial-saffron-date").click();
    await expect(page.getByTestId("build-name")).toHaveText(/ALBA 39 · Saffron/);
  });

  test("inventory change makes a part unavailable in the builder", async ({ page }) => {
    await adminLogin(page);
    const setStock = async (status: string) => {
      await page.goto("/admin/components/dial-graphite-gmt");
      await page.getByLabel("Stock status").selectOption(status);
      await page.getByTestId("admin-save").click();
      await expect(page.getByText("Saved.")).toBeVisible();
    };
    await setStock("out_of_stock");
    await page.goto("/build");
    await page.getByRole("button", { name: /Step 02: Dial/ }).click();
    await page.getByRole("button", { name: /Not available with your choices/ }).click();
    await expect(page.getByTestId("opt-dial-graphite-gmt")).toContainText("Currently unavailable");
    await setStock("in_stock"); // leave the shared store as we found it
  });

  test("storefront lock: coming soon with countdown, then checkout-only lock", async ({ page, browser }) => {
    await adminLogin(page);
    await page.goto("/admin/storefront");
    await page.getByTestId("mode-coming_soon").check({ force: true });
    await page.getByTestId("launch-at").fill("2099-01-01T10:00");
    await page.getByTestId("admin-save").click();
    await expect(page.getByText(/Storefront updated/)).toBeVisible();

    const visitor = await browser.newContext();
    const v = await visitor.newPage();
    await v.goto("/timepieces");
    await expect(v.getByRole("timer")).toBeVisible();
    await expect(v.getByText("Collection 01. Composed one at a time.")).toBeVisible();
    const api = await v.request.post("/api/quote", { headers: { origin: "http://localhost:3200" }, data: { items: [] } });
    expect(api.status()).toBe(503);

    // Admin still sees the full site.
    await page.goto("/timepieces");
    await expect(page.getByRole("heading", { name: "Timepieces" })).toBeVisible();

    await page.goto("/admin/storefront");
    await page.getByTestId("mode-live").check({ force: true });
    await page.getByTestId("checkout-lock").check();
    await page.getByTestId("admin-save").click();
    await expect(page.getByText(/Storefront updated/)).toBeVisible();
    await v.goto("/checkout");
    await expect(v.getByText("Ordering is paused for a moment.")).toBeVisible();
    const order = await v.request.post("/api/orders", { headers: { origin: "http://localhost:3200" }, multipart: { payload: "{}" } });
    expect(order.status()).toBe(403);

    await page.getByTestId("checkout-lock").uncheck();
    await page.getByTestId("admin-save").click();
    await expect(page.getByText(/Storefront updated/)).toBeVisible();
    await visitor.close();
  });
});

test.describe("Rare pieces (demonstration)", () => {
  test("bid validation, acceptance and duplicate protection", async ({ page, request }) => {
    await page.goto("/rare-pieces/n01-notte-40-burgundy");
    await expect(page.getByText("Demonstration room")).toBeVisible();
    await page.fill('input[name="name"]', "Nour Saleh");
    await page.fill('input[name="email"]', "nour@example.com");
    await page.fill('input[name="phone"]', "01212345678");
    await page.getByTestId("bid-amount").fill("1000");
    await page.check('input[name="terms"]');
    await page.getByTestId("place-bid").click();
    await expect(page.getByText("Enter at least EGP 14,000, in whole pounds.")).toBeVisible();
    await page.getByTestId("bid-amount").fill("14000");
    await page.getByTestId("place-bid").click();
    await expect(page.getByText(/Demonstration bid recorded/)).toBeVisible();
    await expect(page.getByTestId("current-bid")).toHaveText("EGP 14,000");

    // Same bidder cannot outbid themselves; replayed idempotency key is refused.
    const body = { amountMinor: 1_500_000, idempotencyKey: "replay-key-123", acceptTerms: true, bidder: { name: "Nour Saleh", email: "nour@example.com", phone: "01212345678" } };
    const r1 = await request.post("/api/auctions/auc-01/bids", { headers: { origin: "http://localhost:3200" }, data: body });
    expect((await r1.json()).code).toBe("already_leading");
    const other = { ...body, idempotencyKey: "replay-key-456", bidder: { name: "Karim", email: "karim@example.com", phone: "01512345678" } };
    const r2 = await request.post("/api/auctions/auc-01/bids", { headers: { origin: "http://localhost:3200" }, data: other });
    expect(r2.status()).toBe(201);
    const r3 = await request.post("/api/auctions/auc-01/bids", { headers: { origin: "http://localhost:3200" }, data: { ...other, amountMinor: 1_600_000 } });
    expect((await r3.json()).code).toBe("duplicate");
    const upcoming = await request.post("/api/auctions/auc-02/bids", { headers: { origin: "http://localhost:3200" }, data: { ...other, idempotencyKey: "upcoming-1" } });
    expect((await upcoming.json()).code).toBe("not_open");
  });
});
