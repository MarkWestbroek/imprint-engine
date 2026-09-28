import { AssetRecordSchema, TaglistSchema, type Taglist } from "@imprint/content-core";
import type { AdminContext } from "../admin-context";
import { MediaLibrary, type AssetUsage, type LibraryAsset } from "../admin/media-library";
import type { MediaActions } from "../admin/types";

/**
 * `/admin/asset`: the media library (design/beeldbibliotheek.md). The core's
 * own screen for its `asset` type, the way a plugin brings a screen for its
 * types; `AdminTypeScreen` routes here. Tag lists (§4) are managed from it.
 */
export async function MediaLibraryScreen({
  admin,
  actions,
  uploadUrl = "/admin/upload",
}: {
  admin: AdminContext;
  actions: MediaActions;
  uploadUrl?: string;
}) {
  const store = admin.imprint.writableStore;
  if (!store) {
    return <p className="text-sm text-muted">The media library needs a database (DATABASE_URL).</p>;
  }
  const records = await store.listItems("asset");
  const assets: LibraryAsset[] = records
    .flatMap((r) => {
      const parsed = AssetRecordSchema.safeParse(r.data);
      return parsed.success ? [{ slug: r.slug, lang: r.lang, data: parsed.data, changed: r.txFrom.toISOString() }] : [];
    })
    .sort((a, b) => b.changed.localeCompare(a.changed));

  const taglists: Taglist[] = admin.imprint.contentTypes.has("taglist")
    ? (await store.listItems("taglist"))
        .flatMap((r) => {
          const parsed = TaglistSchema.safeParse(r.data);
          return parsed.success ? [parsed.data] : [];
        })
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    : [];

  const usage = await assetUsage(admin);

  // Plain JSON across the client boundary (no Dates, no zod internals).
  return (
    <MediaLibrary
      assets={JSON.parse(JSON.stringify(assets))}
      taglists={JSON.parse(JSON.stringify(taglists))}
      usage={usage}
      uploadUrl={uploadUrl}
      actions={actions}
    />
  );
}

const REF_RE = /asset:([a-z0-9][a-z0-9-]*)/g;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Where each asset is used (§3): every current item of every content type is
 * searched for `asset:<slug>` and for links into `library/<slug>/`. A plain
 * scan — no index to keep in step — which is fine at the size of a site.
 */
async function assetUsage(admin: AdminContext): Promise<Record<string, AssetUsage[]>> {
  const store = admin.imprint.writableStore!;
  const found: Record<string, AssetUsage[]> = {};
  const base = admin.imprint.assets.urlBase.replace(/\/$/, "");
  const URL_RE = new RegExp(`${escapeRe(base)}/library/([a-z0-9][a-z0-9-]*)/`, "g");
  for (const type of admin.imprint.contentTypes.types()) {
    if (type === "asset" || type === "taglist") continue;
    for (const item of await store.listItems(type)) {
      const text = JSON.stringify(item.data);
      const slugs = new Set([...text.matchAll(REF_RE), ...text.matchAll(URL_RE)].map((m) => m[1]));
      if (slugs.size === 0) continue;
      const d = item.data as { title?: unknown; name?: unknown };
      const label = String(d.title || d.name || item.slug);
      const href = type === "page" ? `/admin/page/edit/${item.slug}?lang=${item.lang}` : `/admin/${type}/edit/${item.slug}`;
      for (const slug of slugs) (found[slug] ??= []).push({ type, slug: item.slug, label, href });
    }
  }
  return found;
}
