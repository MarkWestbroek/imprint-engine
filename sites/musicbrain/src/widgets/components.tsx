import Link from "next/link";
import Mustache from "mustache";
import { computeItinerary, type ContentType, type Page } from "@imprint/content-core";
import { store, writableStore } from "@/lib/content";
import { Markdown } from "@/components/markdown";
import { StatusBadge } from "@/components/status-badge";
import { displayVersion } from "@/lib/format";
import { BoardCanvas } from "./board-canvas";
import { BoardSpecView } from "@/components/board-spec-view";
import { Carousel, Gallery } from "./media-islands";
import { MapIsland } from "./map-island";
import type {
  AlbumConfig,
  ApiConfig,
  BoardConfig,
  BoardSpecConfig,
  CalloutConfig,
  CarouselConfig,
  EmbedConfig,
  GalleryConfig,
  ImageConfig,
  ImageItem,
  ItineraryConfig,
  KanbanConfig,
  ProductsConfig,
  ReleasesConfig,
  ListConfig,
  MapConfig,
  TableConfig,
  TemplateConfig,
  TextConfig,
  TreeNode,
  TreeviewConfig,
} from "./registry";

// Merge fields go into markdown, so don't HTML-escape; react-markdown is safe.
Mustache.escape = (text) => text;

/**
 * One React component per widget type (async server components, so widgets
 * may talk to the ContentStore or fetch external data). The config each
 * component receives has already been validated against the schema in
 * ./registry.ts by the store.
 */

type WidgetComponent = (props: {
  config: unknown;
  /** The content item a default-view page is about (for template/list widgets). */
  subject?: unknown;
}) => Promise<React.ReactNode>;

