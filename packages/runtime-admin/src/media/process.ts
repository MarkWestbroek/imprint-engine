import exifr from "exifr";
import sharp from "sharp";
import type { AssetPhoto, ExifPolicy } from "@imprint/content-core";

/**
 * What happens to an upload before it lands in the media library
 * (design/beeldbibliotheek.md §5–6): sniff the real type from the bytes (the
 * extension is not trusted), read the camera data, and make the web variants
 * — WebP at a fixed set of widths, never wider than the original. The
 * original's bytes are kept untouched; the EXIF policy applies to the
 * variants only.
 */

/** Variant widths in pixels; one is skipped when the original isn't wider. */
export const VARIANT_WIDTHS = [400, 800, 1600, 2400] as const;
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const RASTER = new Set(["jpeg", "png", "webp", "gif", "avif", "tiff"]);
const MIME: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  tiff: "image/tiff",
};
const EXT: Record<string, string> = { jpeg: "jpg", png: "png", webp: "webp", gif: "gif", avif: "avif", tiff: "tif" };

export type ProcessedVariant = { width: number; height: number; bytes: Buffer };

export type ProcessedUpload = {
  kind: "image" | "svg" | "document";
  mime: string;
  /** Extension for the stored original, from the sniffed type. */
  ext: string;
  width?: number;
  height?: number;
  variants: ProcessedVariant[];
  photo?: AssetPhoto;
  gps?: { lat: number; lon: number };
  /** From EXIF Artist/Copyright, as a starting value for the credit field. */
  credit?: string;
};

export class UploadError extends Error {}

function looksLikeSvg(bytes: Uint8Array): boolean {
  const head = Buffer.from(bytes.subarray(0, 1024)).toString("utf8").trimStart().toLowerCase();
  return head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"));
}

function looksLikePdf(bytes: Uint8Array): boolean {
  return Buffer.from(bytes.subarray(0, 5)).toString("latin1") === "%PDF-";
}

/** 0.004 → "1/250", 2.8 → "2800/1000": the rational strings libvips writes. */
function rational(x: number, exposure = false): string {
  if (exposure && x > 0 && x < 1) return `1/${Math.round(1 / x)}`;
  return `${Math.round(x * 1000)}/1000`;
}

type RawExif = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/**
 * The EXIF of the variants without the GPS block: camera, lens, exposure and
 * authorship survive, the location does not. Built anew from a whitelist —
 * sharp cannot drop one block from kept EXIF.
 */
function exifWithoutLocation(raw: RawExif): sharp.Exif {
  const ifd0: Record<string, string> = {};
  for (const key of ["Make", "Model", "Artist", "Copyright", "Software"]) {
    const v = str(raw[key]);
    if (v) ifd0[key] = v;
  }
  const ifd2: Record<string, string> = {};
  const exposure = num(raw.ExposureTime);
  if (exposure !== undefined) ifd2.ExposureTime = rational(exposure, true);
  const f = num(raw.FNumber);
  if (f !== undefined) ifd2.FNumber = rational(f);
  const focal = num(raw.FocalLength);
  if (focal !== undefined) ifd2.FocalLength = rational(focal);
  const iso = num(raw.ISO) ?? num(raw.ISOSpeedRatings);
  if (iso !== undefined) ifd2.ISOSpeedRatings = String(iso);
  for (const key of ["LensModel", "LensMake", "DateTimeOriginal"]) {
    const v = str(raw[key]);
    if (v) ifd2[key] = v;
  }
  return { IFD0: ifd0, IFD2: ifd2 };
}

async function readExif(bytes: Uint8Array): Promise<{ revived: RawExif | null; raw: RawExif | null }> {
  try {
    const [revived, raw] = await Promise.all([
      exifr.parse(Buffer.from(bytes), { gps: true, tiff: true, exif: true }),
      exifr.parse(Buffer.from(bytes), { gps: false, tiff: true, exif: true, reviveValues: false }),
    ]);
    return { revived: revived ?? null, raw: raw ?? null };
  } catch {
    return { revived: null, raw: null };
  }
}

