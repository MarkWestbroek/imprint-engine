import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * AssetStore (D7): the binary side of content — renders, pinout SVGs, fab zips.
 * Mirrors the ContentStore file-vs-db split: today a FileAssetStore writes to
 * disk and hands back a URL; swapping to MinIO/S3 later is a config change, not
 * a rewrite, because callers only ever see `put(path) -> url`.
 *
 * `put` content-hashes the filename (render-top.<sha8>.png), so re-publishing
 * with new bytes yields a *new* URL. That keeps the long `immutable` cache
 * correct: a stable URL always maps to the same bytes, changed content = new
 * URL = cache miss = fresh (the standard fingerprinting pattern).
 */
export interface AssetStore {
  /** Store bytes; returns a public, content-addressed URL to reach them. */
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

/** Insert a hash before the extension: "a/render-top.png" → "a/render-top.<hash>.png". */
export function fingerprintPath(rel: string, hash: string): string {
  const slash = rel.lastIndexOf("/");
  const dir = slash >= 0 ? rel.slice(0, slash + 1) : "";
  const name = slash >= 0 ? rel.slice(slash + 1) : rel;
  const dot = name.lastIndexOf(".");
  return dot > 0
    ? `${dir}${name.slice(0, dot)}.${hash}${name.slice(dot)}`
    : `${dir}${name}.${hash}`;
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
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 8);
    const hashed = fingerprintPath(rel, hash);
    const full = path.join(this.root, hashed);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, bytes);
    return `${this.urlBase.replace(/\/$/, "")}/${hashed}`;
  }

  async delete(assetPath: string): Promise<void> {
    await fs.rm(path.join(this.root, safeAssetPath(assetPath)), { force: true });
  }

  /** Filesystem path for a stored asset, kept inside `root` (for serving). */
  resolve(assetPath: string): string {
    return path.join(this.root, safeAssetPath(assetPath));
  }
}
