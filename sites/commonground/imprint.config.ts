import { createElement } from "react";
import path from "node:path";
import { defineImprint } from "@imprint/extension-api";
import { annotationsPlugin } from "@imprint/plugin-annotations";
import { blogPlugin } from "@imprint/plugin-blog";
import { eventsPlugin, GroupAgendaTools } from "@imprint/plugin-events";
import { glossaryPlugin } from "@imprint/plugin-glossary";
import { groupsPlugin } from "@imprint/plugin-groups";
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
  // Groups with their wikis, and the terms, imported from Pleio (scripts/import-pleio.ts).
  plugins: [
    wikiPlugin(),
    glossaryPlugin({ indexHref: "/termen" }),
    // The agenda on a group's page gets the events plugin's "Evenement plannen" (the plugins do not know each other).
    groupsPlugin({ agendaTools: (group, call) => createElement(GroupAgendaTools, { group, call }) }),
    blogPlugin(),
    eventsPlugin(),
    // Reacties (design/annotaties.md): per type the default; a page opts in with its own `annotations` field.
    annotationsPlugin({
      targets: {
        post: { allow: "members", inline: true },
        "wiki-page": { allow: "members", inline: true },
        term: { allow: "members", inline: true },
        event: "members",
        page: "off",
      },
    }),
  ],
  // A community site: pages and their chrome; groups, news and events follow (communities.md).
  // The core types this site uses; the plugins' types (wiki, term) are active on top of these.
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
  // Outbound mail (design/mail.md): the verification mail for new members. Without SMTP_HOST there is no mail.
  mail: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : undefined,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM,
  },
  secrets: {
    session: process.env.SESSION_SECRET,
    ingestToken: process.env.INGEST_TOKEN,
  },
});
