import { AssetRecordSchema, TaglistSchema, type Taglist } from "@imprint/content-core";
import type { AdminContext } from "../admin-context";
import { MediaLibrary, type LibraryAsset } from "../admin/media-library";
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

  // Plain JSON across the client boundary (no Dates, no zod internals).
  return (
    <MediaLibrary
      assets={JSON.parse(JSON.stringify(assets))}
      taglists={JSON.parse(JSON.stringify(taglists))}
      uploadUrl={uploadUrl}
      actions={actions}
    />
  );
}