function WidgetFrame({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      {title && (
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

async function TextWidget({ config }: { config: TextConfig }) {
  return (
    <WidgetFrame title={config.title}>
      <Markdown>{config.markdown}</Markdown>
    </WidgetFrame>
  );
}

async function TableWidget({ config }: { config: TableConfig }) {
  return (
    <WidgetFrame title={config.title}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          {config.headers.length > 0 && (
            <thead>
              <tr className="border-b border-line text-left">
                {config.headers.map((h, i) => (
                  <th key={i} className="py-2 pr-4 font-medium text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {config.rows.map((row, r) => (
              <tr
                key={r}
                className={`border-b border-line ${
                  config.striped && r % 2 === 1 ? "bg-background/50" : ""
                }`}
              >
                {row.map((cell, c) => (
                  <td key={c} className="py-2 pr-4 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WidgetFrame>
  );
}

async function ImageWidget({ config }: { config: ImageConfig }) {
  return (
    <WidgetFrame>
      <figure>
        {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary external/public src, no loader config */}
        <img
          src={config.src}
          alt={config.alt}
          style={config.maxWidth ? { maxWidth: config.maxWidth } : undefined}
          className="h-auto max-w-full rounded-lg"
        />
        {config.caption && (
          <figcaption className="mt-2 text-sm text-muted">{config.caption}</figcaption>
        )}
      </figure>
    </WidgetFrame>
  );
}

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
}: {
  config: BoardSpecConfig;
  subject?: unknown;
}) {
  const slug = resolveSpecSlug(config, subject);
  const spec = slug ? await store.getBoardSpec(slug) : null;
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

async function TemplateWidget({
  config,
  subject,
}: {
  config: TemplateConfig;
  subject?: unknown;
}) {
  // Data source: an explicit content item, or the page's own subject.
  let data: unknown = subject ?? {};
  if (config.type && config.slug && writableStore) {
    const item = await writableStore.getItem(config.type as ContentType, config.slug);
    if (item) data = item.data;
  }
  let text: string;
  try {
    text = Mustache.render(config.template, data);
  } catch (err) {
    text = `_Template error: ${err instanceof Error ? err.message : String(err)}_`;
  }
  return (
    <WidgetFrame title={config.title}>
      <Markdown>{text}</Markdown>
    </WidgetFrame>
  );
}

function itemLabel(data: unknown, field?: string): string {
  const d = (data ?? {}) as Record<string, unknown>;
  if (field && d[field] != null) return String(d[field]);
  return String(d.name ?? d.title ?? d.slug ?? "?");
}

async function ListWidget({ config, subject }: { config: ListConfig; subject?: unknown }) {
  const links: { href: string; label: string }[] = [];
  const fill = (slug: string) => config.linkPattern.replace(/\{slug\}/g, slug);
  const subj = subject as Record<string, unknown> | undefined;

  if (config.mode === "refs") {
    const arr = config.field && Array.isArray(subj?.[config.field])
      ? (subj![config.field] as unknown[])
      : [];
    for (const el of arr) {
      const slug =
        config.itemKey && el && typeof el === "object"
          ? String((el as Record<string, unknown>)[config.itemKey] ?? "")
          : String(el ?? "");
      if (!slug) continue;
      let label = slug;
      if (config.itemType && writableStore) {
        const item = await writableStore.getItem(config.itemType, slug);
        if (item) label = itemLabel(item.data, config.labelField);
      }
      links.push({ href: fill(slug), label });
    }
  } else if (config.type && writableStore) {
    let records = await writableStore.listItems(config.type);
    if (config.matchField) {
      const value = config.matchValue ?? (subj?.slug as string | undefined);
      records = records.filter(
        (r) => (r.data as Record<string, unknown>)?.[config.matchField!] === value
      );
    }
    if (config.limit) records = records.slice(0, config.limit);
    for (const r of records) {
      links.push({ href: fill(r.slug), label: itemLabel(r.data, config.labelField) });
    }
  }

  return (
    <WidgetFrame title={config.title}>
      {links.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {links.map((l, i) => (
            <li key={i}>
              <Link href={l.href} className="text-accent hover:underline">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{config.emptyText ?? "Nothing here yet."}</p>
      )}
    </WidgetFrame>
  );
}

/** Config images + (optionally) the subject's media[] strings, as one list. */
function collectImages(
  config: { images: ImageItem[]; useSubjectMedia: boolean },
  subject?: unknown
): ImageItem[] {
  const images = [...config.images];
  const media = (subject as { media?: unknown } | undefined)?.media;
  if (config.useSubjectMedia && Array.isArray(media)) {
    for (const m of media) {
      if (typeof m === "string" && m) images.push({ src: m, alt: "" });
    }
  }
  return images;
}

async function GalleryWidget({
  config,
  subject,
}: {
  config: GalleryConfig;
  subject?: unknown;
}) {
  const images = collectImages(config, subject);
  return (
    <WidgetFrame title={config.title}>
      {images.length > 0 ? (
        <Gallery images={images} columns={config.columns} />
      ) : (
        <p className="text-sm text-muted">No photos yet.</p>
      )}
    </WidgetFrame>
  );
}

async function CarouselWidget({
  config,
  subject,
}: {
  config: CarouselConfig;
  subject?: unknown;
}) {
  const images = collectImages(config, subject);
  return (
    <WidgetFrame title={config.title}>
      {images.length > 0 ? (
        <Carousel images={images} interval={config.interval} />
      ) : (
        <p className="text-sm text-muted">No photos yet.</p>
      )}
    </WidgetFrame>
  );
}

const LR_API_KEY = "LightroomMobileWeb1";

/** Adobe's JSON endpoints prefix responses with an anti-hijack `while (1) {}`. */
function stripLrPrefix(text: string): string {
  return text.replace(/^while \(1\) \{\}\s*/, "");
}

/**
 * Photos from a public Lightroom share, via the same public API the share
 * page itself uses: share-URL → space id → resources → album → assets, and
 * per asset the 1280-rendition (fallback 2048/640). Renditions are publicly
 * hotlinkable with the web api_key. Verified against a real share (Mark's
 * "@2020 Street"); if Adobe ever changes this, the caller degrades to a
 * link card.
 */
async function loadLightroomImages(shareUrl: string, limit: number): Promise<ImageItem[]> {
  const opts = { next: { revalidate: 600 } } as const;
  // Follow the (adobe.ly) redirect; the final URL carries the space id.
  const page = await fetch(shareUrl, opts);
  if (!page.ok) throw new Error(`HTTP ${page.status}`);
  const spaceId = new URL(page.url).pathname.match(/shares\/([a-f0-9]+)/)?.[1];
  if (!spaceId) return [];

  const base = `https://photos.adobe.io/v2/spaces/${spaceId}/`;
  const getJson = async (path: string) => {
    const res = await fetch(`${base}${path}${path.includes("?") ? "&" : "?"}api_key=${LR_API_KEY}`, opts);
    if (!res.ok) throw new Error(`Lightroom API HTTP ${res.status}`);
    return JSON.parse(stripLrPrefix(await res.text())) as {
      resources?: {
        type?: string;
        links?: Record<string, { href?: string }>;
        asset?: { links?: Record<string, { href?: string }> };
      }[];
    };
  };

  const albums = (await getJson("resources")).resources ?? [];
  const assetsHref = albums.find((r) => r.type === "album")?.links?.[
    "/rels/space_album_images_videos"
  ]?.href;
  if (!assetsHref) return [];

  const assets = (await getJson(assetsHref)).resources ?? [];
  return assets
    .map((r) => {
      const links = r.asset?.links ?? {};
      const rendition =
        links["/rels/rendition_type/1280"] ??
        links["/rels/rendition_type/2048"] ??
        links["/rels/rendition_type/640"];
      return rendition?.href
        ? { src: `${base}${rendition.href}?api_key=${LR_API_KEY}`, alt: "" }
        : null;
    })
    .filter((img): img is ImageItem => img !== null)
    .slice(0, limit);
}

/** Best-effort image extraction from an external album (see AlbumConfig). */
async function loadAlbumImages(config: AlbumConfig): Promise<ImageItem[]> {
  if (config.source === "lightroom-share") {
    return loadLightroomImages(config.url, config.limit);
  }

  const res = await fetch(config.url, { next: { revalidate: 600 } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json: unknown = await res.json();
  const data = config.itemsPath ? getPath(json, config.itemsPath) : json;
  const items = Array.isArray(data) ? data : [];
  return items
    .map((item) => ({
      src: String(getPath(item, config.srcPath) ?? ""),
      alt: "",
      caption: config.captionPath
        ? String(getPath(item, config.captionPath) ?? "") || undefined
        : undefined,
    }))
    .filter((img) => img.src.startsWith("http") || img.src.startsWith("/"))
    .slice(0, config.limit);
}

async function AlbumWidget({ config }: { config: AlbumConfig }) {
  let images: ImageItem[] = [];
  let error: string | undefined;
  try {
    images = await loadAlbumImages(config);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  const host = new URL(config.url).hostname;

  return (
    <WidgetFrame title={config.title}>
      {images.length > 0 ? (
        <Gallery images={images} columns={config.columns} />
      ) : (
        <p className="text-sm text-muted">
          {error ? `Could not load ${host}: ${error}` : `No previewable photos on ${host}.`}
        </p>
      )}
      <a
        href={config.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block text-sm text-accent underline underline-offset-4"
      >
        Open album on {host} ↗
      </a>
    </WidgetFrame>
  );
}

async function MapWidget({ config }: { config: MapConfig }) {
  return (
    <WidgetFrame title={config.title}>
      <MapIsland
        center={config.center}
        zoom={config.zoom}
        height={config.height}
        markers={config.markers}
      />
    </WidgetFrame>
  );
}

const CARD_TONES: Record<string, string> = {
  default: "border-line bg-background",
  accent: "border-accent/50 bg-accent/10",
  warning: "border-amber-400/50 bg-amber-400/10",
  success: "border-emerald-400/50 bg-emerald-400/10",
};

async function KanbanWidget({ config }: { config: KanbanConfig }) {
  return (
    <WidgetFrame title={config.title}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {config.columns.map((col, c) => (
          <div key={c} className="w-56 shrink-0 rounded-lg border border-line bg-surface/60 p-2">
            <h3 className="mb-2 flex items-baseline justify-between px-1 text-sm font-semibold">
              {col.title}
              <span className="text-xs font-normal text-muted">{col.cards.length}</span>
            </h3>
            <div className="space-y-2">
              {col.cards.map((card, i) => (
                <div key={i} className={`rounded-md border p-2 text-sm ${CARD_TONES[card.tone]}`}>
                  <Markdown>{card.text}</Markdown>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </WidgetFrame>
  );
}

async function ItineraryWidget({
  config,
  subject,
}: {
  config: ItineraryConfig;
  subject?: unknown;
}) {
  const product =
    config.product ?? (subject as { slug?: string } | undefined)?.slug;
  const releases = product ? await store.listReleases({ product }) : [];
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

const CALLOUT_TONES: Record<CalloutConfig["tone"], string> = {
  accent: "border-accent/40 bg-accent/10",
  warning: "border-amber-400/40 bg-amber-400/10",
  info: "border-sky-400/40 bg-sky-400/10",
  muted: "border-line bg-surface",
};

async function CalloutWidget({ config }: { config: CalloutConfig }) {
  return (
    <section className={`rounded-xl border p-5 ${CALLOUT_TONES[config.tone]}`}>
      {config.title && (
        <h2 className="mb-2 text-lg font-semibold tracking-tight">{config.title}</h2>
      )}
      <Markdown>{config.markdown}</Markdown>
      {config.buttonLabel && config.buttonUrl && (
        <a
          href={config.buttonUrl}
          className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-semibold text-background hover:bg-accent-strong"
        >
          {config.buttonLabel}
        </a>
      )}
    </section>
  );
}

async function EmbedWidget({ config }: { config: EmbedConfig }) {
  return (
    <WidgetFrame title={config.title}>
      <iframe
        src={config.url}
        height={config.height}
        className="w-full rounded-lg border border-line"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        loading="lazy"
        title={config.title ?? "Embedded content"}
      />
    </WidgetFrame>
  );
}

/** Nest pages into a tree by their slug segments (e.g. posts/hello-world). */
function pagesToTree(pages: Page[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const page of pages) {
    let level = root;
    const segments = page.slug.split("/");
    segments.forEach((segment, i) => {
      const leaf = i === segments.length - 1;
      let node = level.find((n) => n.label === (leaf ? page.title : segment));
      if (!node) {
        node = leaf
          ? { label: page.title, href: `/${page.slug}` }
          : { label: segment, children: [] };
        level.push(node);
      }
      if (!leaf) level = node.children ?? (node.children = []);
    });
  }
  return root;
}

function Tree({ nodes }: { nodes: TreeNode[] }) {
  return (
    <ul className="space-y-1 text-sm">
      {nodes.map((node) => (
        <li key={`${node.label}-${node.href ?? ""}`}>
          {node.href ? (
            <Link href={node.href} className="text-foreground hover:text-accent">
              {node.label}
            </Link>
          ) : (
            <span className="font-medium text-muted">{node.label}</span>
          )}
          {node.children && node.children.length > 0 && (
            <div className="mt-1 border-l border-line pl-3">
              <Tree nodes={node.children} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

async function TreeviewWidget({ config }: { config: TreeviewConfig }) {
  let nodes = config.items;
  if (config.pagesPrefix !== undefined) {
    const pages = await store.listPages({ prefix: config.pagesPrefix });
    nodes = [...nodes, ...pagesToTree(pages)];
  }
  return (
    <WidgetFrame title={config.title}>
      <Tree nodes={nodes} />
    </WidgetFrame>
  );
}

/** Walk a dot-path ("data.items.0.name") into a JSON value. */
function getPath(value: unknown, dotPath: string): unknown {
  return dotPath
    .split(".")
    .filter(Boolean)
    .reduce<unknown>(
      (v, key) =>
        typeof v === "object" && v !== null
          ? (v as Record<string, unknown>)[key]
          : undefined,
      value
    );
}

async function ApiWidget({ config }: { config: ApiConfig }) {
  let items: unknown[];
  try {
    // Cache for a few minutes: keeps studio previews snappy and spares the API.
    const res = await fetch(config.url, {
      headers: config.headers,
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: unknown = await res.json();
    const data = config.itemsPath ? getPath(json, config.itemsPath) : json;
    items = (Array.isArray(data) ? data : [data]).slice(0, config.limit);
  } catch (err) {
    // An unreachable API must not take the whole build down — show a notice.
    return (
      <WidgetFrame title={config.title}>
        <p className="text-sm text-muted">
          Could not load {new URL(config.url).hostname}:{" "}
          {err instanceof Error ? err.message : "unknown error"}
        </p>
      </WidgetFrame>
    );
  }

  return (
    <WidgetFrame title={config.title}>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="rounded-lg border border-line p-3 text-sm">
            {config.fields.length > 0 ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                {config.fields.map((f) => (
                  <div key={f.path} className="contents">
                    <dt className="text-muted">{f.label}</dt>
                    <dd>{String(getPath(item, f.path) ?? "—")}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <pre className="overflow-x-auto font-mono text-xs">
                {JSON.stringify(item, null, 2)}
              </pre>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">
        Source: {new URL(config.url).hostname}
      </p>
    </WidgetFrame>
  );
}

async function ReleasesWidget({ config }: { config: ReleasesConfig }) {
  const releases = (await store.listReleases({ project: config.project })).slice(
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

async function ProductsWidget({ config }: { config: ProductsConfig }) {
  const products = await store.listProducts();
  return (
    <WidgetFrame title={config.title}>
      <div className="grid gap-4 sm:grid-cols-2">
        {products.map((p) => (
          <Link
            key={p.slug}
            href={`/products/${p.slug}`}
            className="rounded-lg border border-line p-4 hover:border-accent"
          >
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
 * WidgetType name → component. The `as WidgetComponent` casts are safe:
 * the store has validated each config against the matching schema before a
 * component ever sees it.
 */
export const widgetComponents: Record<string, WidgetComponent> = {
  text: TextWidget as WidgetComponent,
  table: TableWidget as WidgetComponent,
  image: ImageWidget as WidgetComponent,
  gallery: GalleryWidget as WidgetComponent,
  carousel: CarouselWidget as WidgetComponent,
  album: AlbumWidget as WidgetComponent,
  map: MapWidget as WidgetComponent,
  kanban: KanbanWidget as WidgetComponent,
  itinerary: ItineraryWidget as WidgetComponent,
  board: BoardWidget as WidgetComponent,
  boardspec: BoardSpecWidget as WidgetComponent,
  template: TemplateWidget as WidgetComponent,
  list: ListWidget as WidgetComponent,
  callout: CalloutWidget as WidgetComponent,
  embed: EmbedWidget as WidgetComponent,
  treeview: TreeviewWidget as WidgetComponent,
  api: ApiWidget as WidgetComponent,
  releases: ReleasesWidget as WidgetComponent,
  products: ProductsWidget as WidgetComponent,
};
