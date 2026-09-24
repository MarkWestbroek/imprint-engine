import type { Page } from "@playwright/test";

import { authFile } from "./env";
import { expect, test } from "./test";

test.use({ storageState: authFile("editor") });

/**
 * The page studio (design/fase-3; the extraction of Fase 4 leans on this):
 * compose a new page from a row and a widget, configure it in the sidebar,
 * save, and find it on the public site — plus the smoke check that opening
 * an existing composed page logs nothing (the `pageErrors` fixture).
 */
test.describe.configure({ mode: "serial" });

const SLUG = "e2e-studio";

/**
 * Every sidebar edit goes to the server draft ~350 ms after the last
 * keystroke; wait for that debounce, then for the round trip to finish.
 */
async function synced(page: Page) {
  await page.waitForTimeout(600);
  await expect(page.getByText("syncing…")).toHaveCount(0);
}

test.describe("studio", () => {
  test("opens a composed page without logging errors", async ({ page }) => {
    await page.goto("/admin/page/edit/editor");
    await expect(page.getByRole("button", { name: "Save new version" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Page settings" })).toBeVisible();
  });

  test("the settings panel folds away; picking a widget unfolds it", async ({ page }) => {
    await page.goto("/admin/page/edit/editor");
    await page.getByRole("button", { name: "Hide settings" }).click();
    await expect(page.getByRole("heading", { name: "Page settings" })).toBeHidden();
    await page.locator('[title^="Edit "]').first().click();
    await expect(page.getByRole("button", { name: "Hide settings" })).toBeVisible();
    await page.getByRole("button", { name: "Hide settings" }).click();
    await page.getByRole("button", { name: "Show settings" }).click();
    // The selection survives folding: the widget's pane is back, not the page settings.
    await expect(page.getByRole("button", { name: "✓ Done" })).toBeVisible();
  });

  test("the admin's own panel folds too, and stays folded across a reload", async ({ page }) => {
    await page.goto("/admin/page/edit/editor");
    const panel = page.locator("aside").filter({ hasText: "Pages" });
    await expect(panel).toBeVisible();
    await page.getByRole("button", { name: "Hide panel" }).click();
    await expect(panel).toBeHidden();
    await page.reload();
    await expect(page.getByRole("button", { name: "Save new version" })).toBeVisible();
    await expect(panel).toBeHidden();
    // The active rail icon brings it back (VS Code behaviour).
    await page.locator("nav a[aria-current=page]").click();
    await expect(panel).toBeVisible();
  });

  test("composes a new page: settings, a row, a hero widget, save", async ({ page }) => {
    await page.goto("/admin/page/edit");
    await page.getByLabel("slug", { exact: true }).fill(SLUG);
    await page.getByLabel("title", { exact: true }).fill("E2E Studio");
    await synced(page);

    await page.getByRole("button", { name: "＋ Add row" }).click();
    await page.getByRole("button", { name: "＋ Add widget" }).click();
    await page.getByRole("button", { name: "Hero", exact: true }).click();

    // The new widget is selected: its editor is in the sidebar.
    await expect(page.getByRole("heading", { name: /^Hero/ })).toBeVisible();
    await page.getByLabel("title", { exact: true }).fill("Hallo *studio*");
    await synced(page);
    // The canvas re-renders from the draft with the real viewer.
    await expect(page.locator("main").getByText("studio").first()).toBeVisible();

    await page.getByRole("button", { name: "Create page" }).click();
    // Creating moves the studio to the page's own URL (the "Saved ✓" message
    // does not survive that move — backlog); the next test proves the save.
    await expect(page).toHaveURL(new RegExp(`/admin/page/edit/${SLUG}`));
    await expect(page.getByText(`/${SLUG}`, { exact: true })).toBeVisible();
  });

  test("the saved page is live, and has one version", async ({ page }) => {
    const response = await page.goto(`/${SLUG}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /Hallo/ })).toBeVisible();

    await page.goto(`/admin/page/history/${SLUG}?lang=en`);
    await expect(page.locator("article")).toHaveCount(1);
    await expect(page.locator("article").first()).toContainText('"type": "hero"');
  });

  test("a second edit through the studio makes a second version", async ({ page }) => {
    await page.goto(`/admin/page/edit/${SLUG}?lang=en`);
    await page.locator('[title="Edit Hero"]').click();
    await page.getByLabel("subtitle", { exact: true }).fill("Tweede versie");
    await synced(page);
    await page.getByRole("button", { name: "Save new version" }).click();
    await expect(page.getByText("Saved ✓")).toBeVisible();

    await page.goto(`/${SLUG}`);
    await expect(page.getByText("Tweede versie")).toBeVisible();
    await page.goto(`/admin/page/history/${SLUG}?lang=en`);
    await expect(page.locator("article")).toHaveCount(2);
  });
});
