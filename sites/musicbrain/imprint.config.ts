import path from "node:path";
import { defineImprint } from "@imprint/extension-api";
import { widgetRegistry } from "@/widgets/registry";

/**
 * MusicBrain — the instance description (architecture.md §0: the composition
 * root). Everything site-specific that the engine needs to know is declared
 * here, once; `src/lib/content.ts` turns it into the live instance.
 *
 * Secrets live in the environment (.env.local) and are read here, nowhere
 * else: the rest of the site gets them from the instance. DATABASE_URL picks
 * the backend by its scheme; without it the site builds from `content/`.
 */
export default defineImprint({
  id: "musicbrain",
  store: {
    databaseUrl: process.env.DATABASE_URL,
    contentDir: path.join(process.cwd(), "content"),
  },
  widgets: widgetRegistry,
  // Keep the cookie name this site has always used, so nobody is logged out.
  session: { cookie: "imprint_session", hours: 12 },
  assets: {
    root: process.env.ASSET_ROOT,
    baseUrl: process.env.ASSET_BASE_URL,
  },
  secrets: {
    session: process.env.SESSION_SECRET,
    ingestToken: process.env.INGEST_TOKEN,
    githubWebhook: process.env.GITHUB_WEBHOOK_SECRET,
    publish: { url: process.env.PUBLISH_URL, token: process.env.PUBLISH_TOKEN },
  },
});
