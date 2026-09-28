import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { assetKey, safeAssetPath, type AssetStore } from "./asset-store";

/**
 * Assets in an S3 bucket — MinIO (design/beeldbibliotheek.md §8: one bucket
 * per site, with a key that may only use that bucket), Garage or S3 itself.
 * Keys are the same paths the FileAssetStore uses, so the URLs in content
 * (`/api/assets/<key>`) do not change when a site moves from disk to a bucket;
 * the site's route still serves them, with the same access rules.
 */

export type S3AssetConfig = {
  /** e.g. "http://localhost:9000" (MinIO) — path-style addressing is used. */
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  region?: string;
};

const CONTENT_TYPES: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  tif: "image/tiff",
  pdf: "application/pdf",
  zip: "application/zip",
  json: "application/json",
  glb: "model/gltf-binary",
  wav: "audio/wav",
  mid: "audio/midi",
};

const isNotFound = (err: unknown) => {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === "NotFound" || e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404;
};

export class S3AssetStore implements AssetStore {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(
    config: S3AssetConfig,
    readonly urlBase: string
  ) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region ?? "us-east-1",
      forcePathStyle: true,
      credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
    });
  }

  async put(assetPath: string, bytes: Uint8Array): Promise<string> {
    const key = assetKey(assetPath, bytes);
    await this.putExact(key, bytes);
    return `${this.urlBase.replace(/\/$/, "")}/${key}`;
  }

  async putExact(assetPath: string, bytes: Uint8Array): Promise<void> {
    const key = safeAssetPath(assetPath);
    const ext = key.split(".").pop()?.toLowerCase() ?? "";
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: bytes, ContentType: CONTENT_TYPES[ext] ?? "application/octet-stream" })
    );
  }

  async delete(assetPath: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: safeAssetPath(assetPath) }));
  }

  async stat(assetPath: string): Promise<{ size: number } | null> {
    try {
      const head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: safeAssetPath(assetPath) }));
      return { size: head.ContentLength ?? 0 };
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  async read(assetPath: string, range?: { start: number; end: number }): Promise<ReadableStream<Uint8Array> | null> {
    try {
      const out = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: safeAssetPath(assetPath),
          Range: range ? `bytes=${range.start}-${range.end}` : undefined,
        })
      );
      return (out.Body?.transformToWebStream() as ReadableStream<Uint8Array> | undefined) ?? null;
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  async *list(): AsyncIterable<string> {
    let token: string | undefined;
    do {
      const page = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, ContinuationToken: token }));
      for (const o of page.Contents ?? []) if (o.Key) yield o.Key;
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  }
}
