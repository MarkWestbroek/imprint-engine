import { AssetRecordSchema, type AssetRecord, type ContentStore, type WritableContentStore } from "@imprint/content-core";
import { PatchSchema, type Patch, type Pool } from "./schemas";

/**
 * Reading the pool through a store — the guarded one of the visitor at hand,
 * so a proposal shows only to its author and the staff (the PDP's
 * `private` rule), and nothing here decides visibility itself.
 */

type Reader = ContentStore | WritableContentStore;

const listing = (store: Reader) => store as Partial<WritableContentStore>;

export async function listPatches(store: Reader, filter: { pool?: Pool; tag?: string } = {}): Promise<Patch[]> {
  const s = listing(store);
  if (typeof s.listItems !== "function") return [];
  return (await s.listItems("patch"))
    .flatMap((r) => {
      const p = PatchSchema.safeParse(r.data);
      return p.success ? [p.data] : [];
    })
    .filter((p) => (!filter.pool || p.pool === filter.pool) && (!filter.tag || p.tags.includes(filter.tag)))
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") || a.title.localeCompare(b.title));
}

export async function getPatch(store: Reader, slug: string): Promise<Patch | null> {
  const s = listing(store);
  if (typeof s.getItem !== "function") return null;
  const record = await s.getItem("patch", slug, "en");
  const p = record ? PatchSchema.safeParse(record.data) : null;
  return p?.success ? p.data : null;
}

/** The assets of a take group this reader may see: the wav and the mid of a demo. */
export async function takeAssets(store: Reader, group: string): Promise<AssetRecord[]> {
  const s = listing(store);
  if (typeof s.listItems !== "function") return [];
  return (await s.listItems("asset")).flatMap((r) => {
    const a = AssetRecordSchema.safeParse(r.data);
    return a.success && a.data.group === group ? [a.data] : [];
  });
}

/** The patches derived from this one (its children in the family tree). */
export async function derivedPatches(store: Reader, slug: string): Promise<Patch[]> {
  return (await listPatches(store)).filter((p) => p.derivedFrom === slug);
}
