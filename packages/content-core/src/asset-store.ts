import { createHash } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

/**
 * AssetStore (D7): the binary side of content — renders, pinout SVGs, fab zips,
 * the media library. Mirrors the ContentStore file-vs-db split: a
 * FileAssetStore writes to disk, an S3AssetStore (asset-store.s3.ts) to a
 * bucket (MinIO, Garage, S3); callers see the same interface, and the site's
 * serving route (/api/assets) reads through it, so access control and URLs
 * do not depend on where the bytes live.
 *
 * `put` content-hashes the filename (render-top.<sha8>.png), so re-publishing
 * with new bytes yields a *new* URL. That keeps the long `immutable` cache
 * correct: a stable URL always maps to the same bytes, changed content = new
 * URL = cache miss = fresh (the standard fingerprinting pattern).
 */
export interface AssetStore {
  /** Where the serving route answers (e.g. "/api/assets"); stored URLs start with it. */
  readonly urlBase: string;
  /** Store bytes; returns a public, content-addressed URL to reach them. */
  put(assetPath: string, bytes: Uint8Array): Promise<string>;
  delete(assetPath: string): Promise<void>;
  /** Size of a stored file, or null when it does not exist. */
  stat(assetPath: string): Promise<{ size: number } | null>;
  /** The bytes of a stored file, `start`..`end` inclusive (the whole file without a range). */
  read(assetPath: string, range?: { start: number; end: number }): Promise<ReadableStream<Uint8Array> | null>;
  /** Every stored path (for moving between backends, and clean-up). */
  list(): AsyncIterable<string>;
  /** Store bytes at exactly this path — no fingerprint (moving files between backends). */
  putExact(assetPath: string, bytes: Uint8Array): Promise<void>;
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

/** The fingerprinted key for `assetPath` with these bytes (shared by every backend). */
export function assetKey(assetPath: string, bytes: Uint8Array): string {
  const rel = safeAssetPath(assetPath);
  if (!rel) throw new Error(`Invalid asset path "${assetPath}"`);
  return fingerprintPath(rel, createHash("sha256").update(bytes).digest("hex").slice(0, 8));
}

/**
 * Assets on disk under `root`, reachable at `urlBase/<path>`. In this app
 * `urlBase` is the serving route (/api/assets), so it works identically in dev
 * and in the container without assuming anything about the public/ dir.
 */
export class FileAssetStore implements AssetStore {
  constructor(
    private readonly root: string,
    readonly urlBase: string
  ) {}

  async put(assetPath: string, bytes: Uint8Array): Promise<string> {
    const key = assetKey(assetPath, bytes);
    await this.putExact(key, bytes);
    return `${this.urlBase.replace(/\/$/, "")}/${key}`;
  }

  async putExact(assetPath: string, bytes: Uint8Array): Promise<void> {
    const full = this.resolve(assetPath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, bytes);
  }

  async delete(assetPath: string): Promise<void> {
    await fs.rm(this.resolve(assetPath), { force: true });
  }

  async stat(assetPath: string): Promise<{ size: number } | null> {
    try {
      const s = await fs.stat(this.resolve(assetPath));
      return s.isFile() ? { size: s.size } : null;
    } catch {
      return null;
    }
  }

  async read(assetPath: string, range?: { start: number; end: number }): Promise<ReadableStream<Uint8Array> | null> {
    if (!(await this.stat(assetPath))) return null;
    return Readable.toWeb(createReadStream(this.resolve(assetPath), range)) as ReadableStream<Uint8Array>;
  }

  async *list(): AsyncIterable<string> {
    const walk = async function* (dir: string, prefix: string): AsyncIterable<string> {
      let entries: import("node:fs").Dirent[];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        const rel = prefix ? `${prefix}/${e.name}` : e.name;
        if (e.isDirectory()) yield* walk(path.join(dir, e.name), rel);
        else if (e.isFile()) yield rel;
      }
    };
    yield* walk(this.root, "");
  }

  /** Filesystem path for a stored asset, kept inside `root`. */
  resolve(assetPath: string): string {
    return path.join(this.root, safeAssetPath(assetPath));
  }
}
