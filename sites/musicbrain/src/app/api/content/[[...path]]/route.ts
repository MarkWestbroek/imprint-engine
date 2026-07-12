import { NextResponse, type NextRequest } from "next/server";
import { Locale } from "@imprint/content-core";
import { store } from "@/lib/content";
import { canEdit, getSession } from "@/lib/auth";

/**
 * Read-only content API (S1: same ContentStore the pages use, so the API,
 * the site and the admin can never disagree). Published content only —
 * exactly what the public pages show — unless an admin session asks for
 * drafts.
 *
 *   GET /api/content                     index of endpoints
 *   GET /api/content/site                site config
 *   GET /api/content/products[/slug]     products
 *   GET /api/content/releases            releases (?project=...)
 *   GET /api/content/pages[/slug...]     pages (?prefix=posts/)
 *   GET /api/content/menus/name          menu
 *
 * Common query params: ?lang=nl (fallback EN), ?asOf=2026-01-01 (time
 * travel, S5), ?drafts=1 (admins only).
 */

const CACHE = "public, max-age=60";

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
          "/api/content/releases?project=",
          "/api/content/pages[/slug]?prefix=",
          "/api/content/menus/name",
        ],
        params: { lang: "en|nl", asOf: "ISO date (time travel)", drafts: "1 (admins)" },
      });

    case "site":
      return json(await store.getSiteConfig(), !noCache);

    case "products": {
      if (!slug) return json(await store.listProducts(opts), !noCache);
      const product = await store.getProduct(slug, opts);
      return product ? json(product, !noCache) : error(404, `No product "${slug}"`);
    }

    case "releases":
      return json(
        await store.listReleases({ ...opts, project: q.get("project") ?? undefined }),
        !noCache
      );

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
