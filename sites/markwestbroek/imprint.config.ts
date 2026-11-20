import path from "node:path";
import { defineImprint } from "@imprint/extension-api";
import { widgetRegistry } from "@/widgets/registry";

/**
 * markwestbroek.nl: Mark's personal site, the hub that leads to everything he
 * does, plus temporary sections such as /woonwagen (reached as
 * woonwagen.markwestbroek.nl through the web server). Runs on Postgres via
 * DATABASE_URL (`postgres://…`), on `content/` without. Every page and the
 * menu `main` come from the store; the starting texts are in content/
 * (npm run db:seed -- --site=markwestbroek --only=site,page,menu).
 */
export default defineImprint({
  id: "markwestbroek",
  store: {
    databaseUrl: process.env.DATABASE_URL,
    contentDir: path.join(process.cwd(), "content"),
  },
  widgets: widgetRegistry,
  // A Dutch site: its fixed texts are Dutch (design/meertaligheid.md layer 2). The content keeps its old label.
  uiLocale: "nl",
  // A personal site: pages and their chrome, nothing more.
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
  // Outbound mail for the contact form (widget `contact`), which mails to CONTACT_TO: set on the
  // server, never in a page. Without SMTP_HOST there is no mail and the form says so.
  mail: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : undefined,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM,
  },
  // Visits report (GoAccess from the web server's log, deploy/vps/stats.sh); unset locally.
  stats: { reportDir: process.env.STATS_REPORT_DIR },
  secrets: {
    session: process.env.SESSION_SECRET,
    ingestToken: process.env.INGEST_TOKEN,
  },
});
