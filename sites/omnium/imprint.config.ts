import path from "node:path";
import { defineImprint } from "@imprint/extension-api";
import { widgetRegistry } from "@/widgets/registry";

/**
 * The Omnium information site (Dutch): what Omnium is and where it stands.
 * Runs on Postgres via DATABASE_URL (`postgres://…`), on `content/` without.
 * Every page, the home page `home` and the menu `main` included, comes from
 * the store, so all of it is edited in the studio; the starting texts are in
 * content/ (npm run db:seed -- --site=omnium --only=site,page,menu).
 */
export default defineImprint({
  id: "omnium",
  store: {
    databaseUrl: process.env.DATABASE_URL,
    contentDir: path.join(process.cwd(), "content"),
  },
  widgets: widgetRegistry,
  // An information site: pages and their chrome, nothing more.
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
