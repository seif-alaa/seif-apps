import { expect, type Page } from "@playwright/test";

export async function adminLogin(page: Page) {
  await page.goto("/admin/login");
  await page.fill('input[name="email"]', "atelier@nivore.local");
  await page.fill('input[name="password"]', "atelier-e2e-password");
  await page.click('button:has-text("Sign in")');
  await page.waitForURL("**/admin");
}

export async function priceOf(page: Page): Promise<number> {
  const text = (await page.getByTestId("total-price").textContent()) ?? "";
  return Number(text.replace(/[^\d]/g, ""));
}

/** Wait until the animated price settles. */
export async function settledPrice(page: Page): Promise<number> {
  let last = -1;
  for (let i = 0; i < 20; i++) {
    const p = await priceOf(page);
    if (p === last) return p;
    last = p;
    await page.waitForTimeout(150);
  }
  return last;
}

export async function gotoStep(page: Page, title: string) {
  await page.getByRole("button", { name: new RegExp(`Step \\d+: ${title}`) }).click();
  await expect(page.locator("h2").filter({ hasText: title }).first()).toBeVisible();
}
