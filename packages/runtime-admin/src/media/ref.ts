/**
 * Where an `asset:<slug>` inside markdown points (design/beeldbibliotheek.md
 * §3, step 6): a short redirect to the asset's current public version, served
 * by the asset route. Markdown is rendered synchronously, so it cannot look
 * the asset up itself; the route does, with the same access rules as every
 * other file. Framework-free: the public renderer and the editor share it.
 */
export const ASSET_REF_ROUTE = "/api/assets/_ref/";

/** `asset:<slug>` → the ref route; anything else unchanged (null). */
/** What an <img> or a link shows for a stored value: the ref route for `asset:<slug>`, the value itself otherwise. */
export const mediaSrc = (url: string): string => assetRefUrl(url) ?? url;

export function assetRefUrl(url: string): string | null {
  return url.startsWith("asset:") ? ASSET_REF_ROUTE + encodeURIComponent(url.slice("asset:".length)) : null;
}
