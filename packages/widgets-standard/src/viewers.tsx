import Link from "next/link";
import Mustache from "mustache";
import type { ContentType, Page } from "@imprint/content-core";
import { Markdown, WidgetFrame, type WidgetContext, type WidgetViewer } from "@imprint/runtime-admin";
import { Carousel, Gallery } from "./media-islands";
import { MapIsland } from "./map-island";
import { Tabs } from "./tabs-island";
import { MermaidDiagram } from "./mermaid-island";
import { TocList } from "./toc-island";
import { highlightCode } from "./code-highlight";
import { V3Diagram, type V3Model } from "./v3-diagram";
import type {
  AccordionConfig,
  AlbumConfig,
  ApiConfig,
  AudioConfig,
  BreadcrumbConfig,
  ButtonsConfig,
  CardsConfig,
  CodeConfig,
  FileConfig,
  LogosConfig,
  MediaTextConfig,
  MermaidConfig,
  PdfConfig,
  PeopleConfig,
  PricingConfig,
  QuoteConfig,
  TabsConfig,
  TestimonialConfig,
  TimelineConfig,
  TocConfig,
  V3ModelConfig,
  CalloutConfig,
  CarouselConfig,
  DividerConfig,
  EmbedConfig,
  GalleryConfig,
  HeroConfig,
  ImageConfig,
  ImageItem,
  KanbanConfig,
  ListConfig,
  MapConfig,
  PostsConfig,
  SpecsConfig,
  TableConfig,
  TemplateConfig,
  TextConfig,
  TreeNode,
  TreeviewConfig,
  VideoConfig,
} from "./schemas";

/**
 * The standard widget viewers (library layer, architecture.md §0). Async
 * server components: they read content only through the WidgetContext `ctx`
 * they receive, or fetch external data (album, api). Configs have already
 * been validated against ./schemas.ts by the store.
 */

// Merge fields go into markdown, so don't HTML-escape; react-markdown is safe.
Mustache.escape = (text) => text;

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

async function TemplateWidget({
  config,
  subject,
  ctx,
}: {
  config: TemplateConfig;
  subject?: unknown;
  ctx: WidgetContext;
}) {
  const { writableStore } = ctx;
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

async function ListWidget({
  config,
  subject,
  ctx,
}: {
  config: ListConfig;
  subject?: unknown;
  ctx: WidgetContext;
}) {
  const { writableStore } = ctx;
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
  // Subject-driven and empty = the section simply isn't there (parity with
  // the hand-coded page); the hint only helps for hand-filled galleries.
  if (images.length === 0 && config.useSubjectMedia) return null;
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

/** `*word*` in a hero title → that word in the accent colour. */
function accentTitle(title: string): React.ReactNode {
  const parts = title.split("*");
  if (parts.length < 3) return title;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <em key={i} className="not-italic text-accent">
        {part}
      </em>
    ) : (
      part
    )
  );
}

async function HeroWidget({ config }: { config: HeroConfig }) {
  const center = config.align === "center";
  const panel = config.variant === "panel";
  return (
    <section
      className={`relative overflow-hidden ${
        panel ? "rounded-xl border border-line bg-surface p-8 sm:p-12" : "py-6 sm:py-10"
      } ${center ? "text-center" : ""}`}
    >
      {config.image && (
        // eslint-disable-next-line @next/next/no-img-element -- content image
        <img
          src={config.image}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-25"
        />
      )}
      <div className="relative">
        <h2 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tighter sm:text-5xl">
          {accentTitle(config.title)}
        </h2>
        {config.subtitle && (
          <p className={`mt-4 max-w-2xl text-lg text-muted ${center ? "mx-auto" : ""}`}>
            {config.subtitle}
          </p>
        )}
        {config.buttonLabel && config.buttonUrl && (
          <a
            href={config.buttonUrl}
            className="mt-6 inline-block rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-background hover:bg-accent-strong"
          >
            {config.buttonLabel}
          </a>
        )}
      </div>
    </section>
  );
}

