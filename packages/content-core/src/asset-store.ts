import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * AssetStore (D7): the binary side of content — renders, pinout SVGs, fab zips.
 * Mirrors the ContentStore file-vs-db split: today a FileAssetStore writes to
 * disk and hands back a URL; swapping to MinIO/S3 later is a config change, not
 * a rewrite, because callers only ever see `put(path) -> url`.
 */
export interface AssetStore {
  /** Store bytes at a logical path; returns the public URL to reach them. */
  put(assetPath: string, bytes: Uint8Array): Promise<string>;
  delete(assetPath: string): Promise<void>;
}

/** Turn a logical path into safe relative segments (no traversal, no absolute). */
export function safeAssetPath(p: string): string {
  return p
    .split(/[/\\]+/)
    .map((s) => s.trim())
    .filter((s) => s && s !== "." && s !== "..")
    .map((s) => s.replace(/[^a-zA-Z0-9._@-]/g, "_"))
    .join("/");
}

/**
 * Assets on disk under `root`, reachable at `urlBase/<path>`. In this app
 * `urlBase` is the serving route (/api/assets), so it works identically in dev
 * and on Plesk without assuming anything about the public/ dir.
 */
export class FileAssetStore implements AssetStore {
  constructor(
    private readonly root: string,
    private readonly urlBase: string
  ) {}

  async put(assetPath: string, bytes: Uint8Array): Promise<string> {
    const rel = safeAssetPath(assetPath);
    if (!rel) throw new Error(`Invalid asset path "${assetPath}"`);
    const full = path.join(this.root, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, bytes);
    return `${this.urlBase.replace(/\/$/, "")}/${rel}`;
  }

  async delete(assetPath: string): Promise<void> {
    await fs.rm(path.join(this.root, safeAssetPath(assetPath)), { force: true });
  }

  /** Filesystem path for a stored asset, kept inside `root` (for serving). */
  resolve(assetPath: string): string {
    return path.join(this.root, safeAssetPath(assetPath));
  }
}
