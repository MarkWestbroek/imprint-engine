import { AssetRecordSchema, assetRefSlug, type AssetRecord } from "@imprint/content-core";
import type { WidgetContext } from "../page-renderer";
import { displayUrl, fileAccess } from "./access";

/**
 * What a viewer needs to show an image or file field (design/beeldbibliotheek.md
 * §3): the URL to put in `src`, and — for a library asset — the description
 * and dimensions the library holds, so an editor writes the alt text once.
 */
export type ResolvedMedia = {
  src: string;
  /** The library's alt text; a widget's own alt wins when it has one. */
  alt?: string;
  caption?: string;
  credit?: string;
  width?: number;
  height?: number;
  /** Public WebP variants, for `srcset` (empty for a plain URL). */
  srcSet?: string;
  kind?: string;
  /** Set when the value was an `asset:` reference. */
  asset?: string;
};

function fromAsset(slug: string, a: AssetRecord): ResolvedMedia {
  const src = a.file.kind === "image" ? displayUrl(a) : a.file.original;
  const variant = a.file.variants.find((v) => v.url === src);
  const publicVariants = a.file.variants.filter((v) => fileAccess(a, v.url) !== "editor");
  return {
    src,
    alt: a.alt || undefined,
    caption: a.caption,
    credit: a.credit,
    width: variant?.width ?? a.file.width,
    height: variant?.height ?? a.file.height,
    srcSet: publicVariants.length > 1 ? publicVariants.map((v) => `${v.url} ${v.width}w`).join(", ") : undefined,
    kind: a.file.kind,
    asset: slug,
  };
}

/**
 * Resolve one field value. A plain URL or path comes back as is; an
 * `asset:<slug>` reference becomes the widest public version with its
 * description — or null when the asset is gone or not visible to this reader
 * (the store in `ctx` is the guarded one), so the viewer leaves it out.
 */
export async function resolveMedia(ctx: WidgetContext, value: string | undefined | null): Promise<ResolvedMedia | null> {
  if (!value) return null;
  const slug = assetRefSlug(value);
  if (!slug) return { src: value };
  const record = ctx.writableStore ? await ctx.writableStore.getItem("asset", slug) : null;
  const parsed = record ? AssetRecordSchema.safeParse(record.data) : null;
  return parsed?.success ? fromAsset(slug, parsed.data) : null;
}

/** Resolve several at once; unresolvable ones become null in place. */
export function resolveMediaAll(ctx: WidgetContext, values: (string | undefined | null)[]): Promise<(ResolvedMedia | null)[]> {
  return Promise.all(values.map((v) => resolveMedia(ctx, v)));
}
