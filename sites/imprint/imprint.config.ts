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
  contentTypes: ["page", "menu", "theme", "site", "relations", "asset", "taglist"],
  // Unset locally (engine default: .assets/); the container points these at a volume.
  assets: {
    root: process.env.ASSET_ROOT,
    baseUrl: process.env.ASSET_BASE_URL,
    // A bucket of its own (design/beeldbibliotheek.md §8) when ASSET_S3_* is set; else on disk.
    s3: {
      endpoint: process.env.ASSET_S3_ENDPOINT,
      bucket: process.env.ASSET_S3_BUCKET,
      accessKey: process.env.ASSET_S3_ACCESS_KEY,
      secretKey: process.env.ASSET_S3_SECRET_KEY,
      region: process.env.ASSET_S3_REGION,
    },
  },
  // Visits report (GoAccess from the web server's log, deploy/vps/stats.sh); unset locally.
  stats: { reportDir: process.env.STATS_REPORT_DIR },
  secrets: {
    session: process.env.SESSION_SECRET,
    ingestToken: process.env.INGEST_TOKEN,
  },
});
