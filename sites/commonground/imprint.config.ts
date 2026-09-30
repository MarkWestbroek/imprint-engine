import path from "node:path";
import { defineImprint } from "@imprint/extension-api";
import { glossaryPlugin } from "@imprint/plugin-glossary";
import { wikiPlugin } from "@imprint/plugin-wiki";
import { widgetRegistry } from "@/widgets/registry";

/**
 * Common Ground on Imprint — a showcase (design/communities.md): the look of
 * commonground.nl (our own design, not Pleio's) with its public pages
 * imported through the Pleio GraphQL API (scripts/import-pleio.ts). Runs on
 * Postgres via DATABASE_URL, on `content/` without. Every page, the header
 * menu and the footer come from the store, so all of it is editable.
 */
export default defineImprint({
  id: "commonground",
  store: {
    databaseUrl: process.env.DATABASE_URL,
    contentDir: path.join(process.cwd(), "content"),
  },
  widgets: widgetRegistry,
  // The wiki of the "Common Ground publicatiesite" group and the terms, imported from Pleio (scripts/import-pleio.ts).
  plugins: [wikiPlugin(), glossaryPlugin({ indexHref: "/termen" })],
  // A community site: pages and their chrome; groups, news and events follow (communities.md).
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
  secrets: {
    session: process.env.SESSION_SECRET,
    ingestToken: process.env.INGEST_TOKEN,
  },
});
