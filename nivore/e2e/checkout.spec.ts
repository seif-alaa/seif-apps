import { expect, test } from "@playwright/test";
import { adminLogin } from "./helpers";

/** Pieces have no price yet (TODO), so orders are placed with a composition from the builder. */
async function addComposition(page: import("@playwright/test").Page) {
  await page.goto("/build");
  for (let i = 0; i < 6; i++) await page.getByTestId("continue").click();
  await page.getByTestId("review-add").click();
  await expect(page.getByRole("status").filter({ hasText: "Added to your bag" })).toBeVisible();
}

test.describe("Bag and checkout", () => {
  test("validation, cash on delivery order, confirmation and status lookup", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await addComposition(page);
    await page.goto("/bag");
    await expect(page.getByTestId("bag-items")).toContainText("SKX 42");
    await page.getByTestId("to-checkout").click();
    await page.waitForURL("**/checkout");

    // Empty submission shows field errors.
    await expect(page.getByTestId("place-order")).toBeEnabled();
    await page.getByTestId("place-order").click();
    await expect(page.getByText("Please enter your full name.")).toBeVisible();
    await expect(page.getByText(/Enter an Egyptian mobile number/)).toBeVisible();

    await page.fill('input[name="name"]', "Layla Hassan");
    await page.fill('input[name="phone"]', "010 1234 5678");
    await page.fill('input[name="email"]', "layla@example.com");
    await page.selectOption('select[name="governorate"]', "Cairo");
    await page.fill('input[name="city"]', "Zamalek");
    await page.fill('input[name="address"]', "12 Example Street, flat 4");
    await page.getByTestId("pay-cod").click();
    await page.check('input[name="privacy"]');
    // Cairo delivery is EGP 100 in the sample rates.
    await expect(page.getByText("EGP 100", { exact: true })).toBeVisible();
    await page.getByTestId("place-order").click();
    await page.waitForURL(/\/order\/NV\d{4}-\d{4}\?t=/);
    await expect(page.getByTestId("order-confirmation")).toContainText("Thank you, Layla.");
    await expect(page.getByTestId("order-confirmation")).toContainText("Development order");
    const ref = (await page.locator("p.eyebrow").first().textContent())!.replace("Order ", "").trim();

    // Bag cleared after ordering.
    await page.goto("/bag");
    await expect(page.getByText("Your bag is empty.")).toBeVisible();

    await page.goto("/order-status");
    await page.fill('input[name="ref"]', ref);
    await page.fill('input[name="phone"]', "+201012345678");
    await page.click('button:has-text("Check")');
    await expect(page.getByRole("status")).toContainText("Received");
    await page.fill('input[name="phone"]', "01099999999");
    await page.click('button:has-text("Check")');
    await expect(page.getByText("We could not find an order with those details.")).toBeVisible();
  });

  test("server rejects tampered totals and unknown promo codes", async ({ request }) => {
    const build = { family: "SKX", case: "case_SKX_steel", bezel: "bezel_SKX_dive_black", dial: "dial_SKX_black", hands: "hands_SKX_mercedes", band: "bracelet_SKX_oyster_steel" };
    const q = await request.post("/api/quote", {
      headers: { origin: "http://localhost:3200" },
      data: { items: [{ kind: "custom", build, quantity: 1, priceMinor: 1, unitMinor: 1 }], promoCode: "FAKE" },
    });
    const body = await q.json();
    expect(body.lines[0].unitMinor).toBe(150_000); // parts are 0 (TODO prices) + EGP 1,500 assembly, whatever the browser sends
    const unpriced = await request.post("/api/quote", { headers: { origin: "http://localhost:3200" }, data: { items: [{ kind: "catalog", productId: "p-gmt", quantity: 1 }] } });
    expect((await unpriced.json()).lines[0].error).toMatch(/no price yet/);
    const forged = await request.post("/api/quote", { headers: { origin: "http://localhost:3200" }, data: { items: [{ kind: "custom", build: { ...build, dial: "dial_SKX_nope" }, quantity: 1 }] } });
    expect((await forged.json()).ok).toBe(false);
    expect(body.totals.promoError).toMatch(/not recognised/);
    const bad = await request.post("/api/quote", { headers: { origin: "https://evil.example" }, data: { items: [] } });
    expect(bad.status()).toBe(403);
  });

  test("InstaPay order stays pending until the atelier confirms it", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await addComposition(page);
    await page.goto("/checkout");
    await page.fill('input[name="name"]', "Omar Adel");
    await page.fill('input[name="phone"]', "01112345678");
    await page.fill('input[name="email"]', "omar@example.com");
    await page.selectOption('select[name="governorate"]', "Giza");
    await page.fill('input[name="city"]', "Dokki");
    await page.fill('input[name="address"]', "3 Sample Road, flat 9");
    await page.getByTestId("pay-instapay").click();
    await expect(page.getByText("sample-handle@instapay")).toBeVisible();
    await page.fill('input[name="transferReference"]', "IPN-554433");
    await page.check('input[name="privacy"]');
    await page.getByTestId("place-order").click();
    await page.waitForURL(/\/order\//);
    await expect(page.getByTestId("order-confirmation")).toContainText("checking your transfer");
    const ref = (await page.locator("p.eyebrow").first().textContent())!.replace("Order ", "").trim();

    await adminLogin(page);
    await page.goto(`/admin/orders/${ref}`);
    await expect(page.getByText("IPN-554433")).toBeVisible();
    await page.getByRole("button", { name: "Confirm payment received" }).click();
    await page.getByTestId("confirm-payment").click();
    await expect(page.getByText("Payment confirmed.")).toBeVisible();
    await page.reload();
    await expect(page.getByText(/Confirmed .* by atelier@nivore.local/)).toBeVisible();
    await expect(page.locator("header")).toContainText("Payment confirmed");
  });
});
