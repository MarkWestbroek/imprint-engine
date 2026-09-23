import type { APIRequestContext, Page } from "@playwright/test";

import { authFile, INGEST_TOKEN, USERS } from "./env";
import { expect, test } from "./test";

/**
 * Public and restricted (design/fase-3 §4.3): restricted content never
 * reaches a visitor — not the page, not the API, not a list — and lives for
 * signed-in readers under /members. The page is planted through the write API
 * (the ingest token), which is how product projects push content anyway.
 */
test.describe.configure({ mode: "serial" });

const SLUG = "e2e-members-only";
const TITLE = "E2E members only";

async function plant(request: APIRequestContext, access: "public" | "restricted") {
  const response = await request.post(`/api/content/page/${SLUG}`, {
    headers: { authorization: `Bearer ${INGEST_TOKEN}` },
    data: { slug: SLUG, title: TITLE, body: "Only for members.", access },
  });
  expect(response.ok(), await response.text()).toBe(true);
}

async function signIn(page: Page, name: string, password: string) {
  await page.goto("/admin");
  await page.getByLabel("username").fill(name);
  await page.getByLabel("password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  // A reader lands on the login form again (no admin for readers), so there is
  // no heading to wait for: wait for the sign-in round trip itself.
  await page.waitForLoadState("networkidle");
}

test.describe("restricted content", () => {
  test("a visitor is sent to /members and gets nothing there", async ({ page, request }) => {
    await plant(request, "restricted");

    const response = await page.goto(`/${SLUG}`);
    await expect(page).toHaveURL(`/members/${SLUG}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByText(TITLE)).toHaveCount(0);
  });

  test("the API and the page list do not mention it to a visitor", async ({ request }) => {
    const list = (await (await request.get("/api/content/pages")).json()) as { slug: string }[];
    expect(list.map((p) => p.slug)).not.toContain(SLUG);
    expect((await request.get(`/api/content/pages/${SLUG}`)).status()).toBe(404);
  });

  test("a signed-in reader sees it under /members, and in the API", async ({ page }) => {
    await signIn(page, USERS.reader.name, USERS.reader.password);
    await page.goto(`/members/${SLUG}`);
    await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();

    const list = (await (await page.request.get("/api/content/pages")).json()) as { slug: string }[];
    expect(list.map((p) => p.slug)).toContain(SLUG);
  });

  test("an editor finds it in the admin like any other page", async ({ browser }) => {
    const editor = await browser.newContext({ storageState: authFile("editor") });
    const page = await editor.newPage();
    await page.goto("/admin/page");
    await expect(page.getByRole("row", { name: new RegExp(TITLE) })).toBeVisible();
    await editor.close();
  });

  test("made public again, it is back on its own URL for everyone", async ({ page, request }) => {
    await plant(request, "public");
    const response = await page.goto(`/${SLUG}`);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(`/${SLUG}`);
    await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
  });
});
