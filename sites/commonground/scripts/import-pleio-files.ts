import "./load-env";
import { promises as fs } from "node:fs";
import path from "node:path";
import { FileAssetStore, inProcessPdp, userSubject, type AssetStore } from "@imprint/content-core";
import { S3AssetStore } from "@imprint/content-core/asset-store.s3";
import type { AdminContext } from "@imprint/runtime-admin";
import { ingestFiles } from "@imprint/runtime-admin/media-ingest";
import { assetMap, downloadUrl, fileRefs, openSiteStore, registry, rewriteFiles } from "./pleio-files";

/**
 * The files and images the imported Pleio content links to → the media
 * library, and the links → `asset:<slug>` (design/communities.md §6: the
 * showcase stands on its own once the pictures come along).
 *
 *   npm run import:pleio-files --workspace=commonground               # download, ingest, rewrite
 *   … -- --dry-run                                                     # count only, write nothing
 *   … -- --limit=20                                                    # the first N files (a try-out)
 *   … -- --cache=DIR                                                   # keep downloads in DIR/files (re-runs skip the network)
 *
 * Only what the content uses is fetched (public files, as a visitor gets
 * them); a file the library does not take (pptx, mp4) keeps its link to
 * Pleio. Idempotent: an asset remembers its Pleio URL in `source`, so a file
 * already in the library is not fetched again, and content already rewritten
 * has no links left to find. Run `import:pleio` before this one; after it,
 * `import:pleio` keeps the asset references (it applies the same map).
 */

const ORIGIN = (process.argv.find((a) => a.startsWith("--origin="))?.slice(9) ?? "https://commonground.nl").replace(/\/$/, "");
const CACHE = process.argv.find((a) => a.startsWith("--cache="))?.slice(8);
const DRY = process.argv.includes("--dry-run");
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.slice(8) ?? Infinity);
const BY = "import-pleio";
const FOLDER = "pleio";
const CONCURRENCY = 4;

const EXT_OF_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
};

/** The asset store as the site builds it (extension-api): a bucket when ASSET_S3_* is complete, else the disk. */
function openAssets(): AssetStore {
  const base = process.env.ASSET_BASE_URL || "/api/assets";
  const { ASSET_S3_ENDPOINT: endpoint, ASSET_S3_BUCKET: bucket, ASSET_S3_ACCESS_KEY: accessKey, ASSET_S3_SECRET_KEY: secretKey } = process.env;
  if (endpoint && bucket && accessKey && secretKey) return new S3AssetStore({ endpoint, bucket, accessKey, secretKey, region: process.env.ASSET_S3_REGION || undefined }, base);
  return new FileAssetStore(process.env.ASSET_ROOT || path.join(process.cwd(), ".assets"), base);
}

type Download = { name: string; bytes: Uint8Array };

/** The file's name: from the URL when it has an extension, else from the response. */
function nameOf(url: string, guid: string, res: Response): string {
  const last = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
  if (/\.[a-z0-9]{2,5}$/i.test(last)) return last;
  const disposition = res.headers.get("content-disposition") ?? "";
  const given = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1];
  if (given && /\.[a-z0-9]{2,5}$/i.test(given)) return decodeURIComponent(given);
  const ext = EXT_OF_MIME[(res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase()];
  return `${given || last || guid.slice(0, 8)}${ext ? `.${ext}` : ""}`;
}

