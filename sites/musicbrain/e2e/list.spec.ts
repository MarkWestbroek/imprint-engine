import { authFile } from "./env";
import { expect, test } from "./test";

test.use({ storageState: authFile("editor") });

test.describe("lists", () => {
  test("the product list shows the seeded products", async ({ page }) => {
    await page.goto("/admin/product");
    await expect(page.getByRole("heading", { name: "products" })).toBeVisible();
    for (const name of ["Cortex", "Reflex", "Relay"]) {
      await expect(page.getByRole("row", { name: new RegExp(name) })).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "+ New product" })).toBeVisible();
  });

  test("the dashboard counts what the lists show", async ({ page }) => {
    await page.goto("/admin/product");
    const products = (await page.getByRole("row").count()) - 1; // minus the header row

    await page.goto("/admin");
    const tile = page.getByRole("main").getByRole("link", { name: /Products/ });
    await expect(tile).toContainText(String(products));
    await tile.click();
    await expect(page).toHaveURL(/\/admin\/product$/);
  });

  test("a type the catalogue does not list is a 404", async ({ page }) => {
    // Unknown to the model, and known but without a generic list.
    for (const type of ["blog", "relations-doc"]) {
      const response = await page.goto(`/admin/${type}`);
      expect(response?.status(), type).toBe(404);
    }
  });

  test("an editor gets no user management in the menu; an admin does", async ({ page, browser }) => {
    await page.goto("/admin");
    await expect(page.getByRole("link", { name: "Beheer" })).toHaveCount(0);

    const admin = await browser.newContext({ storageState: authFile("admin") });
    const adminPage = await admin.newPage();
    await adminPage.goto("/admin");
    await expect(adminPage.getByRole("link", { name: "Beheer" })).toBeVisible();
    await admin.close();
  });
});
