import path from "node:path";
import { defineImprint } from "@imprint/extension-api";
import { widgetRegistry } from "@/widgets/registry";

/**
 * The Imprint product site — the instance description (architecture.md §0).
 * Runs on Postgres via DATABASE_URL (`postgres://…`), on `content/` without.
 * The hand-built routes are code; pages from the store render through the
 * engine renderer with this site's own widget selection (src/widgets/).
 */
export default defineImprint({
  id: "imprint",
  store: {
    databaseUrl: process.env.DATABASE_URL,
    contentDir: path.join(process.cwd(), "content"),
  },
  widgets: widgetRegistry,
  // A product site: pages and their chrome, no catalogue, planning or wiki.
  contentTypes: ["page", "menu", "theme", "site", "relations"],
  secrets: {
    session: process.env.SESSION_SECRET,
    ingestToken: process.env.INGEST_TOKEN,
  },
});
