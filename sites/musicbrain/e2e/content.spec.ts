import type { Page } from "@playwright/test";

import { authFile } from "./env";
import { expect, test } from "./test";

test.use({ storageState: authFile("editor") });

/**
 * The editing cycle on one content type (products): save, the public page
 * following suit, validation, history and restore, create and delete. The
 * cases build on each other — one database, run in order.
 */
test.describe.configure({ mode: "serial" });

const ORIGINAL = "Any pre-amp to any power amp to any cab.";
const FIRST = "e2e: first edited tagline";
const SECOND = "e2e: second edited tagline";

const tagline = (page: Page) => page.getByLabel("tagline", { exact: true });
const saveButton = (page: Page) => page.getByRole("button", { name: "Save new version" });

async function saveTagline(page: Page, text: string) {
  await page.goto("/admin/product/edit/relay?lang=en");
  await tagline(page).fill(text);
  await saveButton(page).click();
  await expect(page.getByText("Saved ✓")).toBeVisible();
}

/** The public product page, as a visitor gets it (description = tagline). */
async function publicTagline(page: Page, slug: string): Promise<string | null> {
  await page.goto(`/products/${slug}`);
  return page.locator('meta[name="description"]').getAttribute("content");
}

test.describe("editing content", () => {
  test("a save creates a version and the public page follows", async ({ page }) => {
    expect(await publicTagline(page, "relay")).toContain(ORIGINAL);
    await saveTagline(page, FIRST);
    await page.reload();
    await expect(tagline(page)).toHaveValue(FIRST);
    expect(await publicTagline(page, "relay")).toBe(FIRST);
  });

  test("an invalid value is refused and nothing is stored", async ({ page }) => {
    await page.goto("/admin/product/edit/relay?lang=en");
    await tagline(page).fill("");
    await saveButton(page).click();
    await expect(page.getByText("Saved ✓")).toHaveCount(0);
    // The message names the field. It is raw zod JSON for now (backlog).
    await expect(saveButton(page).locator("..")).toContainText(/"tagline"[\s\S]*Too small/);
    await page.reload();
    await expect(tagline(page)).toHaveValue(FIRST);
  });

  test("history lists every version, newest first, by whom", async ({ page }) => {
    await saveTagline(page, SECOND);
    await page.goto("/admin/product/history/relay?lang=en");
    const versions = page.locator("article");
    await expect(versions).toHaveCount(3); // seed, FIRST, SECOND
    await expect(versions.first()).toContainText("current");
    await expect(versions.first()).toContainText("by e2e-editor");
    await expect(versions.first()).toContainText(SECOND);
    await expect(versions.last()).toContainText("superseded");
    await expect(versions.last()).toContainText(ORIGINAL);
  });

  test("restore asserts an old version again; history is not rewritten", async ({ page }) => {
    await page.goto("/admin/product/history/relay?lang=en");
    await page.locator("article").last().getByRole("button", { name: "Restore" }).click();

    const versions = page.locator("article");
    await expect(versions).toHaveCount(4);
    await expect(versions.first()).toContainText("current");
    await expect(versions.first()).toContainText(ORIGINAL);
    await expect(versions.nth(1)).toContainText(SECOND);
    expect(await publicTagline(page, "relay")).toContain(ORIGINAL);
  });

  test("a new product can be created, is public, and can be deleted again", async ({ page }) => {
    await page.goto("/admin/product/edit");
    await page.getByLabel("slug", { exact: true }).fill("e2e-probe");
    await page.getByLabel("name", { exact: true }).fill("E2E Probe");
    await tagline(page).fill("Made by the browser tests");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("Saved ✓")).toBeVisible();

    await page.goto("/admin/product");
    const row = page.getByRole("row", { name: /E2E Probe/ });
    await expect(row).toBeVisible();
    expect(await publicTagline(page, "e2e-probe")).toBe("Made by the browser tests");

    await page.goto("/admin/product");
    await row.getByRole("button", { name: "Delete" }).click();
    await expect(row).toHaveCount(0);
    const response = await page.goto("/products/e2e-probe");
    expect(response?.status()).toBe(404);
  });
});
