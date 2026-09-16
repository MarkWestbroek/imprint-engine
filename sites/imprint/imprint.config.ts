import path from "node:path";
import { WidgetTypeRegistry } from "@imprint/content-core";
import { defineImprint } from "@imprint/extension-api";

/**
 * The Imprint product site — the instance description (architecture.md §0).
 * Runs on Postgres via DATABASE_URL (`postgres://…`), on `content/` without.
 * No widget catalogue yet: pages are still code; the shared renderer and
 * admin arrive with the next phases.
 */
export default defineImprint({
  id: "imprint",
  store: {
    databaseUrl: process.env.DATABASE_URL,
    contentDir: path.join(process.cwd(), "content"),
  },
  widgets: new WidgetTypeRegistry(),
});
