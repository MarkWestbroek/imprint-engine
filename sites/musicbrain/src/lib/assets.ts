import { imprint } from "@/lib/content";

/**
 * The site's AssetStore, from the instance (imprint.config.ts). Files land
 * under ASSET_ROOT (a managed dir on disk, outside the app so it survives
 * redeploys) and are served back through /api/assets. Set
 * ASSET_ROOT/ASSET_BASE_URL in the environment; the defaults are fine locally.
 */
export const assetStore = imprint.assets;
