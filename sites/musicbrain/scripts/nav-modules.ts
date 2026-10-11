import { config as loadEnv } from "dotenv";
import { ContentTypeRegistry, coreContentTypeDefinitions, type WritableContentStore } from "@imprint/content-core";
import { openContentDatabase } from "@imprint/content-core/db";
import { widgetRegistry } from "../src/widgets/registry";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

/**
 * One-off content change (12 October 2026), through the WritableContentStore
 * so the history stays right: "Modules" in the main menu after "Editor", and
 * on the Editor page a block that leads to the patches and the modules.
 * Idempotent: what is already there is left alone.
 *
 *   npm run nav:modules --workspace=musicbrain            # local (.env.local)
 *   docker compose run --rm -e DATABASE_URL=… tools npm run nav:modules --workspace=musicbrain
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("No database (DATABASE_URL): nothing to change.");
  // The site's own widget catalogue validates the page; menu and page are core types.
  const opened = openContentDatabase(url, { widgets: widgetRegistry, contentTypes: ContentTypeRegistry.of(coreContentTypeDefinitions) });
  try {
    await change(opened.store);
  } finally {
    await opened.close();
  }
}

async function change(store: WritableContentStore) {
  const by = "nav-modules";

  const menu = await store.getItem("menu", "main");
  if (!menu) throw new Error('No menu "main".');
  const data = menu.data as { name: string; items: { label: string; page?: string; url?: string }[] };
  if (data.items.some((i) => i.url === "/modules" || i.page === "modules")) {
    console.log("menu: Modules is already there");
  } else {
    const at = data.items.findIndex((i) => i.page === "editor" || i.label === "Editor");
    const items = [...data.items];
    items.splice(at < 0 ? items.length : at + 1, 0, { label: "Modules", url: "/modules" });
    await store.putItem("menu", "main", { ...data, items }, { by });
    console.log(`menu: ${items.map((i) => i.label).join(" · ")}`);
  }

  const page = await store.getItem("page", "editor");
  if (!page) throw new Error('No page "editor".');
  const doc = page.data as { layout?: { rows: { cells: { span: number; widgets: { type: string; config: unknown }[] }[] }[] } };
  const rows = doc.layout?.rows ?? [];
  if (JSON.stringify(rows).includes('"/modules"')) {
    console.log("editor page: the block is already there");
  } else {
    const block = {
      cells: [
        {
          span: 1,
          widgets: [
            {
              type: "cards",
              config: {
                title: "Patches and modules",
                columns: 2,
                items: [
                  { icon: "🎛", title: "Patches", markdown: "Ready-made patches: the standard set and the lab. Listen first, then play one or open it in the editor.", href: "/patches" },
                  { icon: "▦", title: "Modules", markdown: "Every module of the firmware: its controls and ports, how it works, and patches to try it with.", href: "/modules" },
                ],
              },
            },
          ],
        },
      ],
    };
    // Before the closing call to action ("Take it to a Teensy"), when the page ends with one.
    const last = rows.at(-1)?.cells.flatMap((c) => c.widgets).some((w) => w.type === "callout");
    const next = [...rows];
    next.splice(last ? next.length - 1 : next.length, 0, block);
    await store.putItem("page", "editor", { ...doc, layout: { ...doc.layout, rows: next } }, { by });
    console.log("editor page: block added");
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
