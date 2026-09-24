import type { Page } from "@playwright/test";

import { authFile } from "./env";
import { expect, test } from "./test";

test.use({ storageState: authFile("editor") });

/**
 * The client-side standard widgets (design/plank-widgets-en-plugins.md §2):
 * compose a page with code, a mermaid diagram, tabs and a table of contents
 * through the studio, then prove on the public page that highlighting came
 * from the server, mermaid drew an SVG in the browser, the tabs switch and
 * the TOC found the headings — whichever widget they live in.
 */
test.describe.configure({ mode: "serial" });

const SLUG = "e2e-widgets";

async function synced(page: Page) {
  await page.waitForTimeout(600);
  await expect(page.getByText("syncing…")).toHaveCount(0);
}

async function addWidget(page: Page, label: string) {
  await page.getByRole("button", { name: "＋ Add widget" }).first().click();
  await page.getByRole("button", { name: label, exact: true }).click();
}

test.describe("standard widgets", () => {
  test("compose code, mermaid, tabs and a TOC in the studio", async ({ page }) => {
    await page.goto("/admin/page/edit");
    await page.getByLabel("slug", { exact: true }).fill(SLUG);
    await page.getByLabel("title", { exact: true }).fill("E2E Widgets");
    await synced(page);
    await page.getByRole("button", { name: "＋ Add row" }).click();

    await addWidget(page, "Code");
    await page.getByLabel("language").selectOption("typescript");
    await page.getByLabel("code", { exact: true }).fill("export const answer: number = 42;");
    await synced(page);

    await addWidget(page, "Mermaid diagram");
    await page.getByLabel("code", { exact: true }).fill("flowchart LR\n  A[Studio] --> B[Site]");
    await synced(page);

    await addWidget(page, "Tabs");
    await page
      .getByLabel(/^tabs/)
      .fill('[{"label":"One","markdown":"## Alpha\\n\\nfirst panel"},{"label":"Two","markdown":"## Beta\\n\\nsecond panel"}]');
    await synced(page);

    await addWidget(page, "Table of contents");
    await synced(page);

    await page.getByRole("button", { name: "Create page" }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/page/edit/${SLUG}`));
  });

  test("the public page: server highlighting, browser-drawn diagram, tabs, TOC", async ({ page }) => {
    const response = await page.goto(`/${SLUG}`);
    expect(response?.status()).toBe(200);

    // shiki ran on the server: the HTML already carries the token colours.
    const code = page.locator("pre.shiki");
    await expect(code).toBeVisible();
    await expect(code).toContainText("answer");
    expect(await code.locator("span[style*='color']").count()).toBeGreaterThan(2);

    // mermaid drew the diagram client-side.
    const diagram = page.locator("svg[id^='mermaid-']");
    await expect(diagram).toBeVisible();
    await expect(diagram).toContainText("Studio");

    // Tabs: the first panel is open; the second opens on click.
    await expect(page.getByText("first panel")).toBeVisible();
    await expect(page.getByText("second panel")).toBeHidden();
    await page.getByRole("tab", { name: "Two" }).click();
    await expect(page.getByText("second panel")).toBeVisible();
    await expect(page.getByText("first panel")).toBeHidden();

    // The TOC lists the headings that live inside the tabs.
    const toc = page.getByRole("navigation", { name: "On this page" });
    await expect(toc.getByRole("link", { name: "Alpha" })).toHaveAttribute("href", "#alpha");
    await expect(toc.getByRole("link", { name: "Beta" })).toBeVisible();
  });
});
