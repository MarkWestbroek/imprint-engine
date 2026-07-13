import path from "node:path";
import { FileAssetStore } from "@imprint/content-core";

/**
 * The site's AssetStore. Files land under ASSET_ROOT (a managed dir on disk,
 * outside the app on Plesk so it survives redeploys) and are served back
 * through /api/assets. Set ASSET_ROOT/ASSET_BASE_URL in the environment;
 * the defaults are fine for local dev.
 */
const root = process.env.ASSET_ROOT || path.join(process.cwd(), ".assets");
const urlBase = process.env.ASSET_BASE_URL || "/api/assets";

export const assetStore = new FileAssetStore(root, urlBase);
