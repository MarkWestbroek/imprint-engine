import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { computeItinerary, Locale, type ContentType } from "@imprint/content-core";
import { store, writableStore } from "@/lib/content";
import { canEdit, getSession } from "@/lib/auth";

/**
 * Content API over the same ContentStore the pages use (S1), so API, site and
 * admin can never disagree.
 *
 * GET (read-only, published content unless an admin session asks for drafts):
 *   /api/content                       index of endpoints
 *   /api/content/site
 *   /api/content/products[/slug]
 *   /api/content/components[/slug]
 *   /api/content/releases              ?project= ?product=
 *   /api/content/itinerary/<product>   derived component itinerary
 *   /api/content/pages[/slug]          ?prefix=posts/
 *   /api/content/menus/<name>
 *   params: ?lang=nl (fallback EN), ?asOf=ISO (time travel, S5), ?drafts=1 (admins)
 *
 * POST (write, for product-projects to push their data — Bearer INGEST_TOKEN):
 *   /api/content/<type>/<slug>         one item (body = the content)
 *   /api/content                       bundle { product?, components?, releases? }
 *   ingestable types: product, component, release, page
 */

const CACHE = "public, max-age=60";
const INGESTABLE = new Set<ContentType>(["product", "component", "release", "page"]);

function json(data: unknown, cache = true) {
  return NextResponse.json(data, {
    headers: cache ? { "Cache-Control": CACHE } : undefined,
  });
}

function error(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await ctx.params;
  const q = req.nextUrl.searchParams;

  const langRaw = q.get("lang");
  const lang = langRaw ? Locale.safeParse(langRaw) : undefined;
  if (lang && !lang.success) return error(400, `Unknown lang "${langRaw}"`);

  const asOfRaw = q.get("asOf");
  const asOf = asOfRaw ? new Date(asOfRaw) : undefined;
  if (asOf && Number.isNaN(asOf.getTime())) return error(400, `Bad asOf "${asOfRaw}"`);

  const includeDrafts = q.get("drafts") === "1" && canEdit(await getSession());
  const opts = { lang: lang?.data, asOf, includeDrafts };
  const noCache = includeDrafts || asOf !== undefined;

  const [type, ...slugParts] = path;
  const slug = slugParts.map(decodeURIComponent).join("/");

  switch (type) {
    case undefined:
      return json({
        endpoints: [
          "/api/content/site",
          "/api/content/products[/slug]",
          "/api/content/components[/slug]",
          "/api/content/releases?project=&product=",
          "/api/content/itinerary/<product>",
          "/api/content/pages[/slug]?prefix=",
          "/api/content/menus/<name>",
        ],
        write: "POST /api/content(/type/slug) with Authorization: Bearer <INGEST_TOKEN>",
        params: { lang: "en|nl", asOf: "ISO date (time travel)", drafts: "1 (admins)" },
      });

    case "site":
      return json(await store.getSiteConfig(), !noCache);

    case "products": {
      if (!slug) return json(await store.listProducts(opts), !noCache);
      const product = await store.getProduct(slug, opts);
      return product ? json(product, !noCache) : error(404, `No product "${slug}"`);
    }

    case "components": {
      if (!slug) return json(await store.listComponents(opts), !noCache);
      const component = await store.getComponent(slug, opts);
      return component ? json(component, !noCache) : error(404, `No component "${slug}"`);
    }

    case "releases":
      return json(
        await store.listReleases({
          ...opts,
          project: q.get("project") ?? undefined,
          product: q.get("product") ?? undefined,
        }),
        !noCache
      );

    case "itinerary": {
      if (!slug) return error(400, "Product slug required: /api/content/itinerary/<product>");
      const releases = await store.listReleases({ ...opts, product: slug });
      return json(computeItinerary(releases), !noCache);
    }

    case "pages": {
      if (!slug) {
        return json(
          await store.listPages({ ...opts, prefix: q.get("prefix") ?? undefined }),
          !noCache
        );
      }
      const page = await store.getPage(slug, opts);
      return page ? json(page, !noCache) : error(404, `No page "${slug}"`);
    }

    case "menus": {
      if (!slug) return error(400, "Menu name required: /api/content/menus/main");
      const menu = await store.getMenu(slug, opts);
      return menu ? json(menu, !noCache) : error(404, `No menu "${slug}"`);
    }

    default:
      return error(404, `Unknown content type "${type}"`);
  }
}

/** Bearer-token check for machine-to-machine writes (constant-time). */
function authorized(req: NextRequest): boolean {
  const token = process.env.INGEST_TOKEN;
  if (!token) return false; // writes disabled until a token is configured
  const provided = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(provided);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  if (!authorized(req)) return error(401, "Missing or invalid ingest token");
  if (!writableStore) return error(503, "Writes require DATABASE_URL");

  const body: unknown = await req.json().catch(() => null);
  if (body === null || typeof body !== "object") return error(400, "Body must be a JSON object");

  const { path = [] } = await ctx.params;

  // No path → bundle push from a product-project.
  if (path.length === 0) return ingestBundle(body as Record<string, unknown>);

  const [type, ...slugParts] = path;
  const slug = slugParts.map(decodeURIComponent).join("/");
  if (!INGESTABLE.has(type as ContentType)) {
    return error(400, `Type "${type}" is not ingestable (${[...INGESTABLE].join(", ")})`);
  }
  if (!slug) return error(400, "Slug required: POST /api/content/<type>/<slug>");

  try {
    await putOne(type as ContentType, slug, body as Record<string, unknown>);
  } catch (err) {
    return error(422, err instanceof Error ? err.message : String(err));
  }
  return json({ ok: true, type, slug }, false);
}

async function putOne(type: ContentType, slug: string, data: Record<string, unknown>) {
  await writableStore!.putItem(type, slug, data, {
    lang: typeof data.lang === "string" ? data.lang : "en",
    by: "ingest",
  });
}

/** { product?, components?: [], releases?: [] } → one put each. */
async function ingestBundle(body: Record<string, unknown>) {
  const written: { type: ContentType; slug: string }[] = [];
  const record = async (type: ContentType, slug: string, data: Record<string, unknown>) => {
    await putOne(type, slug, data);
    written.push({ type, slug });
  };

  try {
    // Order matters when references are enforced: components exist before the
    // product/releases that point at them.
    for (const c of (body.components as Record<string, unknown>[] | undefined) ?? []) {
      await record("component", String(c.slug ?? ""), c);
    }
    const product = body.product as Record<string, unknown> | undefined;
    if (product) await record("product", String(product.slug ?? ""), product);

    for (const r of (body.releases as Record<string, unknown>[] | undefined) ?? []) {
      const slug =
        (r.slug as string | undefined) ??
        `${String(r.product ?? r.project ?? "")}-${String(r.version ?? "")}`;
      await record("release", slug, r);
    }
  } catch (err) {
    return error(422, err instanceof Error ? err.message : String(err));
  }
  return json({ ok: true, written }, false);
}
