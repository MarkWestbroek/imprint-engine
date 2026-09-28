import type { AssetRecord } from "@imprint/content-core";

/**
 * Who may fetch which file of a library asset (design/beeldbibliotheek.md §7):
 * access holds per format, not per asset.
 *
 * - `public`: anyone — a variant of a public asset within `publicMaxWidth`;
 * - `reader`: anyone signed in whom the PDP lets read the asset — a variant of
 *   a restricted asset within `publicMaxWidth`;
 * - `editor`: people who edit content — the original, and every variant above
 *   `publicMaxWidth`. A purchase (the sales plugin, later) is the other way in.
 * - `none`: the URL is not a file of this asset.
 */
export type FileAccess = "public" | "reader" | "editor" | "none";

export function fileAccess(asset: Pick<AssetRecord, "access" | "publicMaxWidth" | "file">, url: string): FileAccess {
  if (url === asset.file.original) {
    // SVG and PDF have no variants: the original is what the site shows.
    if (asset.file.kind !== "image" || asset.file.variants.length === 0) {
      return asset.access === "public" ? "public" : "reader";
    }
    return "editor";
  }
  const variant = asset.file.variants.find((v) => v.url === url);
  if (!variant) return "none";
  if (asset.publicMaxWidth !== undefined && variant.width > asset.publicMaxWidth) return "editor";
  return asset.access === "public" ? "public" : "reader";
}

/** The URL a page should show by default: the widest variant a visitor may see, else the original. */
export function displayUrl(asset: Pick<AssetRecord, "access" | "publicMaxWidth" | "file">): string {
  const allowed = asset.file.variants.filter((v) => fileAccess(asset, v.url) !== "editor");
  const pick = allowed.filter((v) => v.width <= 1600).at(-1) ?? allowed.at(0);
  return pick?.url ?? asset.file.original;
}

/** The smallest variant, for thumbnails in the admin. */
export function thumbUrl(asset: Pick<AssetRecord, "file">): string {
  return asset.file.variants[0]?.url ?? asset.file.original;
}
