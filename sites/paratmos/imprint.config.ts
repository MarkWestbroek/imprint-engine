import path from "node:path";
import { defineImprint } from "@imprint/extension-api";
import { blogPlugin } from "@imprint/plugin-blog";
import { glossaryPlugin } from "@imprint/plugin-glossary";
import { wikiPlugin } from "@imprint/plugin-wiki";
import { widgetRegistry } from "@/widgets/registry";

/**
 * paratmos.nl: the business site of Paratmos (model-driven working, data
 * architecture, training). Pages and the menu `main` come from the store; the
 * blog (`/blog`), the knowledge base (the wiki `kennisbank`, `/kennisbank/…`)
 * and the glossary (`/terms/<slug>`, overview on the page `begrippen`) are
 * plugins. Runs on Postgres via DATABASE_URL (`postgres://…`), on `content/`
 * without; the plugins' content lives in the database only, so without one
 * the blog, the knowledge base and the glossary are empty. The starting texts
 * are in content/ (see README).
 */
export default defineImprint({
  id: "paratmos",
  store: {
    databaseUrl: process.env.DATABASE_URL,
    contentDir: path.join(process.cwd(), "content"),
  },
  widgets: widgetRegistry,
  // Written in Dutch (design/meertaligheid.md layer 1): pages are stored and read as `nl`. The English
  // pages of the old site join `locales` when the engine serves translations (step D).
  locales: ["nl"],
  defaultLocale: "nl",
  plugins: [wikiPlugin(), glossaryPlugin({ indexHref: "/begrippen" }), blogPlugin()],
  // The core types this site uses; the plugins' types (wiki, term, post) are active on top of these.
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
