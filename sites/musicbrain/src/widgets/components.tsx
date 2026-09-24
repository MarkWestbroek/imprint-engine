import Link from "next/link";
import {
  computeItinerary,
  type Product,
} from "@imprint/content-core";
import {
  WidgetFrame,
  type WidgetContext,
  type WidgetViewer,
  type WidgetViewers,
} from "@imprint/runtime-admin";
import { planningViewers } from "@imprint/plugin-planning";
import { standardViewers } from "@imprint/widgets-standard/viewers";
import {
  ProductComponents,
  ProductHeader,
  ProductReleases,
  ProductSpecs,
} from "@/components/product-sections";
import { BoardSpecView } from "@/components/board-spec-view";
import { StatusBadge } from "@/components/status-badge";
import { displayVersion } from "@/lib/format";
import { BoardCanvas } from "./board-canvas";
import type {
  BoardConfig,
  BoardSpecConfig,
  ComponentsConfig,
  DownloadsConfig,
  ItineraryConfig,
  ProductsConfig,
  ReleasesConfig,
  SpecTableConfig,
  SubjectHeaderConfig,
} from "./registry";

/**
 * MusicBrain's widget viewers: the domain widgets below, plus the standard
 * ones from @imprint/widgets-standard (architecture.md §3). Async server
 * components; they read content only through the WidgetContext `ctx` they
 * receive (lint-enforced). Configs have already been validated against
 * ./registry.ts by the store.
 */

async function BoardWidget({ config }: { config: BoardConfig }) {
  // Thin server shell: the hover interaction lives in the client island.
  return (
    <WidgetFrame title={config.title}>
      <BoardCanvas
        image={config.image}
        alt={config.alt}
        points={config.points}
        mode={config.mode}
      />
    </WidgetFrame>
  );
}

/** The spec slug, from config or derived from a subject component's version. */
function resolveSpecSlug(config: BoardSpecConfig, subject?: unknown): string | undefined {
  if (config.spec) return config.spec;
  const s = subject as { slug?: string; versions?: { number: string; spec?: string }[] } | undefined;
  const version = s?.versions?.[0];
  if (s?.slug && version) return version.spec ?? `${s.slug}@${version.number}`;
  return undefined;
}

async function BoardSpecWidget({
  config,
  subject,
  ctx,
}: {
  config: BoardSpecConfig;
  subject?: unknown;
  ctx: WidgetContext;
}) {
  const slug = resolveSpecSlug(config, subject);
  const spec = slug ? await ctx.store.getBoardSpec(slug, ctx.readOptions) : null;
  return (
    <WidgetFrame title={config.title}>
      {spec ? (
        <BoardSpecView spec={spec} />
      ) : (
        <p className="text-sm text-muted">
          {slug ? `No board-spec "${slug}".` : "No board-spec (set one, or use on a component)."}
        </p>
      )}
    </WidgetFrame>
  );
}

