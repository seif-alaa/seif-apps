import { expect, test } from "@playwright/test";
import { adminLogin } from "./helpers";

async function addCatalogPiece(page: import("@playwright/test").Page, slug = "alba-36-ivory") {
  await page.goto(`/timepieces/${slug}`);
  await page.getByTestId("pdp-add").click();
  await expect(page.getByText("Added.")).toBeVisible();
}

test.describe("Bag and checkout", () => {
  test("validation, cash on delivery order, confirmation and status lookup", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await addCatalogPiece(page);
    await page.goto("/bag");
    await expect(page.getByTestId("bag-items")).toContainText("ALBA 36 · Ivory");
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
    const q = await request.post("/api/quote", {
      headers: { origin: "http://localhost:3200" },
      data: { items: [{ kind: "catalog", productId: "p-notte-40-black", quantity: 1, priceMinor: 1 }], promoCode: "FAKE" },
    });
    const body = await q.json();
    expect(body.lines[0].unitMinor).toBe(1_495_000);
    expect(body.totals.promoError).toMatch(/not recognised/);
    const bad = await request.post("/api/quote", { headers: { origin: "https://evil.example" }, data: { items: [] } });
    expect(bad.status()).toBe(403);
  });

  test("InstaPay order stays pending until the atelier confirms it", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await addCatalogPiece(page, "notte-39-lacquer");
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
