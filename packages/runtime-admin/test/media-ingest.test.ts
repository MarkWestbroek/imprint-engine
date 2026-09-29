import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import sharp from "sharp";
import { AssetRecordSchema, FileAssetStore, guardReads, inProcessPdp, userSubject, ANONYMOUS } from "@imprint/content-core";
import { createMemoryDb, MemoryContentStore } from "@imprint/content-core/memory-store";
import type { AdminContext, AdminSession } from "../src/admin-context";
import { assetsRoute, deleteTaglist, editTag, IngestRefused, ingestFiles, normalizeTag, replaceAssetFile, saveTaglist, serveAsset } from "../src/admin-server/media";
import { publicOrigin } from "../src/admin-server/media-api";
import { processUpload, readMidi, readWav, UploadError } from "../src/media/process";
import { resolveMedia } from "../src/media/resolve";

/**
 * The upload core and serving of the media library (design/beeldbibliotheek.md
 * §12): the new kinds (WAV, MIDI, JSON), limits per kind, a recording as one
 * group with tags, who may ingest, and HTTP Range when serving.
 */

/** A PCM WAV: 48 kHz, 24-bit stereo, `seconds` of silence. */
function wav(seconds: number): Uint8Array {
  const rate = 48000, channels = 2, bits = 24;
  const byteRate = (rate * channels * bits) / 8;
  const data = Math.round(byteRate * seconds);
  const b = Buffer.alloc(44 + data);
  b.write("RIFF", 0, "latin1");
  b.writeUInt32LE(36 + data, 4);
  b.write("WAVEfmt ", 8, "latin1");
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(channels, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(byteRate, 28);
  b.writeUInt16LE((channels * bits) / 8, 32);
  b.writeUInt16LE(bits, 34);
  b.write("data", 36, "latin1");
  b.writeUInt32LE(data, 40);
  return new Uint8Array(b);
}

/** A format-1 MIDI header with 3 tracks at 480 ppq (the tracks themselves don't matter here). */
function midi(): Uint8Array {
  const b = Buffer.alloc(14);
  b.write("MThd", 0, "latin1");
  b.writeUInt32BE(6, 4);
  b.writeUInt16BE(1, 8);
  b.writeUInt16BE(3, 10);
  b.writeUInt16BE(480, 12);
  return new Uint8Array(b);
}

const patch = () => new TextEncoder().encode(JSON.stringify({ type: "mmb-patch", modules: [{ id: "vco1" }] }));

describe("file kinds", () => {
  it("WAV: duration, rate, channels and depth from the header", async () => {
    assert.deepEqual(readWav(wav(1.5)), { channels: 2, sampleRate: 48000, bitDepth: 24, duration: 1.5 });
    const out = await processUpload(wav(0.1), "none");
    assert.equal(out.kind, "audio");
    assert.equal(out.mime, "audio/wav");
    assert.equal(out.variants.length, 0);
  });

  it("MIDI: format, tracks and ppq from MThd", async () => {
    assert.deepEqual(readMidi(midi()), { format: "midi", midiFormat: 1, tracks: 3, ppq: 480 });
    assert.equal((await processUpload(midi(), "none")).ext, "mid");
  });

  it("JSON: parsed, its declared type kept; broken JSON refused", async () => {
    const out = await processUpload(patch(), "none");
    assert.equal(out.kind, "data");
    assert.deepEqual(out.data, { format: "json", type: "mmb-patch" });
    await assert.rejects(processUpload(new TextEncoder().encode('{"a": '), "none"), /Not valid JSON/);
  });

  it("a WebP is an image, not audio (both are RIFF)", async () => {
    const webp = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#000" } }).webp().toBuffer();
    assert.equal((await processUpload(webp, "none")).kind, "image");
  });

  it("each kind has its own limit; above it the answer is 413", async () => {
    await assert.rejects(processUpload(wav(1), "none", { maxBytes: { audio: 1000 } }), (e: unknown) => e instanceof UploadError && e.status === 413);
    // The same bytes are fine under the default audio limit.
    assert.equal((await processUpload(wav(1), "none")).kind, "audio");
    await assert.rejects(processUpload(new Uint8Array([1, 2, 3, 4]), "none"), (e: unknown) => e instanceof UploadError && e.status === 415);
  });
});

describe("ingestFiles + serveAsset", () => {
  let dir: string;
  let admin: AdminContext;
  let session: AdminSession | null = { name: "mark", role: "editor" };

  before(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "imprint-media-"));
    const store = new MemoryContentStore(createMemoryDb());
    admin = {
      imprint: {
        writableStore: store,
        pdp: inProcessPdp,
        assets: new FileAssetStore(dir, "/api/assets"),
        media: { maxBytes: {}, cors: [] },
      },
      auth: { getSession: async () => session, editingSession: async () => session },
    } as unknown as AdminContext;
  });
  after(() => rm(dir, { recursive: true, force: true }));

  it("a recording becomes one group: three files, same folder, tags and group", async () => {
    const results = await ingestFiles(
      admin,
      userSubject("mark", "editor"),
      [
        { name: "take-1.wav", bytes: wav(0.5) },
        { name: "take-1.mid", bytes: midi() },
        { name: "take-1.patch.json", bytes: patch() },
      ],
      { folder: "Opnames/Sim", tags: ["sim-opname", "Onderwerp/Aftertouch"], group: "MMB take 1", exif: "none" }
    );
    assert.deepEqual(results.map((r) => [r.ok, r.kind]), [[true, "audio"], [true, "data"], [true, "data"]]);
    assert.deepEqual(results.map((r) => r.slug), ["take-1", "take-1-2", "take-1-patch"]);
    const store = admin.imprint.writableStore!;
    for (const r of results) {
      const a = AssetRecordSchema.parse((await store.getItem("asset", r.slug!))!.data);
      assert.equal(a.folder, "opnames/sim");
      assert.equal(a.group, "mmb-take-1");
      assert.deepEqual(a.tags, ["sim-opname", "onderwerp/aftertouch"]);
    }
  });

  it("one bad file does not stop the others; each answers with its own status", async () => {
    const results = await ingestFiles(admin, userSubject("mark", "editor"), [
      { name: "junk.bin", bytes: new Uint8Array([9, 9, 9, 9]) },
      { name: "ok.json", bytes: patch() },
    ]);
    assert.deepEqual(results.map((r) => [r.ok, r.status]), [[false, 415], [true, undefined]]);
  });

  it("a reader or a visitor may not ingest: the whole call is refused (403)", async () => {
    await assert.rejects(ingestFiles(admin, userSubject("rita", "reader"), [{ name: "x.json", bytes: patch() }]), (e: unknown) => e instanceof IngestRefused && e.status === 403);
    await assert.rejects(ingestFiles(admin, ANONYMOUS, [{ name: "x.json", bytes: patch() }]), IngestRefused);
  });

  it("serves byte ranges (seeking in a player), and 416 for a range past the end", async () => {
    session = null; // a visitor: a public audio file needs no session
    const parts = (await admin.imprint.writableStore!.getItem("asset", "take-1"))!.data as { file: { original: string } };
    const rel = parts.file.original.replace("/api/assets/", "").split("/");
    const full = await serveAsset(admin, rel);
    assert.equal(full.status, 200);
    assert.equal(full.headers.get("accept-ranges"), "bytes");
    const size = Number(full.headers.get("content-length"));
    assert.equal(size, wav(0.5).byteLength);

    const part = await serveAsset(admin, rel, "bytes=0-43");
    assert.equal(part.status, 206);
    assert.equal(part.headers.get("content-range"), `bytes 0-43/${size}`);
    const head = new Uint8Array(await part.arrayBuffer());
    assert.equal(head.byteLength, 44);
    assert.equal(Buffer.from(head.subarray(8, 12)).toString("latin1"), "WAVE");

    const tail = await serveAsset(admin, rel, "bytes=-10");
    assert.equal(tail.headers.get("content-range"), `bytes ${size - 10}-${size - 1}/${size}`);
    assert.equal((await serveAsset(admin, rel, `bytes=${size + 5}-`)).status, 416);
    session = { name: "mark", role: "editor" };
  });

  it("tag lists: a typo is fixed by renaming — the files follow; onto an existing tag it merges", async () => {
    const store = admin.imprint.writableStore!;
    assert.equal((await saveTaglist(admin, null, { name: "Onderwerp", tags: [{ label: "Aftertuch" }, { label: "Aftertouch" }, { label: "Strand" }] })).slug, "onderwerp");
    await ingestFiles(admin, userSubject("mark", "editor"), [{ name: "a.json", bytes: patch() }], { tags: ["onderwerp/aftertuch", "onderwerp/strand"] });
    const tagsOf = async (slug: string) => AssetRecordSchema.parse((await store.getItem("asset", slug))!.data).tags;

    const fixed = await editTag(admin, "onderwerp", "strand", { label: "Strand & zee" });
    assert.deepEqual([fixed.ok, fixed.affected], [true, 1]);
    assert.deepEqual(await tagsOf("a"), ["onderwerp/aftertuch", "onderwerp/strand-zee"]);

    const merged = await editTag(admin, "onderwerp", "aftertuch", { label: "Aftertouch" });
    assert.deepEqual([merged.ok, merged.affected], [true, 1]);
    assert.deepEqual(await tagsOf("a"), ["onderwerp/aftertouch", "onderwerp/strand-zee"]);
    const list = (await store.getItem("taglist", "onderwerp"))!.data as { tags: { slug: string }[] };
    assert.deepEqual(list.tags.map((t) => t.slug), ["aftertouch", "strand-zee"], "the misspelt tag is gone from the list");

    // A rename that only changes capitals keeps the slug: no file needs a new version.
    assert.equal((await editTag(admin, "onderwerp", "aftertouch", { label: "AfterTouch" })).affected, 0);
  });

  it("removing a tag or a whole list takes it off the files too", async () => {
    const store = admin.imprint.writableStore!;
    const tagsOf = async (slug: string) => AssetRecordSchema.parse((await store.getItem("asset", slug))!.data).tags;
    assert.equal((await editTag(admin, "onderwerp", "strand-zee", { remove: true })).affected, 1);
    assert.deepEqual(await tagsOf("a"), ["onderwerp/aftertouch"]);
    // "a" plus the recording from the first test, which was tagged onderwerp/aftertouch.
    assert.equal((await deleteTaglist(admin, "onderwerp")).affected, 4);
    assert.deepEqual(await tagsOf("a"), []);
    assert.equal(await store.getItem("taglist", "onderwerp"), null);
  });

  it("resolveMedia: a reference becomes the public version; restricted is invisible to a visitor; a URL stays a URL", async () => {
    const store = admin.imprint.writableStore!;
    const photo = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: "#123" } }).jpeg().toBuffer();
    const [r] = await ingestFiles(admin, userSubject("mark", "editor"), [{ name: "duin.jpg", bytes: photo }]);
    const record = AssetRecordSchema.parse((await store.getItem("asset", r.slug!))!.data);
    await store.putItem("asset", r.slug!, { ...record, alt: "Dunes" }, { by: "mark" });

    const ctx = (s: typeof store | null) => ({ store: s!, writableStore: s, readOptions: {} }) as never;
    const m = await resolveMedia(ctx(store), `asset:${r.slug}`);
    assert.equal(m?.src, "/api/assets/library/duin/w1600." + m!.src.split(".").slice(-2).join("."));
    assert.equal(m?.alt, "Dunes");
    assert.match(m?.srcSet ?? "", /w400\..+ 400w, .+w800\..+ 800w, .+w1600\..+ 1600w/);
    assert.deepEqual(await resolveMedia(ctx(store), "/boards/cortex.png"), { src: "/boards/cortex.png" });
    assert.equal(await resolveMedia(ctx(store), "asset:nonesuch"), null);
    assert.equal(await resolveMedia(ctx(null), `asset:${r.slug}`), null, "file mode has no library");

    await store.putItem("asset", r.slug!, { ...record, access: "restricted" }, { by: "mark" });
    assert.equal(await resolveMedia(ctx(guardReads(store, ANONYMOUS, inProcessPdp)), `asset:${r.slug}`), null);
    assert.ok(await resolveMedia(ctx(guardReads(store, userSubject("rita", "reader"), inProcessPdp)), `asset:${r.slug}`));
  });

  it("assetsRoute: CORS for the listed origins only, reading only, and a 403 stays a 403", async () => {
    const cors = admin.imprint.media as { cors?: string[] };
    cors.cors = ["http://editor.test"];
    session = null;
    const [r] = await ingestFiles(admin, userSubject("mark", "editor"), [{ name: "take.json", bytes: patch() }]);
    const rel = (AssetRecordSchema.parse((await admin.imprint.writableStore!.getItem("asset", r.slug!))!.data).file.original)
      .replace("/api/assets/", "")
      .split("/");
    const get = (origin?: string, method = "GET") =>
      assetsRoute(admin, new Request("http://site.test/x", { method, headers: origin ? { Origin: origin } : {} }), rel);

    const ok = await get("http://editor.test");
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get("access-control-allow-origin"), "http://editor.test");
    assert.equal(ok.headers.get("vary"), "Origin");
    assert.deepEqual(JSON.parse(await ok.text()).type, "mmb-patch");
    assert.equal((await get("https://evil.example")).headers.get("access-control-allow-origin"), null);

    const pre = await get("http://editor.test", "OPTIONS");
    assert.equal(pre.status, 204);
    assert.match(pre.headers.get("access-control-allow-headers") ?? "", /Range/);
    assert.doesNotMatch(pre.headers.get("access-control-allow-methods") ?? "", /POST/);

    await admin.imprint.writableStore!.putItem("asset", r.slug!, { ...(await admin.imprint.writableStore!.getItem("asset", r.slug!))!.data as object, access: "restricted" }, { by: "mark" });
    const denied = await get("http://editor.test");
    assert.equal(denied.status, 403, "CORS lets the editor read the answer, not the file");
    assert.equal(denied.headers.get("access-control-allow-origin"), "http://editor.test");
    cors.cors = [];
    session = { name: "mark", role: "editor" };
  });

  it("the ref route (markdown's asset:<slug>): a redirect to the public version; 404 when not visible", async () => {
    session = null;
    const photo = await sharp({ create: { width: 1000, height: 500, channels: 3, background: "#456" } }).jpeg().toBuffer();
    const [r] = await ingestFiles(admin, userSubject("mark", "editor"), [{ name: "golf.jpg", bytes: photo }]);
    const go = () => assetsRoute(admin, new Request("http://site.test/api/assets/_ref/golf"), ["_ref", r.slug!]);
    const res = await go();
    assert.equal(res.status, 302);
    // Relative: behind a proxy the server's own URL is not the visitor's.
    assert.match(res.headers.get("location") ?? "", /^\/api\/assets\/library\/golf\/w800\./);
    assert.equal((await assetsRoute(admin, new Request("http://site.test/x"), ["_ref", "nonesuch"])).status, 404);

    const store = admin.imprint.writableStore!;
    await store.putItem("asset", r.slug!, { ...(await store.getItem("asset", r.slug!))!.data as object, access: "restricted" }, { by: "mark" });
    assert.equal((await go()).status, 404, "a visitor gets nothing for a restricted asset");
    session = { name: "mark", role: "editor" };
    assert.equal((await go()).status, 302, "a signed-in reader does");
  });

  it("replaceAssetFile: an edited .mid replaces the old one — new URL, new version, same group and tags", async () => {
    session = { name: "mark", role: "editor" };
    const store = admin.imprint.writableStore!;
    const [mid] = await ingestFiles(admin, userSubject("mark", "editor"), [{ name: "edit-me.mid", bytes: midi() }], { group: "take-edit", tags: ["sim-opname"] });
    const before = AssetRecordSchema.parse((await store.getItem("asset", mid.slug!))!.data);
    assert.ok(before.created, "ingest stamps created");

    const edited = midi();
    edited[12] = 0x00;
    edited[13] = 0x60; // 96 ppq: other bytes, another file
    const r = await replaceAssetFile(admin, userSubject("mark", "editor"), mid.slug!, { name: "edit-me.mid", bytes: edited });
    assert.equal(r.ok, true);
    assert.notEqual(r.url, before.file.original, "a new key, so no cache serves the old bytes");
    const after = AssetRecordSchema.parse((await store.getItem("asset", mid.slug!))!.data);
    assert.equal(after.file.original, r.url);
    assert.equal(after.data?.ppq, 96);
    assert.deepEqual([after.group, after.tags, after.created], [before.group, before.tags, before.created]);

    const wrongKind = await replaceAssetFile(admin, userSubject("mark", "editor"), mid.slug!, { name: "x.json", bytes: patch() });
    assert.deepEqual([wrongKind.ok, wrongKind.status], [false, 415], "JSON may not replace MIDI, even though both are data");
    const missing = await replaceAssetFile(admin, userSubject("mark", "editor"), "nonesuch", { name: "x.mid", bytes: midi() });
    assert.equal(missing.status, 404);
    await assert.rejects(replaceAssetFile(admin, userSubject("rita", "reader"), mid.slug!, { name: "x.mid", bytes: midi() }), (e: unknown) => e instanceof IngestRefused && e.status === 403);
  });

  it("publicOrigin: the forwarded host wins over the server's own listen address", () => {
    const req = (headers: Record<string, string>) => new Request("http://0.0.0.0:3000/api/media", { headers });
    assert.equal(publicOrigin(req({ "x-forwarded-host": "musicbrain.nl", "x-forwarded-proto": "https", host: "0.0.0.0:3000" })), "https://musicbrain.nl");
    assert.equal(publicOrigin(req({ host: "localhost:3000" })), "http://localhost:3000");
    assert.equal(publicOrigin(req({})), "http://0.0.0.0:3000");
  });

  it("tags are normalised to list/tag or a free word", () => {
    assert.equal(normalizeTag(" Onderwerp/Portret "), "onderwerp/portret");
    assert.equal(normalizeTag("Sim Opname"), "sim-opname");
    assert.equal(normalizeTag("a/b/c"), "a/b-c");
  });
});
