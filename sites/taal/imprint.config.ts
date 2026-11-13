import path from "node:path";
import { defineImprint } from "@imprint/extension-api";
import { taalPlugin } from "@imprint/plugin-taal";
import { widgetRegistry } from "@/widgets/registry";

/**
 * The language training (design/taaltraining/README.md): a Polish site that
 * offers the lesson package Dutch. The address is `/<ui>/<pakket>/<les>`:
 * the interface language first, then the language taught. Runs on Postgres
 * via DATABASE_URL; the lessons live in the store only (content type `les`
 * of plugin-taal), so without a database there are pages but no lessons.
 */
export const TAAL = { ui: ["pl", "nl"], standaardUi: "pl", pakket: "nl" };

export default defineImprint({
  id: "taal",
  store: {
    databaseUrl: process.env.DATABASE_URL,
    contentDir: path.join(process.cwd(), "content"),
  },
  widgets: widgetRegistry,
  plugins: [
    taalPlugin({
      ui: TAAL.ui,
      pakket: TAAL.pakket,
      // Azure text-to-speech for the recordings (admin → Taal → Audio). Without a key the browser's voice reads.
      tts: { key: process.env.AZURE_TTS_KEY, region: process.env.AZURE_TTS_REGION },
    }),
  ],
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
  // Outbound mail: the verification and password mails of the learners' accounts. Without SMTP_HOST there is no mail.
  mail: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : undefined,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM,
  },
  // The contact form mails to CONTACT_TO (set on the server, never in the page); see app/(site)/[ui]/kontakt.
  stats: { reportDir: process.env.STATS_REPORT_DIR },
  secrets: {
    session: process.env.SESSION_SECRET,
    ingestToken: process.env.INGEST_TOKEN,
  },
});