async function ItineraryWidget({
  config,
  subject,
  ctx,
}: {
  config: ItineraryConfig;
  subject?: unknown;
  ctx: WidgetContext;
}) {
  const product =
    config.product ?? (subject as { slug?: string } | undefined)?.slug;
  const releases = product ? await ctx.store.listReleases({ product, ...ctx.readOptions }) : [];
  const itinerary = computeItinerary(releases);

  return (
    <WidgetFrame title={config.title}>
      {itinerary.length === 0 ? (
        <p className="text-sm text-muted">
          {product ? `No component history for "${product}" yet.` : "No product (set one, or use on a product page)."}
        </p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-1.5 pr-3">Component</th>
              <th className="py-1.5 pr-3">From</th>
              <th className="py-1.5 pr-3">Until</th>
              <th className="py-1.5">Versions</th>
            </tr>
          </thead>
          <tbody>
            {itinerary.map((row) => (
              <tr key={row.component} className="border-b border-line">
                <td className="py-1.5 pr-3">
                  <Link href={`/components/${row.component}`} className="text-accent hover:underline">
                    {row.component}
                  </Link>
                </td>
                <td className="py-1.5 pr-3 text-muted">
                  {row.start} <span className="font-mono text-xs">({displayVersion(row.firstRelease)})</span>
                </td>
                <td className="py-1.5 pr-3 text-muted">
                  {row.end ?? <span className="text-emerald-400">current</span>}
                </td>
                <td className="py-1.5 font-mono text-xs">
                  {row.versions.map(displayVersion).join(" → ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </WidgetFrame>
  );
}

async function DownloadsWidget({ config, ctx }: { config: DownloadsConfig; ctx: WidgetContext }) {
  const releases = await ctx.store.listReleases({ project: config.project, ...ctx.readOptions });
  const rows = releases
    .flatMap((r) =>
      r.downloads.map((d) => ({
        version: r.version,
        date: r.date,
        ...d,
      }))
    )
    .slice(0, config.limit);

  return (
    <WidgetFrame title={config.title}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No downloads yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {rows.map((d, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-2">
              <a href={d.url} className="text-accent underline underline-offset-4">
                {d.label}
              </a>
              <span className="font-mono text-xs text-muted">
                {displayVersion(d.version)} · {d.date}
              </span>
              {d.checksumSha256 && (
                <span className="font-mono text-xs text-muted">
                  sha256:{d.checksumSha256.slice(0, 12)}…
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
}

async function ReleasesWidget({
  config,
  subject,
  ctx,
}: {
  config: ReleasesConfig;
  subject?: unknown;
  ctx: WidgetContext;
}) {
  // Product mode: an explicit product, or (on a default view) the subject —
  // "the releases of this product", identical to the product page's section.
  const product =
    config.product ?? (config.project ? undefined : (subject as { slug?: string } | undefined)?.slug);
  if (product) {
    return <ProductReleases product={{ slug: product }} title={config.title ?? "Releases"} ctx={ctx} />;
  }
  const releases = (await ctx.store.listReleases({ project: config.project, ...ctx.readOptions })).slice(
    0,
    config.limit
  );
  return (
    <WidgetFrame title={config.title}>
      <ul className="space-y-2 text-sm">
        {releases.map((r) => (
          <li key={`${r.project}-${r.version}`} className="flex flex-wrap items-baseline gap-2">
            <Link href="/releases" className="font-mono text-accent hover:underline">
              {r.project} v{r.version}
            </Link>
            <span className="text-muted">
              {r.date} · {r.channel}
            </span>
          </li>
        ))}
      </ul>
    </WidgetFrame>
  );
}

/**
 * Subject-widgets: render the item this (default-view) page is about, via the
 * same shared sections the hand-coded product page uses — parity by
 * construction. Without a subject they show a gentle hint (studio: pick
 * "Preview as …").
 */
function NoSubjectHint({ what }: { what: string }) {
  return (
    <p className="text-sm text-muted">
      {what}: geen subject op deze pagina — gebruik dit op een default view
      (kies &ldquo;Preview as …&rdquo; in de studio).
    </p>
  );
}

async function SubjectHeaderWidget({
  config,
  subject,
}: {
  config: SubjectHeaderConfig;
  subject?: unknown;
}) {
  const product = subject as Product | undefined;
  if (!product?.name) return <NoSubjectHint what="Subject header" />;
  return (
    <ProductHeader
      product={product}
      title={config.title}
      showStatus={config.showStatus}
      showTagline={config.showTagline}
      showDescription={config.showDescription}
    />
  );
}

async function SpecTableWidget({
  config,
  subject,
}: {
  config: SpecTableConfig;
  subject?: unknown;
}) {
  const product = subject as Product | undefined;
  if (!product?.name) return <NoSubjectHint what="Specs table" />;
  return <ProductSpecs product={product} title={config.title} />;
}

async function ComponentsWidget({
  config,
  subject,
  ctx,
}: {
  config: ComponentsConfig;
  subject?: unknown;
  ctx: WidgetContext;
}) {
  const product = subject as Product | undefined;
  if (!product?.name) return <NoSubjectHint what="Product components" />;
  return (
    <ProductComponents
      product={product}
      title={config.title}
      showBoards={config.showBoards}
      ctx={ctx}
    />
  );
}

async function ProductsWidget({ config, ctx }: { config: ProductsConfig; ctx: WidgetContext }) {
  const products = await ctx.store.listProducts(ctx.readOptions);
  return (
    <WidgetFrame title={config.title}>
      <div className="grid gap-4 sm:grid-cols-2">
        {products.map((p) => (
          <Link
            key={p.slug}
            href={`/products/${p.slug}`}
            className="rounded-lg border border-line p-4 hover:border-accent"
          >
            {p.audience && (
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                {p.audience}
              </span>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{p.name}</span>
              <StatusBadge status={p.status} />
            </div>
            <p className="mt-1 text-sm text-muted">{p.tagline}</p>
          </Link>
        ))}
      </div>
    </WidgetFrame>
  );
}

/**
 * WidgetType name → viewer, for every widget in ./registry.ts. The
 * `as WidgetViewer` casts are safe: the store has validated each config
 * against the matching schema before a viewer ever sees it.
 */
export const widgetComponents: WidgetViewers = {
  text: standardViewers.text,
  table: standardViewers.table,
  image: standardViewers.image,
  gallery: standardViewers.gallery,
  carousel: standardViewers.carousel,
  album: standardViewers.album,
  map: standardViewers.map,
  kanban: standardViewers.kanban,
  ...planningViewers,
  itinerary: ItineraryWidget as WidgetViewer,
  hero: standardViewers.hero,
  video: standardViewers.video,
  accordion: standardViewers.accordion,
  divider: standardViewers.divider,
  specs: standardViewers.specs,
  downloads: DownloadsWidget as WidgetViewer,
  posts: standardViewers.posts,
  board: BoardWidget as WidgetViewer,
  boardspec: BoardSpecWidget as WidgetViewer,
  template: standardViewers.template,
  list: standardViewers.list,
  callout: standardViewers.callout,
  embed: standardViewers.embed,
  treeview: standardViewers.treeview,
  api: standardViewers.api,
  releases: ReleasesWidget as WidgetViewer,
  products: ProductsWidget as WidgetViewer,
  subjectheader: SubjectHeaderWidget as WidgetViewer,
  spectable: SpecTableWidget as WidgetViewer,
  components: ComponentsWidget as WidgetViewer,
};
