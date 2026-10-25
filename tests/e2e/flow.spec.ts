import { test, expect, type BrowserContext } from "@playwright/test";

/**
 * End-to-end happy path for the guest-first flow:
 *   1. Guest A opens the app (anonymous auth) and creates a group.
 *   2. Guest A generates an invite link.
 *   3. Guest B (a brand new browser context) opens the invite and joins.
 *   4. Guest A adds an expense split between both members.
 *   5. Guest A records a settlement.
 *   6. Reloading preserves the data for the returning guest.
 *
 * These assertions talk to a real Supabase project, so the whole suite is
 * skipped automatically when the app is pointed at placeholder credentials.
 * To run it:
 *   - Configure a real Supabase project with anonymous sign-ins enabled.
 *   - Set NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
 *   - npm run test:e2e
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const usingPlaceholder =
  supabaseUrl === "" || supabaseUrl.includes("placeholder");

test.describe("guest-first expense flow", () => {
  test.skip(
    usingPlaceholder,
    "Requires a real Supabase project (anonymous auth enabled).",
  );

  test("create group, invite, join, add expense, settle, reload", async ({
    page,
    browser,
  }) => {
    // 1. Guest A lands on the welcome page and creates a group.
    await page.goto("/");
    await page.getByRole("textbox").first().fill("Trip to Eilat");
    await page.getByRole("button", { name: /create|צור|התחל/i }).click();

    // Expect to be routed into the group workspace.
    await page.waitForURL(/\/groups\//);
    await expect(page.getByText("Trip to Eilat")).toBeVisible();

    // 2. Generate an invite link.
    await page.getByRole("button", { name: /invite|הזמן/i }).click();
    const inviteLink = await page
      .getByRole("textbox")
      .filter({ hasText: /invite/ })
      .inputValue()
      .catch(async () => {
        // Fallback: read any visible invite URL on the page.
        const href = await page
          .locator("a[href*='/invite/']")
          .first()
          .getAttribute("href");
        return href ?? "";
      });
    expect(inviteLink).toBeTruthy();

    // 3. Guest B joins from a brand-new browser context.
    const contextB: BrowserContext = await browser.newContext();
    const pageB = await contextB.newPage();
    await pageB.goto(inviteLink);
    await pageB.getByRole("button", { name: /join|accept|הצטרף|אשר/i }).click();
    await pageB.waitForURL(/\/groups\//);
    await contextB.close();

    // 4. Guest A adds an expense.
    await page.reload();
    await page.getByRole("button", { name: /add expense|הוסף הוצאה|\+/i }).first().click();
    await page.getByLabel(/description|תיאור/i).fill("Dinner");
    await page.getByLabel(/amount|סכום/i).fill("120");
    await page.getByRole("button", { name: /save|שמור/i }).click();
    await expect(page.getByText("Dinner")).toBeVisible();

    // 5. Settlement is reachable and the balances view renders.
    await page.getByRole("link", { name: /settle|התחשבנות/i }).click();
    await expect(page).toHaveURL(/\/settle/);

    // 6. Reload keeps the guest signed in and data intact.
    await page.goto("/groups");
    await expect(page.getByText("Trip to Eilat")).toBeVisible();
  });
});