async function download(url: string, guid: string): Promise<Download> {
  const cached = CACHE ? path.join(CACHE, "files", guid) : null;
  if (cached) {
    try {
      const meta = JSON.parse(await fs.readFile(`${cached}.json`, "utf8")) as { name: string };
      return { name: meta.name, bytes: new Uint8Array(await fs.readFile(cached)) };
    } catch {
      // not cached yet
    }
  }
  let lastError: unknown;
  // The link as written first; then Pleio's attachment route, which serves files the download route does not know (embedded images).
  for (const from of [...new Set([downloadUrl(url), `${ORIGIN}/attachment/${guid}`])]) {
    try {
      const res = await fetch(from, { redirect: "follow", signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if ((res.headers.get("content-type") ?? "").startsWith("text/html")) throw new Error("not a file (a page: probably not public)");
      const bytes = new Uint8Array(await res.arrayBuffer());
      const name = nameOf(url, guid, res);
      if (cached) {
        await fs.mkdir(path.dirname(cached), { recursive: true });
        await fs.writeFile(cached, bytes);
        await fs.writeFile(`${cached}.json`, JSON.stringify({ name, url }));
      }
      return { name, bytes };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Needs DATABASE_URL (see .env.example)");
  const opened = openSiteStore(url);
  const store = opened.store;
  const types = registry.names().filter((t) => t !== "asset" && t !== "annotation");

  // What the content links to, and what the library already has.
  const items: { type: string; slug: string; lang: string; data: unknown }[] = [];
  for (const type of types) for (const r of await store.listItems(type)) items.push({ type, slug: r.slug, lang: r.lang, data: r.data });
  const wanted = new Map<string, string>();
  for (const item of items) for (const ref of fileRefs(item.data, ORIGIN)) if (!wanted.has(ref.guid)) wanted.set(ref.guid, ref.url);
  const map = await assetMap(store, ORIGIN);
  const todo = [...wanted].filter(([guid]) => !map.has(guid)).slice(0, LIMIT);
  console.log(`${items.length} items link to ${wanted.size} Pleio files; ${map.size} already in the library, ${todo.length} to fetch${DRY ? " (dry run)" : ""}`);
  if (DRY) return opened.close();

  const admin = { imprint: { writableStore: store, pdp: inProcessPdp, assets: openAssets(), media: { maxBytes: {} } } } as unknown as AdminContext;
  const subject = userSubject(BY, "admin");
  const failed = new Map<string, string[]>();
  const fail = (reason: string, what: string) => failed.set(reason, [...(failed.get(reason) ?? []), what]);
  let bytes = 0;
  let done = 0;

  // Downloads run a few at a time; the ingest itself is one by one (it hands out unique slugs).
  let next = 0;
  let chain: Promise<void> = Promise.resolve();
  const worker = async () => {
    while (next < todo.length) {
      const [guid, fileUrl] = todo[next++]!;
      let file: Download;
      try {
        file = await download(fileUrl, guid);
      } catch (err) {
        fail(err instanceof Error ? err.message : String(err), fileUrl);
        continue;
      }
      chain = chain.then(async () => {
        const [result] = await ingestFiles(admin, subject, [{ ...file, source: `${ORIGIN}/file/download/${guid}` }], { folder: FOLDER, by: BY });
        if (result?.ok && result.slug) {
          map.set(guid, result.slug);
          bytes += file.bytes.byteLength;
        } else fail(result?.error ?? "not ingested", file.name);
        if (++done % 50 === 0) console.log(`  … ${done}/${todo.length}`);
      });
      await chain;
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await chain;

  // The links, in every item that has one.
  let rewritten = 0;
  for (const item of items) {
    const data = rewriteFiles(item.data, map, ORIGIN);
    if (data === item.data) continue;
    try {
      await store.putItem(item.type, item.slug, data, { lang: item.lang, by: BY });
      rewritten++;
    } catch (err) {
      fail(`rewrite refused: ${(err as Error).message.slice(0, 160)}`, `${item.type} ${item.slug}`);
    }
  }

  console.log(`✓ ${map.size} files in the library (${(bytes / 1e6).toFixed(1)} MB new), ${rewritten} items rewritten`);
  for (const [reason, list] of failed) console.log(`  ✗ ${list.length}× ${reason}${list.length <= 3 ? `: ${list.join(", ")}` : ` (e.g. ${list[0]})`}`);
  await opened.close();
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
