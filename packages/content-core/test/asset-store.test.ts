import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { FileAssetStore, type AssetStore } from "../src/asset-store";
import { S3AssetStore } from "../src/asset-store.s3";

/**
 * What every asset backend must do (design/beeldbibliotheek.md §8): the disk
 * store always; a bucket when TEST_S3_ENDPOINT/_BUCKET/_ACCESS_KEY/_SECRET_KEY
 * point at one (a local MinIO, see `npm run test:db`) — skipped otherwise, so
 * `npm test` stays green on a bare checkout.
 */

const text = (s: string) => new TextEncoder().encode(s);
const readAll = async (s: ReadableStream<Uint8Array> | null) => (s ? new TextDecoder().decode(await new Response(s).arrayBuffer()) : null);

function assetStoreContract(name: string, factory: () => Promise<AssetStore>, skip: string | false = false) {
  describe(`${name}: asset-store contract`, { skip }, () => {
    const prefix = `contract-${Date.now().toString(36)}`;

    it("put fingerprints the name and returns a URL under urlBase; read/stat give the bytes back", async () => {
      const store = await factory();
      const url = await store.put(`${prefix}/render top.png`, text("hello asset"));
      assert.match(url, new RegExp(`^/api/assets/${prefix}/render_top\\.[0-9a-f]{8}\\.png$`));
      const key = url.replace("/api/assets/", "");
      assert.deepEqual(await store.stat(key), { size: 11 });
      assert.equal(await readAll(await store.read(key)), "hello asset");
      assert.equal(await readAll(await store.read(key, { start: 6, end: 10 })), "asset", "a byte range, inclusive");
    });

    it("the same bytes give the same URL; other bytes a new one", async () => {
      const store = await factory();
      const a = await store.put(`${prefix}/x.txt`, text("one"));
      assert.equal(await store.put(`${prefix}/x.txt`, text("one")), a);
      assert.notEqual(await store.put(`${prefix}/x.txt`, text("two")), a);
    });

    it("putExact keeps the key; list finds it; delete removes it; missing is null", async () => {
      const store = await factory();
      await store.putExact(`${prefix}/exact/a.b.json`, text("{}"));
      const all: string[] = [];
      for await (const k of store.list()) if (k.startsWith(prefix)) all.push(k);
      assert.ok(all.includes(`${prefix}/exact/a.b.json`));
      await store.delete(`${prefix}/exact/a.b.json`);
      assert.equal(await store.stat(`${prefix}/exact/a.b.json`), null);
      assert.equal(await store.read(`${prefix}/nope`), null);
    });

    it("never leaves its root: ../ is stripped from paths", async () => {
      const store = await factory();
      const url = await store.put(`../../${prefix}/escape.txt`, text("x"));
      assert.match(url, new RegExp(`^/api/assets/${prefix}/escape\\.`));
    });
  });
}

const dirs: string[] = [];
after(() => Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true }))));

assetStoreContract("FileAssetStore", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "imprint-assets-"));
  dirs.push(dir);
  return new FileAssetStore(dir, "/api/assets");
});

const s3 = {
  endpoint: process.env.TEST_S3_ENDPOINT,
  bucket: process.env.TEST_S3_BUCKET,
  accessKey: process.env.TEST_S3_ACCESS_KEY,
  secretKey: process.env.TEST_S3_SECRET_KEY,
};
assetStoreContract(
  "S3AssetStore",
  async () => new S3AssetStore(s3 as { endpoint: string; bucket: string; accessKey: string; secretKey: string }, "/api/assets"),
  s3.endpoint && s3.bucket && s3.accessKey && s3.secretKey ? false : "TEST_S3_* not set"
);
