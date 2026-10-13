import { config as loadEnv } from "dotenv";
import { ContentTypeRegistry, coreContentTypeDefinitions } from "@imprint/content-core";
import { openContentDatabase } from "@imprint/content-core/db";
import { presentationsContentTypes } from "@imprint/plugin-presentations/content-types";
import { importDeck } from "@imprint/plugin-presentations/import";
import { widgetRegistry } from "../src/widgets/registry";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

/**
 * A deck in the Slides format (export folder: deck.json + slides/<id>.html)
 * into the database as a presentation, through the WritableContentStore. A
 * second run adds a version (the deck is replaced, its history kept). With
 * --page it also makes a page that shows the deck, and with --menu-under a
 * link under that menu item — both only when they do not exist yet, so
 * nothing the editors made is overwritten.
 *
 *   npm run presentation:import --workspace=omnium -- <dir> <slug> \
 *     [--blob <id>=<site path>]… [--page <slug> --page-title "<title>"] [--menu-under "<label>"]
 *
 * The export holds the speaker notes: keep it out of git (they stay in the
 * database, shown in the admin only).
 */
function args() {
  const argv = process.argv.slice(2);
  const pos: string[] = [];
  const blobs: Record<string, string> = {};
  const opt: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--blob") {
      const [id, to] = argv[++i]!.split("=");
      blobs[id!] = to!;
    } else if (a.startsWith("--")) opt[a.slice(2)] = argv[++i]!;
    else pos.push(a);
  }
  return { dir: pos[0], slug: pos[1], blobs, opt };
}

async function main() {
  const { dir, slug, blobs, opt } = args();
  if (!dir || !slug) throw new Error("Usage: import-deck <dir> <slug> [--blob id=path]… [--page slug --page-title title] [--menu-under label]");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("No database (DATABASE_URL).");

  const deck = await importDeck(dir, { slug, blobs, description: opt["description"] });
  const opened = openContentDatabase(url, {
    widgets: widgetRegistry,
    contentTypes: ContentTypeRegistry.of(coreContentTypeDefinitions, presentationsContentTypes),
  });
  const store = opened.store;
  const by = "import-deck";
  try {
    await store.putItem("presentation", slug, deck, { by });
    console.log(`presentation ${slug}: ${deck.slides.length} slides, ${deck.slides.filter((s) => s.notes).length} with notes (kept apart)`);

    const pageSlug = opt["page"];
    if (pageSlug) {
      if (await store.getItem("page", pageSlug)) console.log(`page ${pageSlug}: exists, left alone`);
      else {
        const title = opt["page-title"] ?? deck.title;
        await store.putItem(
          "page",
          pageSlug,
          {
            slug: pageSlug,
            title,
            description: deck.description || `Presentatie: ${deck.title}.`,
            body: "",
            layout: {
              rows: [
                { cells: [{ span: 1, widgets: [{ type: "hero", config: { title, subtitle: opt["page-subtitle"] ?? "", variant: "open" } }] }] },
                { cells: [{ span: 1, widgets: [{ type: "presentation", config: { deck: slug } }] }] },
              ],
            },
          },
          { by }
        );
        console.log(`page ${pageSlug}: made`);
      }
      const under = opt["menu-under"];
      if (under) {
        const menu = await store.getItem("menu", "main");
        const data = menu?.data as { name: string; items: { label: string; page?: string; url?: string; children?: { label: string; page?: string }[] }[] } | undefined;
        const parent = data?.items.find((i) => i.label === under);
        if (!data || !parent) console.log(`menu: no item "${under}", left alone`);
        else if ((parent.children ?? []).some((c) => c.page === pageSlug)) console.log("menu: link exists");
        else {
          parent.children = [...(parent.children ?? []), { label: opt["page-title"] ?? deck.title, page: pageSlug }];
          await store.putItem("menu", "main", data, { by });
          console.log(`menu: ${pageSlug} under ${under}`);
        }
      }
    }
  } finally {
    await opened.close();
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
