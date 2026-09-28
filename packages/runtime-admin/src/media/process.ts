import exifr from "exifr";
import sharp from "sharp";
import { DEFAULT_MEDIA_MAX_BYTES, type AssetAudio, type AssetData, type AssetPhoto, type ExifPolicy } from "@imprint/content-core";

/**
 * What happens to an upload before it lands in the media library
 * (design/beeldbibliotheek.md §5–6, §12.2). Each file kind has a handler:
 * it recognises its files by their bytes (the extension and the browser's
 * content type are not trusted), reads its metadata and makes variants where
 * that makes sense. Images get WebP web versions at a fixed set of widths,
 * never wider than the original; the original's bytes are always kept
 * untouched and the EXIF policy applies to the variants only. Every kind has
 * its own size limit (`media.maxBytes` in the site config).
 */

/** Variant widths in pixels; one is skipped when the original isn't wider. */
export const VARIANT_WIDTHS = [400, 800, 1600, 2400] as const;

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
  kind: string;
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
  audio?: AssetAudio;
  data?: AssetData;
};

/** A refused upload; `status` is the HTTP answer an API gives for it (413, 415, 400). */
export class UploadError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 | 415 = 415
  ) {
    super(message);
  }
}

/** One file kind: how to recognise it, and how to process it. Checked in order; the first that recognises the bytes wins. */
export type KindHandler = {
  kind: string;
  sniff(bytes: Uint8Array): boolean;
  process(bytes: Uint8Array, policy: ExifPolicy): Promise<ProcessedUpload>;
};

const ascii = (bytes: Uint8Array, from: number, to: number) => Buffer.from(bytes.subarray(from, to)).toString("latin1");

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

async function processImage(bytes: Uint8Array, policy: ExifPolicy): Promise<ProcessedUpload> {
  let meta: sharp.Metadata;
  try {
    meta = await sharp(bytes).metadata();
  } catch {
    throw new UploadError("Unreadable image");
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

/** JPEG, PNG, GIF, WebP, AVIF/HEIF, TIFF by their magic numbers; sharp decides the rest. */
function looksLikeRaster(b: Uint8Array): boolean {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true; // JPEG
  if (ascii(b, 1, 4) === "PNG") return true;
  if (ascii(b, 0, 4) === "GIF8") return true;
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return true;
  if (ascii(b, 4, 8) === "ftyp") return true; // AVIF / HEIF
  const tiff = ascii(b, 0, 4);
  return tiff === "II*\0" || tiff === "MM\0*";
}

/** The fmt and data chunks of a RIFF/WAVE file: enough for duration, rate, channels, depth. */
export function readWav(b: Uint8Array): AssetAudio {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let pos = 12;
  let byteRate = 0;
  const audio: AssetAudio = {};
  while (pos + 8 <= b.byteLength) {
    const id = ascii(b, pos, pos + 4);
    const size = view.getUint32(pos + 4, true);
    const body = pos + 8;
    if (id === "fmt " && body + 16 <= b.byteLength) {
      audio.channels = view.getUint16(body + 2, true);
      audio.sampleRate = view.getUint32(body + 4, true);
      byteRate = view.getUint32(body + 8, true);
      audio.bitDepth = view.getUint16(body + 14, true);
    } else if (id === "data") {
      // A recorder that cannot seek back writes 0 or 0xFFFFFFFF: use what is there.
      const dataBytes = size === 0 || size === 0xffffffff ? b.byteLength - body : Math.min(size, b.byteLength - body);
      if (byteRate > 0) audio.duration = Math.round((dataBytes / byteRate) * 1000) / 1000;
      break;
    }
    pos = body + size + (size % 2); // chunks are word-aligned
  }
  return audio;
}

/** The MThd header: format, number of tracks, ticks per quarter note. */
export function readMidi(b: Uint8Array): AssetData {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const division = b.byteLength >= 14 ? view.getUint16(12, false) : 0;
  return {
    format: "midi",
    midiFormat: b.byteLength >= 10 ? view.getUint16(8, false) : undefined,
    tracks: b.byteLength >= 12 ? view.getUint16(10, false) : undefined,
    // The high bit set means SMPTE timing, not ticks per quarter.
    ppq: division && !(division & 0x8000) ? division : undefined,
  };
}

function jsonText(b: Uint8Array): string | null {
  const text = Buffer.from(b).toString("utf8").replace(/^﻿/, "");
  const first = text.trimStart()[0];
  return first === "{" || first === "[" ? text : null;
}

/** The core's kinds, in the order they are tried (cheap magic numbers first, sharp last). */
export const coreKindHandlers: KindHandler[] = [
  {
    kind: "svg",
    sniff: looksLikeSvg,
    process: async () => ({ kind: "svg", mime: "image/svg+xml", ext: "svg", variants: [] }),
  },
  {
    kind: "document",
    sniff: looksLikePdf,
    process: async () => ({ kind: "document", mime: "application/pdf", ext: "pdf", variants: [] }),
  },
  {
    kind: "audio",
    sniff: (b) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WAVE",
    process: async (b) => ({ kind: "audio", mime: "audio/wav", ext: "wav", variants: [], audio: readWav(b) }),
  },
  {
    kind: "data",
    sniff: (b) => ascii(b, 0, 4) === "MThd",
    process: async (b) => ({ kind: "data", mime: "audio/midi", ext: "mid", variants: [], data: readMidi(b) }),
  },
  {
    kind: "data",
    sniff: (b) => jsonText(b) !== null,
    process: async (b) => {
      let doc: unknown;
      try {
        doc = JSON.parse(jsonText(b)!);
      } catch {
        throw new UploadError("Not valid JSON");
      }
      const top = doc && typeof doc === "object" && !Array.isArray(doc) ? (doc as Record<string, unknown>) : {};
      const type = [top.$schema, top.type, top.kind].find((v): v is string => typeof v === "string" && v.length < 200);
      return { kind: "data", mime: "application/json", ext: "json", variants: [], data: { format: "json", type } };
    },
  },
  { kind: "image", sniff: looksLikeRaster, process: processImage },
];

/**
 * Recognise and process one upload. `maxBytes` holds the limit per kind (the
 * site config); a file above its kind's limit is refused with status 413.
 */
export async function processUpload(
  bytes: Uint8Array,
  policy: ExifPolicy,
  opts: { maxBytes?: Record<string, number>; handlers?: KindHandler[] } = {}
): Promise<ProcessedUpload> {
  if (bytes.byteLength === 0) throw new UploadError("Empty file", 400);
  const limits: Record<string, number> = { ...DEFAULT_MEDIA_MAX_BYTES, ...opts.maxBytes };
  const handler = (opts.handlers ?? coreKindHandlers).find((h) => h.sniff(bytes));
  if (!handler) throw new UploadError("Unsupported file type (images, SVG, PDF, WAV, MIDI and JSON)", 415);
  const limit = limits[handler.kind] ?? DEFAULT_MEDIA_MAX_BYTES.image;
  if (bytes.byteLength > limit) {
    throw new UploadError(`File is larger than ${Math.round(limit / 1024 / 1024)} MB (the limit for ${handler.kind})`, 413);
  }
  return handler.process(bytes, policy);
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
