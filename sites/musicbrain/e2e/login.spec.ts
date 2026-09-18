import type { Page } from "@playwright/test";

import { USERS } from "./env";
import { expect, test } from "./test";

async function signIn(page: Page, name: string, password: string) {
  await page.getByLabel("username").fill(name);
  await page.getByLabel("password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

const loginForm = (page: Page) => page.getByRole("button", { name: "Sign in" });

test.describe("login", () => {
  test("every admin URL shows the login form to a visitor", async ({ page }) => {
    for (const url of ["/admin", "/admin/product", "/admin/users"]) {
      await page.goto(url);
      await expect(loginForm(page)).toBeVisible();
    }
  });

  test("a wrong password is refused with a message", async ({ page }) => {
    await page.goto("/admin");
    await signIn(page, USERS.editor.name, "not the password");
    await expect(page.getByText("Wrong username or password")).toBeVisible();
    await expect(loginForm(page)).toBeVisible();
  });

  test("an editor signs in, sees who they are, and signs out again", async ({ page }) => {
    await page.goto("/admin");
    await signIn(page, USERS.editor.name, USERS.editor.password);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText(`${USERS.editor.name} · editor`).first()).toBeAttached();

    await page.getByRole("button", { name: "Afmelden" }).click();
    await expect(loginForm(page)).toBeVisible();
    await page.goto("/admin/product");
    await expect(loginForm(page)).toBeVisible();
  });

  test("a reader has an account but no way in", async ({ page }) => {
    await page.goto("/admin");
    await signIn(page, USERS.reader.name, USERS.reader.password);
    await expect(loginForm(page)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toHaveCount(0);
  });
});
