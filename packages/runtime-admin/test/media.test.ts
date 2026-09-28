import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import exifr from "exifr";
import sharp from "sharp";
import { AssetRecordSchema, type AssetRecord } from "@imprint/content-core";
import { displayUrl, fileAccess } from "../src/media/access";
import { processUpload, slugFromFilename, uniqueSlug, UploadError, VARIANT_WIDTHS } from "../src/media/process";

/**
 * The media library's upload processing and per-format access
 * (design/beeldbibliotheek.md §5–7). The test photo is made here: a 3000 px
 * JPEG with camera data and a GPS position, as a phone or camera writes it.
 */

let photo: Buffer;

async function exifOf(buf: Buffer) {
  const m = await sharp(buf).metadata();
  if (!m.exif) return null;
  const tiff = m.exif.subarray(0, 6).toString("latin1") === "Exif\0\0" ? m.exif.subarray(6) : m.exif;
  return exifr.parse(tiff, { gps: true });
}

before(async () => {
  photo = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#884422" } })
    .withExif({
      IFD0: { Make: "Leica", Model: "Q2", Artist: "Mark" },
      IFD2: { ExposureTime: "1/250", FNumber: "28/10", ISOSpeedRatings: "100", FocalLength: "28/1", LensModel: "Summilux 28", DateTimeOriginal: "2026:09:20 14:03:00" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "52/1 5/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "5/1 7/1 0/1" },
    })
    .jpeg()
    .toBuffer();
});

describe("processUpload", () => {
  it("sniffs a JPEG, reads its camera data and makes WebP variants no wider than the original", async () => {
    const out = await processUpload(photo, "no-location");
    assert.equal(out.kind, "image");
    assert.equal(out.mime, "image/jpeg");
    assert.equal(out.ext, "jpg");
    assert.deepEqual([out.width, out.height], [3000, 2000]);
    assert.deepEqual(out.variants.map((v) => v.width), [...VARIANT_WIDTHS]);
    assert.equal(out.variants[1].height, 533);
    for (const v of out.variants) assert.equal((await sharp(v.bytes).metadata()).format, "webp");
    assert.equal(out.photo?.camera, "Leica Q2");
    assert.equal(out.photo?.lens, "Summilux 28");
    assert.equal(out.photo?.fNumber, 2.8);
    assert.equal(out.photo?.iso, 100);
    assert.equal(out.credit, "Mark");
  });

  it("never makes a variant as wide as, or wider than, the original", async () => {
    const small = await sharp({ create: { width: 900, height: 600, channels: 3, background: "#000" } }).png().toBuffer();
    const out = await processUpload(small, "none");
    assert.deepEqual(out.variants.map((v) => v.width), [400, 800]);
  });

  it("EXIF policy 'no-location': camera data survives in the variants, the GPS position does not", async () => {
    const out = await processUpload(photo, "no-location");
    const exif = await exifOf(out.variants[0].bytes);
    assert.equal(exif?.Make, "Leica");
    assert.equal(exif?.LensModel, "Summilux 28");
    assert.equal(exif?.latitude, undefined);
    assert.equal(out.gps, undefined, "the record keeps no position either");
  });

  it("EXIF policy 'all': the variants keep the position, and the record gets it", async () => {
    const out = await processUpload(photo, "all");
    const exif = await exifOf(out.variants[0].bytes);
    assert.ok(Math.abs((exif?.latitude ?? 0) - 52.0833) < 0.001);
    assert.ok(out.gps && Math.abs(out.gps.lon - 5.1167) < 0.001);
  });

  it("EXIF policy 'none': the variants carry no EXIF at all (camera data is still read for the record)", async () => {
    const out = await processUpload(photo, "none");
    assert.equal(await exifOf(out.variants[0].bytes), null);
    assert.equal(out.photo?.camera, "Leica Q2");
  });

  it("takes SVG and PDF as they are, and refuses anything else whatever its name", async () => {
    const svg = await processUpload(Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>'), "none");
    assert.equal(svg.kind, "svg");
    assert.equal(svg.variants.length, 0);
    const pdf = await processUpload(Buffer.from("%PDF-1.7\n…"), "none");
    assert.equal(pdf.kind, "document");
    await assert.rejects(processUpload(Buffer.from("MZ\x90\x00 not an image"), "none"), UploadError);
    await assert.rejects(processUpload(new Uint8Array(0), "none"), UploadError);
  });
});

describe("slugs", () => {
  it("come from the filename and are made unique", () => {
    assert.equal(slugFromFilename("Mijn Foto (2).JPG"), "mijn-foto-2");
    assert.equal(slugFromFilename("Café—Zürich.jpeg"), "cafe-zurich");
    assert.equal(slugFromFilename(".jpg"), "asset");
    assert.equal(uniqueSlug("foto", new Set(["foto", "foto-2"])), "foto-3");
  });
});

describe("fileAccess — per format", () => {
  const asset = (over: Partial<AssetRecord> = {}): AssetRecord =>
    AssetRecordSchema.parse({
      slug: "q2",
      file: {
        filename: "q2.jpg",
        kind: "image",
        mime: "image/jpeg",
        size: 1,
        width: 3000,
        height: 2000,
        original: "/api/assets/library/q2/original.aa.jpg",
        variants: [400, 800, 1600, 2400].map((w) => ({ width: w, height: w, url: `/api/assets/library/q2/w${w}.aa.webp` })),
        exif: "none",
      },
      ...over,
    });

  it("the original is never public", () => {
    assert.equal(fileAccess(asset(), "/api/assets/library/q2/original.aa.jpg"), "editor");
  });

  it("public asset: every variant is public, unless it is above publicMaxWidth", () => {
    assert.equal(fileAccess(asset(), "/api/assets/library/q2/w2400.aa.webp"), "public");
    const capped = asset({ publicMaxWidth: 800 });
    assert.equal(fileAccess(capped, "/api/assets/library/q2/w800.aa.webp"), "public");
    assert.equal(fileAccess(capped, "/api/assets/library/q2/w1600.aa.webp"), "editor");
  });

  it("restricted asset: small variants for readers, the rest for editors", () => {
    const r = asset({ access: "restricted", publicMaxWidth: 800 });
    assert.equal(fileAccess(r, "/api/assets/library/q2/w400.aa.webp"), "reader");
    assert.equal(fileAccess(r, "/api/assets/library/q2/w1600.aa.webp"), "editor");
  });

  it("an unknown file of the asset is refused", () => {
    assert.equal(fileAccess(asset(), "/api/assets/library/q2/w999.aa.webp"), "none");
  });

  it("the display URL is the widest variant a visitor may see, up to 1600", () => {
    assert.equal(displayUrl(asset()), "/api/assets/library/q2/w1600.aa.webp");
    assert.equal(displayUrl(asset({ publicMaxWidth: 800 })), "/api/assets/library/q2/w800.aa.webp");
  });
});
