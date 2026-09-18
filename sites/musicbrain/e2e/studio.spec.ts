import { authFile } from "./env";
import { expect, test } from "./test";

test.use({ storageState: authFile("editor") });

/**
 * Smoke only: the studio is Fase 4 territory. It is here because it hands the
 * most data from server to client, which is where console errors come from —
 * the check itself is the `pageErrors` fixture in test.ts.
 */
test.describe("studio", () => {
  test("opens a composed page without logging errors", async ({ page }) => {
    await page.goto("/admin/page/edit/editor");
    await expect(page.getByRole("button", { name: /save/i }).first()).toBeVisible();
  });
});