/** YouTube/Vimeo page URL → privacy-friendly embed URL; else null (file). */
function videoEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?dnt=1`;
  return null;
}

async function VideoWidget({ config }: { config: VideoConfig }) {
  const embed = videoEmbedUrl(config.url);
  return (
    <WidgetFrame title={config.title}>
      <figure>
        {embed ? (
          <iframe
            src={embed}
            className="aspect-video w-full rounded-lg border border-line"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={config.title ?? "Video"}
          />
        ) : (
          <video src={config.url} controls className="aspect-video w-full rounded-lg border border-line bg-black" />
        )}
        {config.caption && (
          <figcaption className="mt-2 text-sm text-muted">{config.caption}</figcaption>
        )}
      </figure>
    </WidgetFrame>
  );
}

async function AccordionWidget({ config }: { config: AccordionConfig }) {
  return (
    <WidgetFrame title={config.title}>
      <div className="space-y-2">
        {config.items.map((item, i) => (
          <details key={i} className="rounded-lg border border-line px-4 py-3">
            <summary className="cursor-pointer font-medium hover:text-accent">
              {item.title}
            </summary>
            <div className="mt-2 text-sm">
              <Markdown>{item.markdown}</Markdown>
            </div>
          </details>
        ))}
      </div>
    </WidgetFrame>
  );
}

async function DividerWidget({ config }: { config: DividerConfig }) {
  const pad = { 1: "py-2", 2: "py-4", 3: "py-8", 4: "py-14" }[config.size] ?? "py-4";
  return (
    <div className={`flex items-center justify-center ${pad}`} aria-hidden>
      {config.style === "line" && <hr className="w-full border-line" />}
      {config.style === "dots" && (
        <span className="tracking-[1em] text-muted">•••</span>
      )}
      {config.style === "scope" && (
        // Gate/CV step-trace over a baseline, like an oscilloscope readout.
        <svg
          viewBox="0 0 780 46"
          preserveAspectRatio="none"
          className="h-10 w-full text-accent-2"
        >
          <line x1="0" y1="23" x2="780" y2="23" className="stroke-line" strokeWidth="1" />
          <path
            d="M0 36 H90 V10 H210 V36 H330 V10 H400 V36 H560 V18 H660 V36 H780"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            opacity="0.9"
          />
        </svg>
      )}
    </div>
  );
}

async function SpecsWidget({ config }: { config: SpecsConfig }) {
  return (
    <section>
      {config.title && <h2 className="eyebrow mb-3">{config.title}</h2>}
      {/* Columns follow the width of the box the widget sits in, not the page:
          as many as fit at ~7rem each, so a narrow cell stacks instead of overlapping. */}
      <div
        className="grid gap-4 border border-line bg-surface px-6 py-5 font-mono"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(7rem, 1fr))" }}
      >
        {config.items.map((item, i) => (
          <div key={i} className="min-w-0">
            <span className="block text-lg font-semibold tabular-nums">{item.value}</span>
            {item.label && (
              <span className="mt-0.5 block break-words text-[11px] uppercase tracking-wider text-muted">
                {item.label}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

async function PostsWidget({ config, ctx }: { config: PostsConfig; ctx: WidgetContext }) {
  const posts = (
    await ctx.store.listPages({ prefix: config.prefix, ...ctx.readOptions })
  ).slice(0, config.limit);
  return (
    <WidgetFrame title={config.title}>
      {posts.length === 0 ? (
        <p className="text-sm text-muted">No posts yet.</p>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <Link
              key={p.slug}
              href={`/${p.slug}`}
              className="block rounded-lg border border-line p-3 hover:border-accent"
            >
              <span className="font-semibold">{p.title}</span>
              {p.publishedAt && (
                <span className="ml-2 text-xs text-muted">{p.publishedAt}</span>
              )}
              {p.description && (
                <p className="mt-1 text-sm text-muted">{p.description}</p>
              )}
            </Link>
          ))}
        </div>
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

async function TreeviewWidget({ config, ctx }: { config: TreeviewConfig; ctx: WidgetContext }) {
  let nodes = config.items;
  if (config.pagesPrefix !== undefined) {
    const pages = await ctx.store.listPages({ prefix: config.pagesPrefix, ...ctx.readOptions });
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

/* ---------- the 2026-09 batch (design/plank-widgets-en-plugins.md §2) ---------- */

/** Grid columns that cap at `columns` and stack when the box gets narrow. */
const gridCols = (columns: number, min = "12rem") => ({
  gridTemplateColumns: `repeat(auto-fit, minmax(max(${min}, calc(${(100 / columns).toFixed(2)}% - 1rem)), 1fr))`,
});

/* eslint-disable @next/next/no-img-element -- arbitrary content/asset URLs */

async function QuoteWidget({ config }: { config: QuoteConfig }) {
  const source = config.source && (
    <footer className="mt-3 text-sm text-muted">
      —{" "}
      {config.sourceUrl ? (
        <a href={config.sourceUrl} className="hover:text-accent" rel="noreferrer">
          {config.source}
        </a>
      ) : (
        config.source
      )}
    </footer>
  );
  if (config.variant === "pull") {
    return (
      <blockquote className="my-2 border-l-4 border-accent py-2 pl-6">
        <p className="font-serif text-2xl leading-snug tracking-tight text-foreground sm:text-3xl">{config.text}</p>
        {source}
      </blockquote>
    );
  }
  return (
    <blockquote className="rounded-xl border border-line bg-surface px-6 py-5">
      <p className="text-lg leading-relaxed text-foreground">“{config.text}”</p>
      {source}
    </blockquote>
  );
}

async function CodeWidget({ config }: { config: CodeConfig }) {
  const html = await highlightCode(config.code, config.language);
  return (
    <WidgetFrame title={config.title}>
      <div className="overflow-hidden rounded-lg border border-line text-sm">
        {config.filename && (
          <div className="border-b border-line bg-surface px-3 py-1.5 font-mono text-xs text-muted">{config.filename}</div>
        )}
        <div
          className={`overflow-x-auto [&_pre]:p-4 [&_pre]:leading-relaxed ${config.wrap ? "[&_pre]:whitespace-pre-wrap" : ""}`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </WidgetFrame>
  );
}

async function MermaidWidget({ config }: { config: MermaidConfig }) {
  return (
    <WidgetFrame title={config.title}>
      <figure>
        <MermaidDiagram code={config.code} theme={config.theme} />
        {config.caption && <figcaption className="mt-2 text-center text-sm text-muted">{config.caption}</figcaption>}
      </figure>
    </WidgetFrame>
  );
}

async function loadV3Model(config: V3ModelConfig): Promise<V3Model | string> {
  try {
    if (config.json?.trim()) return JSON.parse(config.json) as V3Model;
    if (config.url) {
      const res = await fetch(config.url, { next: { revalidate: 600 } });
      if (!res.ok) return `Model not available (${res.status})`;
      return (await res.json()) as V3Model;
    }
    return "Paste a V3 model or give a URL.";
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

async function V3ModelWidget({ config }: { config: V3ModelConfig }) {
  const model = await loadV3Model(config);
  return (
    <WidgetFrame title={config.title}>
      {typeof model === "string" ? (
        <p className="text-sm text-muted">{model}</p>
      ) : (
        <figure className="overflow-x-auto">
          <V3Diagram model={model} showFields={config.showFields} maxWidth={config.maxWidth} />
          {config.caption && <figcaption className="mt-2 text-center text-sm text-muted">{config.caption}</figcaption>}
        </figure>
      )}
    </WidgetFrame>
  );
}

async function TabsWidget({ config }: { config: TabsConfig }) {
  if (config.tabs.length === 0) return null;
  return (
    <WidgetFrame title={config.title}>
      <Tabs labels={config.tabs.map((t) => t.label)}>
        {config.tabs.map((t, i) => (
          <Markdown key={i}>{t.markdown}</Markdown>
        ))}
      </Tabs>
    </WidgetFrame>
  );
}

async function CardsWidget({ config }: { config: CardsConfig }) {
  return (
    <WidgetFrame title={config.title}>
      <div className="grid gap-4" style={gridCols(config.columns)}>
        {config.items.map((item, i) => {
          const body = (
            <>
              {item.icon && <div className="mb-2 text-2xl leading-none">{item.icon}</div>}
              <h3 className="font-semibold">{item.title}</h3>
              {item.markdown && (
                <div className="mt-1 text-sm text-muted">
                  <Markdown>{item.markdown}</Markdown>
                </div>
              )}
            </>
          );
          const cls = "block rounded-xl border border-line bg-surface p-5";
          return item.href ? (
            <Link key={i} href={item.href} className={`${cls} hover:border-accent`}>
              {body}
            </Link>
          ) : (
            <div key={i} className={cls}>
              {body}
            </div>
          );
        })}
      </div>
    </WidgetFrame>
  );
}

const BUTTON_STYLES: Record<ButtonsConfig["items"][number]["style"], string> = {
  primary: "bg-accent text-background hover:bg-accent-strong",
  secondary: "border border-line text-foreground hover:border-accent",
  ghost: "text-accent underline-offset-4 hover:underline",
};
const ALIGN: Record<ButtonsConfig["align"], string> = { left: "justify-start", center: "justify-center", right: "justify-end" };

async function ButtonsWidget({ config }: { config: ButtonsConfig }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${ALIGN[config.align]}`}>
      {config.items.map((b, i) => (
        <a
          key={i}
          href={b.href}
          target={b.newTab ? "_blank" : undefined}
          rel={b.newTab ? "noreferrer" : undefined}
          className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold ${BUTTON_STYLES[b.style]}`}
        >
          {b.label}
        </a>
      ))}
    </div>
  );
}

async function LogosWidget({ config }: { config: LogosConfig }) {
  return (
    <WidgetFrame title={config.title}>
      <div className="grid items-center gap-6" style={gridCols(config.columns, "6rem")}>
        {config.items.map((logo, i) => {
          const img = (
            <img
              src={logo.src}
              alt={logo.alt}
              loading="lazy"
              className={`mx-auto max-h-12 w-auto ${config.grayscale ? "opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0" : ""}`}
            />
          );
          return logo.href ? (
            <a key={i} href={logo.href} rel="noreferrer" title={logo.alt}>
              {img}
            </a>
          ) : (
            <div key={i}>{img}</div>
          );
        })}
      </div>
    </WidgetFrame>
  );
}

async function TocWidget({ config }: { config: TocConfig }) {
  return (
    <nav data-toc aria-label={config.title} className="rounded-xl border border-line bg-surface px-5 py-4">
      {config.title && <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{config.title}</p>}
      <TocList depth={Number(config.depth)} />
    </nav>
  );
}

const humanise = (segment: string) => segment.replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

async function BreadcrumbWidget({ config, ctx }: { config: BreadcrumbConfig; ctx: WidgetContext }) {
  if (!ctx.page) return null;
  const segments = ctx.page.slug.split("/").filter(Boolean);
  const parents = await Promise.all(
    segments.slice(0, -1).map(async (seg, i) => {
      const slug = segments.slice(0, i + 1).join("/");
      const page = await ctx.store.getPage(slug, ctx.readOptions);
      return { href: `/${slug}`, label: page?.title || humanise(seg) };
    })
  );
  const sep = <span className="text-muted/60">›</span>;
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-muted">
      <Link href="/" className="hover:text-accent">
        {config.homeLabel}
      </Link>
      {parents.map((p) => (
        <span key={p.href} className="flex items-center gap-2">
          {sep}
          <Link href={p.href} className="hover:text-accent">
            {p.label}
          </Link>
        </span>
      ))}
      {config.showCurrent && segments.length > 0 && (
        <span className="flex items-center gap-2">
          {sep}
          <span aria-current="page" className="text-foreground">
            {ctx.page.title || humanise(segments[segments.length - 1])}
          </span>
        </span>
      )}
    </nav>
  );
}

async function AudioWidget({ config }: { config: AudioConfig }) {
  return (
    <figure className="rounded-xl border border-line bg-surface px-5 py-4">
      {config.title && <p className="mb-2 font-semibold">{config.title}</p>}
      <audio controls preload="metadata" loop={config.loop} src={config.src} className="w-full">
        <a href={config.src}>{config.title ?? "Download audio"}</a>
      </audio>
      {config.caption && <figcaption className="mt-2 text-sm text-muted">{config.caption}</figcaption>}
    </figure>
  );
}

async function PdfWidget({ config }: { config: PdfConfig }) {
  return (
    <WidgetFrame title={config.title}>
      <object data={config.src} type="application/pdf" className="w-full rounded-lg border border-line" style={{ height: config.height }}>
        <p className="p-4 text-sm text-muted">
          Your browser cannot show the PDF here.{" "}
          <a href={config.src} className="text-accent underline">
            Download it
          </a>
          .
        </p>
      </object>
      <p className="mt-2 text-right text-xs">
        <a href={config.src} download className="text-muted hover:text-accent">
          Download PDF ↓
        </a>
      </p>
    </WidgetFrame>
  );
}

async function FileWidget({ config }: { config: FileConfig }) {
  return (
    <a
      href={config.src}
      download
      className="flex items-center gap-4 rounded-xl border border-line bg-surface px-5 py-4 hover:border-accent"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent/15 font-mono text-sm font-bold text-accent">
        ↓
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{config.label}</span>
        {(config.meta || config.note) && (
          <span className="block text-sm text-muted">{[config.meta, config.note].filter(Boolean).join(" · ")}</span>
        )}
      </span>
    </a>
  );
}

const TIMELINE_TONES: Record<TimelineConfig["items"][number]["tone"], string> = {
  accent: "bg-accent",
  muted: "bg-muted",
  info: "bg-sky-400",
  warning: "bg-amber-400",
};

async function TimelineWidget({ config }: { config: TimelineConfig }) {
  return (
    <WidgetFrame title={config.title}>
      <ol className="relative ml-2 border-l border-line pl-6">
        {config.items.map((item, i) => (
          <li key={i} className="relative pb-6 last:pb-0">
            <span className={`absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full ${TIMELINE_TONES[item.tone]}`} />
            {item.date && <time className="block font-mono text-xs uppercase tracking-wider text-muted">{item.date}</time>}
            <h3 className="font-semibold">{item.title}</h3>
            {item.markdown && (
              <div className="mt-1 text-sm text-muted">
                <Markdown>{item.markdown}</Markdown>
              </div>
            )}
          </li>
        ))}
      </ol>
    </WidgetFrame>
  );
}

async function MediaTextWidget({ config }: { config: MediaTextConfig }) {
  const image = (
    <img src={config.src} alt={config.alt} loading="lazy" className="h-auto w-full rounded-xl border border-line" />
  );
  const cols = config.imageWidth === "third" ? "1fr 2fr" : "1fr 1fr";
  return (
    <WidgetFrame title={config.title}>
      <div
        className="grid items-center gap-6 sm:[grid-template-columns:var(--mt-cols)]"
        style={{ ["--mt-cols" as string]: config.imageSide === "left" ? cols : cols.split(" ").reverse().join(" ") }}
      >
        {config.imageSide === "left" && image}
        <div>
          <Markdown>{config.markdown}</Markdown>
          {config.buttonLabel && config.buttonUrl && (
            <a
              href={config.buttonUrl}
              className="mt-3 inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background hover:bg-accent-strong"
            >
              {config.buttonLabel}
            </a>
          )}
        </div>
        {config.imageSide === "right" && image}
      </div>
    </WidgetFrame>
  );
}

async function PeopleWidget({ config }: { config: PeopleConfig }) {
  return (
    <WidgetFrame title={config.title}>
      <div className="grid gap-4" style={gridCols(config.columns)}>
        {config.items.map((p, i) => (
          <div key={i} className="rounded-xl border border-line bg-surface p-5">
            {p.photo && <img src={p.photo} alt={p.name} loading="lazy" className="mb-3 h-20 w-20 rounded-full border border-line object-cover" />}
            <h3 className="font-semibold">{p.name}</h3>
            {p.role && <p className="text-sm text-accent">{p.role}</p>}
            {p.bio && <p className="mt-2 text-sm text-muted">{p.bio}</p>}
            {p.links.length > 0 && (
              <p className="mt-3 flex flex-wrap gap-3 text-sm">
                {p.links.map((l, j) => (
                  <a key={j} href={l.href} rel="noreferrer" className="text-muted hover:text-accent">
                    {l.label} ↗
                  </a>
                ))}
              </p>
            )}
          </div>
        ))}
      </div>
    </WidgetFrame>
  );
}

async function TestimonialWidget({ config }: { config: TestimonialConfig }) {
  return (
    <WidgetFrame title={config.title}>
      <div className="grid gap-4" style={gridCols(Math.min(3, Math.max(1, config.items.length)), "16rem")}>
        {config.items.map((t, i) => (
          <figure key={i} className="flex flex-col rounded-xl border border-line bg-surface p-5">
            <blockquote className="flex-1 text-foreground">“{t.quote}”</blockquote>
            <figcaption className="mt-4 flex items-center gap-3 text-sm">
              {t.photo && <img src={t.photo} alt="" loading="lazy" className="h-9 w-9 rounded-full border border-line object-cover" />}
              <span>
                <span className="block font-semibold">{t.name}</span>
                {t.role && <span className="block text-muted">{t.role}</span>}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </WidgetFrame>
  );
}

async function PricingWidget({ config }: { config: PricingConfig }) {
  return (
    <WidgetFrame title={config.title}>
      <div className="grid items-stretch gap-4" style={gridCols(Math.min(4, Math.max(1, config.plans.length)), "14rem")}>
        {config.plans.map((plan, i) => (
          <div
            key={i}
            className={`flex flex-col rounded-xl border bg-surface p-5 ${plan.highlighted ? "border-accent ring-1 ring-accent" : "border-line"}`}
          >
            <h3 className="font-semibold">{plan.name}</h3>
            <p className="mt-2">
              <span className="text-3xl font-semibold tabular-nums">{plan.price}</span>
              {plan.period && <span className="ml-1 text-sm text-muted">{plan.period}</span>}
            </p>
            {plan.description && <p className="mt-2 text-sm text-muted">{plan.description}</p>}
            {plan.features.length > 0 && (
              <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex gap-2">
                    <span className="text-accent">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}
            {plan.buttonLabel && plan.buttonUrl && (
              <a
                href={plan.buttonUrl}
                className={`mt-5 inline-flex justify-center rounded-lg px-4 py-2 text-sm font-semibold ${
                  plan.highlighted ? BUTTON_STYLES.primary : BUTTON_STYLES.secondary
                }`}
              >
                {plan.buttonLabel}
              </a>
            )}
          </div>
        ))}
      </div>
    </WidgetFrame>
  );
}

/** Widget type name → viewer, for the standard widgets. A site picks from it. */
export const standardViewers = {
  text: TextWidget as WidgetViewer,
  table: TableWidget as WidgetViewer,
  image: ImageWidget as WidgetViewer,
  gallery: GalleryWidget as WidgetViewer,
  carousel: CarouselWidget as WidgetViewer,
  album: AlbumWidget as WidgetViewer,
  map: MapWidget as WidgetViewer,
  kanban: KanbanWidget as WidgetViewer,
  hero: HeroWidget as WidgetViewer,
  video: VideoWidget as WidgetViewer,
  accordion: AccordionWidget as WidgetViewer,
  divider: DividerWidget as WidgetViewer,
  specs: SpecsWidget as WidgetViewer,
  posts: PostsWidget as WidgetViewer,
  template: TemplateWidget as WidgetViewer,
  list: ListWidget as WidgetViewer,
  callout: CalloutWidget as WidgetViewer,
  embed: EmbedWidget as WidgetViewer,
  treeview: TreeviewWidget as WidgetViewer,
  api: ApiWidget as WidgetViewer,
  quote: QuoteWidget as WidgetViewer,
  code: CodeWidget as WidgetViewer,
  mermaid: MermaidWidget as WidgetViewer,
  v3model: V3ModelWidget as WidgetViewer,
  tabs: TabsWidget as WidgetViewer,
  cards: CardsWidget as WidgetViewer,
  buttons: ButtonsWidget as WidgetViewer,
  logos: LogosWidget as WidgetViewer,
  toc: TocWidget as WidgetViewer,
  breadcrumb: BreadcrumbWidget as WidgetViewer,
  audio: AudioWidget as WidgetViewer,
  pdf: PdfWidget as WidgetViewer,
  file: FileWidget as WidgetViewer,
  timeline: TimelineWidget as WidgetViewer,
  mediatext: MediaTextWidget as WidgetViewer,
  people: PeopleWidget as WidgetViewer,
  testimonial: TestimonialWidget as WidgetViewer,
  pricing: PricingWidget as WidgetViewer,
} satisfies Record<string, WidgetViewer>;
