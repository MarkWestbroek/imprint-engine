import "dotenv/config";
import path from "node:path";
import { FileAssetStore } from "@imprint/content-core";
import { S3AssetStore } from "@imprint/content-core/asset-store.s3";

/**
 * Move a site's assets from disk to its bucket (design/beeldbibliotheek.md §8,
 * step 7). Every file under ASSET_ROOT is copied to the bucket under the same
 * key, so the URLs in content (`/api/assets/<key>`) stay valid. Files already
 * in the bucket with the same size are skipped: the script can run again, and
 * after a deploy that still wrote to disk. The disk copy is left in place —
 * remove it yourself once the site runs on the bucket.
 *
 *   ASSET_ROOT=… ASSET_S3_ENDPOINT=… ASSET_S3_BUCKET=… ASSET_S3_ACCESS_KEY=… ASSET_S3_SECRET_KEY=… \
 *     npm run assets:to-s3                  show what would be copied (default)
 *   npm run assets:to-s3 -- --apply         copy it
 */
const apply = process.argv.includes("--apply");
const need = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
};

async function main() {
  const root = process.env.ASSET_ROOT || path.join(process.cwd(), "sites", "musicbrain", ".assets");
  const disk = new FileAssetStore(root, "/api/assets");
  const bucket = new S3AssetStore(
    {
      endpoint: need("ASSET_S3_ENDPOINT"),
      bucket: need("ASSET_S3_BUCKET"),
      accessKey: need("ASSET_S3_ACCESS_KEY"),
      secretKey: need("ASSET_S3_SECRET_KEY"),
      region: process.env.ASSET_S3_REGION || undefined,
    },
    "/api/assets"
  );

  let copied = 0;
  let skipped = 0;
  let bytes = 0;
  for await (const key of disk.list()) {
    const local = await disk.stat(key);
    const there = await bucket.stat(key);
    if (there && local && there.size === local.size) {
      skipped++;
      continue;
    }
    console.log(`${apply ? "copy" : "would copy"} ${key} (${local?.size ?? 0} bytes)`);
    if (apply) {
      const stream = await disk.read(key);
      const body = new Uint8Array(await new Response(stream).arrayBuffer());
      await bucket.putExact(key, body);
    }
    copied++;
    bytes += local?.size ?? 0;
  }
  console.log(
    `${root} → ${process.env.ASSET_S3_BUCKET}: ${copied} file(s), ${(bytes / 1024 / 1024).toFixed(1)} MB ${apply ? "copied" : "to copy — run with --apply"}; ${skipped} already there.`
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