function photoOf(exif: RawExif | null): AssetPhoto | undefined {
  if (!exif) return undefined;
  const taken = exif.DateTimeOriginal instanceof Date ? exif.DateTimeOriginal.toISOString() : str(exif.DateTimeOriginal);
  const make = str(exif.Make);
  const model = str(exif.Model);
  // "Leica Camera AG" + "LEICA Q2" → keep the model when it already names the make.
  const camera = model && make && model.toLowerCase().includes(make.split(" ")[0].toLowerCase()) ? model : [make, model].filter(Boolean).join(" ") || undefined;
  const photo: AssetPhoto = {
    taken,
    camera,
    lens: str(exif.LensModel),
    fNumber: num(exif.FNumber),
    exposure: num(exif.ExposureTime),
    iso: num(exif.ISO) ?? num(exif.ISOSpeedRatings),
    focalLength: num(exif.FocalLength),
  };
  return Object.values(photo).some((v) => v !== undefined) ? photo : undefined;
}

export async function processUpload(bytes: Uint8Array, policy: ExifPolicy): Promise<ProcessedUpload> {
  if (bytes.byteLength === 0) throw new UploadError("Empty file");
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new UploadError(`File is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`);
  }
  if (looksLikeSvg(bytes)) return { kind: "svg", mime: "image/svg+xml", ext: "svg", variants: [] };
  if (looksLikePdf(bytes)) return { kind: "document", mime: "application/pdf", ext: "pdf", variants: [] };

  let meta: sharp.Metadata;
  try {
    meta = await sharp(bytes).metadata();
  } catch {
    throw new UploadError("Unsupported file type (images, SVG and PDF only)");
  }
  const format = meta.format ?? "";
  if (!RASTER.has(format) || !meta.width || !meta.height) {
    throw new UploadError(`Unsupported image format "${format || "unknown"}"`);
  }
  // Orientation 5–8 = the camera held sideways: the displayed width is the stored height.
  const rotated = (meta.orientation ?? 1) >= 5;
  const width = rotated ? meta.height : meta.width;
  const height = rotated ? meta.width : meta.height;

  const { revived, raw } = await readExif(bytes);
  const lat = num(revived?.latitude);
  const lon = num(revived?.longitude);
  const credit = str(revived?.Artist) ?? str(revived?.Copyright);

  // Animated GIFs keep their animation as the original; no stills made of them.
  const animated = (meta.pages ?? 1) > 1;
  const variants: ProcessedVariant[] = [];
  if (!animated) {
    for (const w of VARIANT_WIDTHS) {
      if (w >= width) continue;
      let pipeline = sharp(bytes).rotate().resize({ width: w });
      if (policy === "all") pipeline = pipeline.keepExif();
      else if (policy === "no-location" && raw) pipeline = pipeline.withExif(exifWithoutLocation(raw));
      const out = await pipeline.webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
      variants.push({ width: out.info.width, height: out.info.height, bytes: out.data });
    }
  }

  return {
    kind: "image",
    mime: MIME[format],
    ext: EXT[format],
    width,
    height,
    variants,
    photo: photoOf(revived),
    gps: policy === "all" && lat !== undefined && lon !== undefined ? { lat, lon } : undefined,
    credit,
  };
}

/** "Mijn Foto (2).JPG" → "mijn-foto-2"; empty → "asset". */
export function slugFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]*$/, "");
  const slug = base
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return slug || "asset";
}

/** First free slug: "foto", "foto-2", "foto-3", … */
export function uniqueSlug(wanted: string, taken: Set<string>): string {
  if (!taken.has(wanted)) return wanted;
  for (let i = 2; ; i++) if (!taken.has(`${wanted}-${i}`)) return `${wanted}-${i}`;
}
