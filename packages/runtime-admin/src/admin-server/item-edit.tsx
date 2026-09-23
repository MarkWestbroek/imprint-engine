import Link from "next/link";
import { notFound } from "next/navigation";
import type { ContentType } from "@imprint/content-core";
import { ItemEditor } from "../admin/item-editor";
import type { AdminContext } from "../admin-context";
import type { AdminActions } from "./actions";

/** Sensible starting data for a new item, so required fields are visible. */
export function emptyData(type: ContentType): Record<string, unknown> {
  const today = new Date().toISOString().slice(0, 10);
  switch (type) {
    case "site":
      return { name: "", tagline: "", baseUrl: "https://", defaultLocale: "en", links: {} };
    case "product":
      return { slug: "", lang: "en", name: "", tagline: "", status: "in-development", description: "", specs: [], media: [], components: [], order: 0 };
    case "component":
      return { slug: "", lang: "en", name: "", description: "", children: [], versions: [] };
    case "board-spec":
      return { slug: "", lang: "en", component: "", version: "", connectors: [], assets: { pinouts: {} }, sections: [], related: [] };
    case "release":
      return { project: "", version: "", date: today, channel: "stable", highlights: [], body: "", downloads: [] };
    case "menu":
      return { name: "", items: [] };
    case "theme":
      return {
        name: "", label: "", order: 0,
        colors: { background: "#0b0d10", surface: "#14181d", border: "#262c33", foreground: "#e8ebee", muted: "#9aa4ae", accent: "#4fd1c5", accentStrong: "#2ab5a8" },
        fonts: { sans: "", mono: "" },
      };
    case "page":
      return {};
    case "planning":
      return { slug: "", lang: "en", name: "", product: "", description: "", phases: [
        { key: "backlog", label: "Backlog", order: 0 },
        { key: "in-progress", label: "In progress", order: 1 },
        { key: "beta", label: "Beta", order: 2 },
        { key: "done", label: "Done", order: 3 },
      ], order: 0 };
    case "planning-item":
      return { slug: "", lang: "en", title: "", planning: "", status: "backlog", owner: "", body: "", order: 0 };
    case "wiki":
      return { slug: "", lang: "en", title: "", description: "", access: "public", order: 0 };
    case "wiki-folder":
      return { slug: "", lang: "en", wiki: "", parent: "", title: "", order: 0 };
    case "wiki-page":
      return { slug: "", lang: "en", wiki: "", folder: "", title: "", body: "", order: 0 };
    case "relations":
      return { rules: [] };
  }
}

/** Date → value for <input type="datetime-local"> (minute precision). */
function toLocalInput(date: Date | null | undefined): string | undefined {
  if (!date) return undefined;
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/**
 * The generic item editor for one content type: a form from the type's
 * schema, validity, and save. Pages are not handled here — the site routes
 * them to its studio (Fase 4 moves that here too).
 */
export async function ItemEditScreen({
  admin,
  type,
  slug,
  lang,
  actions,
}: {
  admin: AdminContext;
  type: string;
  slug: string | undefined;
  lang: string;
  actions: Pick<AdminActions, "saveItem">;
}) {
  if (!admin.imprint.contentTypes.has(type, "editable")) notFound();
  const contentType: ContentType = type;
  const store = admin.imprint.writableStore!;

  const item = slug ? await store.getItem(contentType, slug, lang) : null;
  if (slug && !item) notFound();

  // Menu items point to pages; give the editor the real list to pick from.
  const pages =
    contentType === "menu"
      ? (await store.listItems("page")).map((p) => ({
          slug: p.slug,
          title: String((p.data as Record<string, unknown>).title ?? p.slug),
        }))
      : undefined;

  return (
    <div className="max-w-3xl">
      <p className="text-sm text-muted">
        <Link href={`/admin/${type}`} className="hover:text-foreground">
          ← {type}s
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {item ? `Edit ${type}: ${slug}` : `New ${type}`}
      </h1>
      <div className="mt-6">
        <ItemEditor
          type={contentType}
          initialData={(item?.data as Record<string, unknown>) ?? emptyData(contentType)}
          formSchema={admin.forms.content(contentType)}
          isNew={!item}
          validFrom={toLocalInput(item?.validFrom)}
          validTo={toLocalInput(item?.validTo)}
          pages={pages}
          action={actions.saveItem}
        />
      </div>
    </div>
  );
}
