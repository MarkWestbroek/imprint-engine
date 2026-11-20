import path from "node:path";
import { defineImprint } from "@imprint/extension-api";
import { taalPlugin } from "@imprint/plugin-taal";
import { widgetRegistry } from "@/widgets/registry";

/**
 * The language training (design/taaltraining/README.md): the lesson package
 * Dutch, for Polish speakers (the default) and for English speakers, and the
 * package Polish for Dutch speakers (`/nl/polski`). The
 * address is `/<ui>/<pakket>/<les>`: the interface language first, then the
 * language taught; each interface language has its own front page and menu
 * (src/lib/ingang.ts). Runs on Postgres
 * via DATABASE_URL; the lessons live in the store only (content type `les`
 * of plugin-taal), so without a database there are pages but no lessons.
 */
export const TAAL = {
  ui: ["pl", "en", "nl"],
  standaardUi: "pl",
  pakket: "nl",
  // "Check a word" (/pl/nederlands/woorden, /nl/polski/woorden): the word list of the package, made by scripts/woorden-maken*.ts.
  woorden: async (taal: string) =>
    taal === "nl" ? (await import("./woorden/nl.json")).default : taal === "pl" ? (await import("./woorden/pl.json")).default : null,
};

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
      woorden: TAAL.woorden,
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
