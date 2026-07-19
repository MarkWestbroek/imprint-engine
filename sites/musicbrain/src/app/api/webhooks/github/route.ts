import { createHmac, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { store, writableStore } from "@/lib/content";

/**
 * GitHub release-webhook (W2/S7): "de releaselijst gaat nooit meer stale".
 * Point a repo webhook (content type application/json, secret =
 * GITHUB_WEBHOOK_SECRET, event "Releases") at POST /api/webhooks/github;
 * each published release becomes a release content-item. Which repo maps to
 * which project/product staat in de site-config (`releaseSources`) — repos
 * die daar niet staan worden genegeerd, dus een verkeerd gerichte webhook
 * kan geen content maken. Reposts supersede bitemporaal (edited release op
 * GitHub → nieuwe versie hier, historie blijft).
 */

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

/** GitHub signs the raw body: sha256=<hmac>. Constant-time compare. */
function verifySignature(raw: string, header: string | null, secret: string): boolean {
  const expected = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
  const got = Buffer.from(header ?? "");
  const want = Buffer.from(expected);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function POST(req: NextRequest) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return json(503, { error: "GITHUB_WEBHOOK_SECRET not set — webhook disabled" });
  if (!writableStore) return json(503, { error: "Writes require DATABASE_URL" });

  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), secret)) {
    return json(401, { error: "Bad signature" });
  }

  const event = req.headers.get("x-github-event");
  if (event === "ping") return json(200, { ok: true, pong: true });
  if (event !== "release") return json(202, { ignored: `event ${event}` });

  let payload: {
    action?: string;
    repository?: { full_name?: string };
    release?: {
      tag_name?: string;
      name?: string;
      body?: string;
      html_url?: string;
      prerelease?: boolean;
      published_at?: string;
      assets?: { name: string; browser_download_url: string }[];
    };
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return json(400, { error: "Body is not JSON" });
  }

  // "published" covers both new releases and prereleases; edits arrive as
  // "edited" and supersede the earlier assertion (bitemporal put).
  const action = payload.action ?? "";
  if (!["published", "edited", "released"].includes(action)) {
    return json(202, { ignored: `action ${action}` });
  }

  const repo = payload.repository?.full_name ?? "";
  const site = await store.getSiteConfig();
  const source = site.releaseSources[repo];
  if (!source) return json(202, { ignored: `repo ${repo} not in site.releaseSources` });

  const rel = payload.release;
  const tag = rel?.tag_name;
  if (!rel || !tag) return json(400, { error: "release.tag_name missing" });

  const data = {
    project: source.project,
    ...(source.product && { product: source.product }),
    version: tag,
    date: (rel.published_at ?? new Date().toISOString()).slice(0, 10),
    channel: rel.prerelease ? "beta" : "stable",
    highlights: [],
    body: rel.body ?? "",
    sourceUrl: rel.html_url,
    downloads: (rel.assets ?? []).map((a) => ({ label: a.name, url: a.browser_download_url })),
  };
  const slug = `${source.project}-${tag}`;

  try {
    await writableStore.putItem("release", slug, data, { by: `webhook:github:${repo}` });
  } catch (err) {
    return json(422, { error: err instanceof Error ? err.message : String(err) });
  }

  revalidatePath("/", "layout");
  return json(200, { ok: true, slug, action });
}
