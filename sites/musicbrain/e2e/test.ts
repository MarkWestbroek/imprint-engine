import { expect, test as base } from "@playwright/test";

/**
 * Known and harmless, each with its reason. Keep this list short: every entry
 * is a message nobody will see again.
 */
const KNOWN = [
  // The browser noting a 4xx response; specs assert statuses themselves.
  /^Failed to load resource/,
  // Dev only, on a 404: React re-renders the root layout in the browser and
  // notes that ThemeInit's inline script will not run there. It already ran
  // from the server HTML, so the theme is right (backlog: next/script).
  /Encountered a script tag while rendering React component/,
];

/**
 * The `test` every spec imports. On top of the Playwright one it fails a test
 * when the page logged an error or threw: hydration mismatches and "Only plain
 * objects can be passed to Client Components" show up there and nowhere else.
 * React reports those in development only, hence `npm run test:e2e:dev`.
 */
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        if (KNOWN.some((known) => known.test(msg.text()))) return;
        errors.push(`console.error: ${msg.text()}`);
      });
      await use(errors);
      expect(errors, "the page logged errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
