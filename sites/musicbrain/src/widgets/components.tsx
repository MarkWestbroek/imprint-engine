import Link from "next/link";
import {
  computeItinerary,
  PlanningSchema,
  PlanningItemSchema,
  type ContentType,
  type Product,
} from "@imprint/content-core";
import {
  Markdown,
  WidgetFrame,
  type WidgetContext,
  type WidgetViewer,
  type WidgetViewers,
} from "@imprint/runtime-admin";
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
import { bucketInto, groupIntoColumns } from "@/lib/planning";
import { BoardCanvas } from "./board-canvas";
import type {
  BoardConfig,
  BoardSpecConfig,
  ComponentsConfig,
  DownloadsConfig,
  ItineraryConfig,
  PlanningConfig,
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

/** Unified card model, so board mode and generic mode render identically. */
type ViewCard = {
  key: string;
  title: string;
  body?: string;
  owner?: string;
  component?: string;
  componentVersion?: string;
};
type ViewColumn = { key: string; label: string; cards: ViewCard[] };

function PlanningCard({ card }: { card: ViewCard }) {
  return (
    <div className="rounded-md border border-line bg-background p-2 text-sm">
      <div className="font-medium leading-snug">{card.title}</div>
      {card.body && (
        <div className="markdown mt-1 text-[13px] text-muted [&_p]:my-0.5">
          <Markdown>{card.body}</Markdown>
        </div>
      )}
      {(card.component || card.owner) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {card.component && (
            <Link
              href={`/components/${card.component}`}
              className="rounded-full border border-line px-1.5 py-0.5 text-accent hover:border-accent"
            >
              {card.component}
              {card.componentVersion ? ` ${displayVersion(card.componentVersion)}` : ""}
            </Link>
          )}
          {card.owner && <span className="ml-auto">@{card.owner}</span>}
        </div>
      )}
    </div>
  );
}

function Board({ title, columns }: { title?: string; columns: ViewColumn[] }) {
  return (
    <WidgetFrame title={title}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((col) => (
          <div key={col.key} className="w-64 shrink-0 rounded-lg border border-line bg-surface/60 p-2">
            <h3 className="mb-2 flex items-baseline justify-between px-1 text-sm font-semibold">
              {col.label}
              <span className="text-xs font-normal text-muted">{col.cards.length}</span>
            </h3>
            <div className="space-y-2">
              {col.cards.map((card) => (
                <PlanningCard key={card.key} card={card} />
              ))}
              {col.cards.length === 0 && <p className="px-1 py-2 text-xs text-muted">—</p>}
            </div>
          </div>
        ))}
      </div>
    </WidgetFrame>
  );
}

async function PlanningWidget({ config, ctx }: { config: PlanningConfig; ctx: WidgetContext }) {
  const { writableStore } = ctx;
  if (!writableStore) {
    return (
      <WidgetFrame title={config.title}>
        <p className="text-sm text-muted">Planning boards need the database (set DATABASE_URL).</p>
      </WidgetFrame>
    );
  }

  // Generic mode: a read-only board over any content type, grouped by a
  // configurable field (Mark's "view op data"). Moving items happens via
  // their own admin/API.
  if (config.itemType) {
    if (config.phases.length === 0) {
      return (
        <WidgetFrame title={config.title}>
          <p className="text-sm text-muted">Configure at least one phase for this view.</p>
        </WidgetFrame>
      );
    }
    const recs = (await writableStore.listItems(config.itemType as ContentType)).map(
      (r) => r.data as Record<string, unknown>
    );
    const str = (v: unknown) => (v == null ? "" : String(v));
    const filtered = config.filterField
      ? recs.filter((r) => str(r[config.filterField!]) === (config.filterValue ?? ""))
      : recs;
    const columns = bucketInto(config.phases, filtered, (r) => str(r[config.phaseField])).map(
      (col) => ({
        key: col.key,
        label: col.label,
        cards: col.records.map((r, i): ViewCard => ({
          key: str(r.slug) || `${col.key}-${i}`,
          title: str(r[config.titleField]) || str(r.slug),
          owner: config.ownerField ? str(r[config.ownerField]) || undefined : undefined,
          component: config.componentField ? str(r[config.componentField]) || undefined : undefined,
        })),
      })
    );
    return <Board title={config.title} columns={columns} />;
  }

  // Board mode: a planning + its planning-items (the default). listItems
  // returns current assertions; the phase history lives in the item versions.
  const rec = config.planning ? await writableStore.getItem("planning", config.planning) : null;
  if (!rec) {
    return (
      <WidgetFrame title={config.title}>
        <p className="text-sm text-muted">
          {config.planning ? `Planning "${config.planning}" not found.` : "No planning selected."}
        </p>
      </WidgetFrame>
    );
  }
  const planning = PlanningSchema.parse(rec.data);
  const items = (await writableStore.listItems("planning-item")).map((r) =>
    PlanningItemSchema.parse(r.data)
  );
  const columns: ViewColumn[] = groupIntoColumns(planning, items).map((col) => ({
    key: col.key,
    label: col.label,
    cards: col.cards.map(
      (it): ViewCard => ({
        key: it.slug,
        title: it.title,
        body: it.body || undefined,
        owner: it.owner || undefined,
        component: it.component,
        componentVersion: it.componentVersion,
      })
    ),
  }));
  return <Board title={config.title ?? planning.name} columns={columns} />;
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
  planning: PlanningWidget as WidgetViewer,
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
