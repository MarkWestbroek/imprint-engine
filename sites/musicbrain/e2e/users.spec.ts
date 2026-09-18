import type { Page } from "@playwright/test";

import { authFile, USERS } from "./env";
import { expect, test } from "./test";

test.use({ storageState: authFile("admin") });

/** User management (admins only). The cases build on each other. */
test.describe.configure({ mode: "serial" });

const NEW_USER = "e2e-newcomer";
const PASSWORD = "a long enough password";

const row = (page: Page, name: string) => page.getByRole("row", { name: new RegExp(`^${name}\\b`) });

async function signInFresh(page: Page, name: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/admin");
  await page.getByLabel("username").fill(name);
  await page.getByLabel("password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("user management", () => {
  test("an admin adds a user, who can then sign in", async ({ page, browser }) => {
    await page.goto("/admin/users");
    const form = page.locator("form", { has: page.getByRole("heading", { name: "Add user" }) });
    await form.getByLabel("username").fill(NEW_USER);
    await form.getByLabel("role").selectOption("editor");
    await form.getByLabel("password (optional)").fill(PASSWORD);
    await form.getByRole("button", { name: "Add user" }).click();
    await expect(row(page, NEW_USER)).toBeVisible();

    const fresh = await browser.newPage();
    await signInFresh(fresh, NEW_USER, PASSWORD);
    await expect(fresh.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await fresh.close();
  });

  test("a too short password or a taken name is refused with a message", async ({ page }) => {
    await page.goto("/admin/users");
    const form = page.locator("form", { has: page.getByRole("heading", { name: "Add user" }) });
    await form.getByLabel("username").fill("e2e-short");
    await form.getByLabel("password (optional)").fill("short");
    await form.getByRole("button", { name: "Add user" }).click();
    await expect(form.getByText(/at least 12 characters/)).toBeVisible();

    await form.getByLabel("username").fill(NEW_USER);
    await form.getByLabel("password (optional)").fill(PASSWORD);
    await form.getByRole("button", { name: "Add user" }).click();
    await expect(form.getByText(/already exists/)).toBeVisible();
  });

  test("an admin changes a role", async ({ page }) => {
    await page.goto("/admin/users");
    await row(page, NEW_USER).getByRole("combobox").selectOption("reader");
    await row(page, NEW_USER).getByRole("button", { name: "Set", exact: true }).click();
    await expect(page.getByText(/reader/).first()).toBeVisible();
    await page.reload();
    await expect(row(page, NEW_USER).getByRole("combobox")).toHaveValue("reader");
  });

  // The screen is stricter than the store: nobody demotes themselves, even with
  // another admin around. The store's last-admin guard is covered by its contract.
  test("an admin cannot take the admin role away from themselves", async ({ page }) => {
    await page.goto("/admin/users");
    const self = row(page, USERS.admin.name);
    await self.getByRole("combobox").selectOption("editor");
    await self.getByRole("button", { name: "Set", exact: true }).click();
    await expect(page.getByText("You can't take the admin role away from yourself")).toBeVisible();
    await page.reload();
    await expect(self.getByRole("combobox")).toHaveValue("admin");
  });

  test("an admin deletes a user, who can no longer sign in", async ({ page, browser }) => {
    await page.goto("/admin/users");
    await row(page, NEW_USER).getByRole("button", { name: "Delete" }).click();
    await expect(row(page, NEW_USER)).toHaveCount(0);

    const fresh = await browser.newPage();
    await signInFresh(fresh, NEW_USER, PASSWORD);
    await expect(fresh.getByText("Wrong username or password")).toBeVisible();
    await fresh.close();
  });

  test("an editor cannot manage users", async ({ browser }) => {
    const editor = await browser.newContext({ storageState: authFile("editor") });
    const page = await editor.newPage();
    await page.goto("/admin/users");
    await expect(page.getByRole("heading", { name: "Add user" })).toHaveCount(0);
    await expect(page.getByRole("row", { name: new RegExp(USERS.reader.name) })).toHaveCount(0);
    await editor.close();
  });
});
