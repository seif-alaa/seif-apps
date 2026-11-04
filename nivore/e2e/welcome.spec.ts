import { expect, test } from "@playwright/test";

const BUILD = { family: "SKX", case: "case_SKX_steel", bezel: "bezel_SKX_dive_black", dial: "dial_SKX_black", hands: "hands_SKX_mercedes", band: "bracelet_SKX_oyster_steel" };
const item = { kind: "custom", build: BUILD, quantity: 1 };

test.describe("First-visit offer", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("opens after 6 s, validates, shows the code, and is not shown again", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const dialog = page.getByRole("dialog", { name: "5% off your first NIVORÉ" });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog).toContainText("Leave your email or mobile number and we’ll send your code.");
    await expect(dialog.getByRole("checkbox")).not.toBeChecked();
    // focus is inside the dialog and Tab stays there
    for (let i = 0; i < 8; i++) await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.closest("[role=dialog]") != null)).toBe(true);

    await dialog.getByRole("button", { name: "Get my 5%" }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await dialog.getByRole("textbox").fill("010 1234 567");
    await dialog.getByRole("button", { name: "Get my 5%" }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();

    await dialog.getByRole("textbox").fill("+20 101 234 5678");
    await dialog.getByRole("button", { name: "Get my 5%" }).click();
    await expect(page.getByTestId("welcome-code")).toHaveText("WELCOME5");
    await expect(page.getByRole("dialog")).toContainText("Applied automatically at checkout.");
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("nv_welcome_v1") ?? "null"));
    expect(saved).toMatchObject({ state: "done", code: "WELCOME5", contact: "+201012345678" });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.reload();
    await page.waitForTimeout(1500);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("closing hides it for 14 days; it never opens on checkout", async ({ page }) => {
    await page.goto("/checkout");
    await page.waitForTimeout(7000);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goto("/timepieces");
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "No thanks" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("nv_welcome_v1") ?? "null"));
    expect(saved.state).toBe("closed");
  });

  test("server: validation, honeypot, and WELCOME5 only for a subscriber without an order", async ({ request }) => {
    const bad = await request.post("/api/subscribe", { data: { contact: "not a contact" } });
    expect(bad.status()).toBe(422);
    const trap = await request.post("/api/subscribe", { data: { contact: "bot@example.com", website: "x" } });
    expect(trap.ok()).toBe(true);
    const ok = await request.post("/api/subscribe", { data: { contact: "Welcome.Test@Example.com", consent: true } });
    expect(await ok.json()).toMatchObject({ ok: true, code: "WELCOME5", contact: "welcome.test@example.com", type: "email" });

    const quote = async (contacts: string[]) => (await request.post("/api/quote", { data: { items: [item], promoCode: "WELCOME5", method: "pickup", contacts } })).json();
    const yes = await quote(["welcome.test@example.com"]);
    expect(yes.totals.discountMinor).toBe(Math.round(yes.totals.subtotalMinor * 0.05));
    expect(yes.totals.discountMinor).toBeGreaterThan(0);
    expect(yes.totals.promoError).toBeNull();
    const no = await quote(["stranger@example.com"]);
    expect(no.totals.discountMinor).toBe(0);
    expect(no.totals.promoError).toBeTruthy();
    const trapped = await quote(["bot@example.com"]);
    expect(trapped.totals.discountMinor).toBe(0);
  });
});
