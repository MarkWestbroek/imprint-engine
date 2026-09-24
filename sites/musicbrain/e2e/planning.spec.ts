import { authFile } from "./env";
import { expect, test } from "./test";

test.use({ storageState: authFile("editor") });

/**
 * Planning as a plugin (design/fase-5): the screens come in through the
 * `/admin/<plugin>` hook, the actions through the site's one dispatcher, the
 * content types and the menu item through `plugins: [planningPlugin()]`.
 * The seed plants the "roadmap" board with three cards.
 */
test.describe.configure({ mode: "serial" });

test.describe("planning plugin", () => {
  test("the menu lists Planning, the plugin screen lists the seeded board", async ({ page }) => {
    await page.goto("/admin/planning");
    await expect(page.getByRole("heading", { name: "Planning" })).toBeVisible();
    await expect(page.locator("aside").getByRole("link", { name: "Planning" })).toBeVisible();
    await expect(page.getByRole("link", { name: /roadmap/ })).toBeVisible();
  });

  test("a board renders its phases and cards through the deeper plugin route", async ({ page }) => {
    await page.goto("/admin/planning/roadmap");
    await expect(page.getByRole("heading", { name: "Planning", exact: true })).toBeVisible();
    for (const phase of ["Backlog", "Onderhanden"]) await expect(page.getByText(phase).first()).toBeVisible();
    await expect(page.getByText("VCF8 module")).toBeVisible();
    await expect(page.getByText("Busboard")).toBeVisible();
  });

  test("creating a board goes through the plugin-action dispatcher", async ({ page }) => {
    await page.goto("/admin/planning");
    await page.getByPlaceholder("roadmap", { exact: true }).fill("e2e-board");
    await page.getByPlaceholder("Roadmap", { exact: true }).fill("E2E board");
    await page.getByRole("button", { name: "Create board" }).click();
    await expect(page).toHaveURL(/\/admin\/planning\/e2e-board$/);
    await expect(page.getByRole("heading", { name: "E2E board" })).toBeVisible();
  });

  test("the planning widget renders the board on the public page", async ({ page }) => {
    const response = await page.goto("/planning");
    expect(response?.status()).toBe(200);
    await expect(page.getByText("VCF8 module")).toBeVisible();
  });

  test("an unknown plugin or a deeper path nobody serves is a 404", async ({ page }) => {
    expect((await page.goto("/admin/nonesuch"))?.status()).toBe(404);
    expect((await page.goto("/admin/planning/roadmap/deeper"))?.status()).toBe(404);
  });
});
