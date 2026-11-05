import { expect, test } from "./_support/fixtures";

/**
 * 6.0 acceptance smoke: the app boots and the login page renders. Runs without
 * the authenticated storage state so it only proves the server is up and the
 * login UI is reachable.
 */
test.use({ storageState: undefined });

test.describe("harness smoke", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Iniciar sesión" }),
    ).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test("authenticated state reaches the editor", async ({
    browser,
    e2eUserId,
  }) => {
    // Uses the default storageState (signed in). Proves global setup produced a
    // valid session and the e2e user id was resolved for teardown scoping.
    expect(e2eUserId).toMatch(/[0-9a-f-]{36}/);
    const context = await browser.newContext({
      storageState: "./e2e/.auth/state.json",
    });
    const page = await context.newPage();
    await page.goto("/editor");
    // Signed in → not bounced to /login.
    await expect(page).not.toHaveURL(/\/login/);
    await context.close();
  });
});
