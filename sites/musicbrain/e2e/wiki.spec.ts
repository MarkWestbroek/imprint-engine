import { authFile } from "./env";
import { expect, test } from "./test";

test.use({ storageState: authFile("editor") });

/**
 * The wiki as a plugin (design/fase-5): create through the plugin-action
 * dispatcher, the tree studio through the plugin-screen hook, the public
 * URL through the public-route hook, and restricted access through /members.
 */
test.describe.configure({ mode: "serial" });

const SLUG = "e2e-wiki";

test.describe("wiki plugin", () => {
  test("creating a wiki lands in its studio; the menu lists Wikis", async ({ page }) => {
    await page.goto("/admin/wiki");
    await expect(page.locator("aside").getByRole("link", { name: "Wikis" })).toBeVisible();
    await page.getByLabel("Titel").fill("E2E Wiki");
    await page.getByRole("button", { name: "Maak wiki" }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/wiki/${SLUG}$`));
    await expect(page.getByRole("heading", { name: "E2E Wiki" })).toBeVisible();
  });

  test("the wiki has its own public URL, claimed by the plugin", async ({ page }) => {
    const response = await page.goto(`/${SLUG}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "E2E Wiki" })).toBeVisible();
    await expect(page).toHaveTitle(/E2E Wiki/);
  });

  test("restricted: a visitor is sent to /members and gets nothing; the editor sees it there", async ({ page, browser }) => {
    await page.goto(`/admin/wiki/${SLUG}`);
    await page.getByLabel("Toegang").selectOption("restricted");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    // The save is a round trip through the dispatcher; the overview shows the stored access value.
    await expect
      .poll(async () => {
        await page.goto("/admin/wiki");
        return page.getByText(`/${SLUG} · en · restricted`).count();
      })
      .toBe(1);

    // A truly anonymous context: `browser.newContext()` would inherit this file's storageState.
    const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const anon = await visitor.newPage();
    const response = await anon.goto(`/${SLUG}`);
    await expect(anon).toHaveURL(`/members/${SLUG}`);
    expect(response?.status()).toBe(404);
    await visitor.close();

    const mine = await page.goto(`/members/${SLUG}`);
    expect(mine?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "E2E Wiki" })).toBeVisible();
  });

  test("an unknown wiki path is a 404 like any other", async ({ page }) => {
    expect((await page.goto(`/${SLUG}/nonesuch`))?.status()).toBe(404);
  });
});
