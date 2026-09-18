import { authFile, USERS, type Role } from "./env";
import { expect, test as setup } from "./test";

/**
 * Signs in once per role and keeps the browser state, so the other specs start
 * signed in (`test.use({ storageState: authFile("editor") })`). Readers cannot
 * enter the admin at all, so there is no state to keep for them.
 */
for (const role of ["admin", "editor"] satisfies Role[]) {
  setup(`sign in as ${role}`, async ({ page }) => {
    await page.goto("/admin");
    await page.getByLabel("username").fill(USERS[role].name);
    await page.getByLabel("password").fill(USERS[role].password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await page.context().storageState({ path: authFile(role) });
  });
}
