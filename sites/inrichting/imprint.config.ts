import path from "node:path";
import { defineImprint } from "@imprint/extension-api";
import { omniumPlugin } from "@imprint/plugin-omnium";
import { widgetRegistry } from "@/widgets/registry";

/**
 * Inrichting: the inrichting of e-diensten from the Omnium register, as a
 * closed workplace (design/omnium-inrichting.md). Every page needs a session;
 * register records live at /inrichting/<key path> and render with the studio
 * templates `_view/omnium-<pad>`. The register stays the source: this
 * instance's own database holds only pages, templates, menu and accounts.
 * Runs on Postgres via DATABASE_URL, on `content/` without.
 */
export default defineImprint({
  id: "inrichting",
  store: {
    databaseUrl: process.env.DATABASE_URL,
    contentDir: path.join(process.cwd(), "content"),
  },
  widgets: widgetRegistry,
  // The register (OMNIUM_REGISTER_URL, OMNIUM_REGISTER_TOKEN), read-only.
  plugins: [omniumPlugin()],
  contentTypes: ["page", "menu", "theme", "site", "relations", "asset", "taglist"],
  assets: {
    root: process.env.ASSET_ROOT,
    baseUrl: process.env.ASSET_BASE_URL,
    // On Fundament: the Ceph bucket (deploy/k8s/base/bucket.yaml).
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
