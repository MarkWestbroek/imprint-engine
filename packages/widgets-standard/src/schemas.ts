import { z } from "zod";

/**
 * The standard widgets' config schemas (library layer, architecture.md §0):
 * generic building blocks that know no domain contract. Schemas-only — no
 * React, no store — so a site's ContentStore can validate with them. The
 * viewers pair up by name in ./viewers.tsx.
 *
 * A site picks widgets one by one from `standardWidgets` when it composes its
 * catalogue; there is no all-or-nothing bundle.
 */

export const TextConfig = z.object({
  title: z.string().optional(),
  /** Markdown body. */
  markdown: z.string(),
});
export type TextConfig = z.infer<typeof TextConfig>;

export type TreeNode = {
  label: string;
  href?: string;
  children?: TreeNode[];
};
const TreeNodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
  z.object({
    label: z.string().min(1),
    href: z.string().optional(),
    children: z.array(TreeNodeSchema).optional(),
  })
);

export const TreeviewConfig = z.object({
  title: z.string().optional(),
  /** Hand-written tree nodes. */
  items: z.array(TreeNodeSchema).default([]),
  /**
   * Also build a tree from content pages whose slug starts with this prefix
   * ("" = all pages), nested by slug segments.
   */
  pagesPrefix: z.string().optional(),
});
export type TreeviewConfig = z.infer<typeof TreeviewConfig>;

export const ApiConfig = z.object({
  title: z.string().optional(),
  /** JSON endpoint, fetched at render time (= build time in static v0). */
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).default({}),
  /** Dot-path to the array of items in the response, e.g. "artists" or "data.items". */
  itemsPath: z.string().optional(),
  /** Which fields of each item to show; path is a dot-path into the item. */
  fields: z.array(z.object({ label: z.string(), path: z.string() })).default([]),
  limit: z.number().int().positive().default(10),
});
export type ApiConfig = z.infer<typeof ApiConfig>;

export const TableConfig = z.object({
  title: z.string().optional(),
  headers: z.array(z.string()).default([]),
  /** Row-major cells; each row is an array aligned with `headers`. */
  rows: z.array(z.array(z.string())).default([]),
  striped: z.boolean().default(true),
});
export type TableConfig = z.infer<typeof TableConfig>;

export const ImageConfig = z.object({
  /** URL or a path under the site's public/ dir. */
  src: z.string().min(1),
  alt: z.string().default(""),
  caption: z.string().optional(),
  /** Cap the rendered width in pixels; empty = full column width. */
  maxWidth: z.number().int().positive().optional(),
});
export type ImageConfig = z.infer<typeof ImageConfig>;

export const CalloutConfig = z.object({
  title: z.string().optional(),
  markdown: z.string().default(""),
  tone: z.enum(["accent", "warning", "info", "muted"]).default("accent"),
  /** Optional call-to-action button. */
  buttonLabel: z.string().optional(),
  buttonUrl: z.string().optional(),
});
export type CalloutConfig = z.infer<typeof CalloutConfig>;

export const EmbedConfig = z.object({
  title: z.string().optional(),
  /** External page to embed in a sandboxed iframe. */
  url: z.string().url(),
  height: z.number().int().positive().default(400),
});
export type EmbedConfig = z.infer<typeof EmbedConfig>;

/** One image in a gallery/carousel/album. */
export const ImageItem = z.object({
  /** URL or a path under public/ or /api/assets. */
  src: z.string().min(1),
  alt: z.string().default(""),
  caption: z.string().optional(),
});
export type ImageItem = z.infer<typeof ImageItem>;

export const GalleryConfig = z.object({
  title: z.string().optional(),
  images: z.array(ImageItem).default([]),
  /** Grid columns on wide screens. */
  columns: z.number().int().min(2).max(6).default(3),
  /** Also include the subject's media[] (e.g. product photos, W3). */
  useSubjectMedia: z.boolean().default(false),
});
export type GalleryConfig = z.infer<typeof GalleryConfig>;

export const CarouselConfig = z.object({
  title: z.string().optional(),
  images: z.array(ImageItem).default([]),
  /** Auto-advance in seconds; 0 = manual only. */
  interval: z.number().int().min(0).max(60).default(0),
  useSubjectMedia: z.boolean().default(false),
});
export type CarouselConfig = z.infer<typeof CarouselConfig>;

/**
 * A view on an *external* photo collection. "json-api" reads any repo that
 * exposes JSON (dot-paths like the api widget); "lightroom-share" is a
 * best-effort scrape of a public share page (e.g. Lightroom mobile album) —
 * it always degrades gracefully to a link card with the cover image.
 */
export const AlbumConfig = z.object({
  title: z.string().optional(),
  source: z.enum(["json-api", "lightroom-share"]).default("lightroom-share"),
  /** Share URL (lightroom-share) or JSON endpoint (json-api). */
  url: z.string().url(),
  /** json-api: dot-path to the item array, and per-item paths. */
  itemsPath: z.string().optional(),
  srcPath: z.string().default("src"),
  captionPath: z.string().optional(),
  limit: z.number().int().positive().default(12),
  columns: z.number().int().min(2).max(6).default(3),
});
export type AlbumConfig = z.infer<typeof AlbumConfig>;

export const MapConfig = z.object({
  title: z.string().optional(),
  /** Fallback centre when there are no markers. */
  center: z.object({ lat: z.number(), lng: z.number() }).optional(),
  zoom: z.number().int().min(1).max(19).default(13),
  height: z.number().int().min(120).max(1200).default(400),
  markers: z
    .array(
      z.object({
        lat: z.number(),
        lng: z.number(),
        label: z.string().optional(),
        /** Popup content (markdown). */
        markdown: z.string().optional(),
      })
    )
    .default([]),
});
export type MapConfig = z.infer<typeof MapConfig>;

export const KanbanConfig = z.object({
  title: z.string().optional(),
  columns: z
    .array(
      z.object({
        title: z.string().min(1),
        cards: z
          .array(
            z.object({
              /** Card content (markdown). */
              text: z.string(),
              tone: z.enum(["default", "accent", "warning", "success"]).default("default"),
            })
          )
          .default([]),
      })
    )
    .default([]),
});
export type KanbanConfig = z.infer<typeof KanbanConfig>;

export const HeroConfig = z.object({
  /** Wrap one word in *asterisks* to give it the accent colour. */
  title: z.string().min(1),
  subtitle: z.string().default(""),
  /** Background/side image (URL or public/ path). */
  image: z.string().optional(),
  buttonLabel: z.string().optional(),
  buttonUrl: z.string().optional(),
  align: z.enum(["left", "center"]).default("left"),
  /** "panel" = card on a surface; "open" = straight on the page background. */
  variant: z.enum(["panel", "open"]).default("panel"),
});
export type HeroConfig = z.infer<typeof HeroConfig>;

export const VideoConfig = z.object({
  title: z.string().optional(),
  /** YouTube/Vimeo page URL, or a direct video file URL. */
  url: z.string().url(),
  caption: z.string().optional(),
});
export type VideoConfig = z.infer<typeof VideoConfig>;

export const AccordionConfig = z.object({
  title: z.string().optional(),
  items: z
    .array(z.object({ title: z.string().min(1), markdown: z.string().default("") }))
    .default([]),
});
export type AccordionConfig = z.infer<typeof AccordionConfig>;

export const DividerConfig = z.object({
  /** "scope" draws a gate/CV step-trace (oscilloscope look) in accent-2. */
  style: z.enum(["line", "dots", "scope", "space"]).default("line"),
  /** Vertical breathing room, 1 (subtle) … 4 (roomy). */
  size: z.number().int().min(1).max(4).default(2),
});
export type DividerConfig = z.infer<typeof DividerConfig>;

/**
 * Specs strip: a row of key figures in mono — big value, small caption —
 * like the spec bar in the "open brain" design (≤ 5 ms · note-on → CV).
 */
export const SpecsConfig = z.object({
  title: z.string().optional(),
  items: z
    .array(
      z.object({
        /** The big figure, e.g. "≤ 5 ms" or "16-bit". */
        value: z.string().min(1),
        /** Small caption underneath, e.g. "note-on → CV". */
        label: z.string().default(""),
      })
    )
    .default([]),
});
export type SpecsConfig = z.infer<typeof SpecsConfig>;

export const PostsConfig = z.object({
  title: z.string().optional(),
  /** Page-slug prefix that marks a post. */
  prefix: z.string().default("posts/"),
  limit: z.number().int().positive().default(5),
});
export type PostsConfig = z.infer<typeof PostsConfig>;

/** Content types a template widget can read from. */
export const TemplateSourceType = z.enum([
  "site",
  "product",
  "component",
  "board-spec",
  "release",
  "page",
  "menu",
]);

export const TemplateConfig = z.object({
  title: z.string().optional(),
  /** Which content item to merge in. Omit to use the page's own subject. */
  type: TemplateSourceType.optional(),
  slug: z.string().optional(),
  /**
   * Markdown with Mustache merge fields: {{field}}, {{nested.field}}, and
   * {{#array}}…{{/array}} to repeat over a list (merge fields / mail merge).
   */
  template: z.string(),
});
export type TemplateConfig = z.infer<typeof TemplateConfig>;

/**
 * List widget: renders links that follow the content graph. Two modes —
 *  - "query": items of a content type, optionally filtered by matchField ==
 *    matchValue (matchValue falls back to the page subject's slug); e.g. the
 *    releases of this product.
 *  - "refs": follow a slug array on the subject (e.g. release.components[]);
 *    each element is a slug, or an object with `itemKey` holding the slug.
 * `linkPattern` builds the href ({slug} is replaced).
 */
export const ListConfig = z.object({
  title: z.string().optional(),
  mode: z.enum(["query", "refs"]).default("query"),
  // query mode
  type: TemplateSourceType.optional(),
  matchField: z.string().optional(),
  matchValue: z.string().optional(),
  limit: z.number().int().positive().optional(),
  // refs mode
  field: z.string().optional(),
  itemKey: z.string().optional(),
  itemType: TemplateSourceType.optional(),
  // both
  linkPattern: z.string().default("/{slug}"),
  labelField: z.string().optional(),
  emptyText: z.string().optional(),
});
export type ListConfig = z.infer<typeof ListConfig>;

/* ---------- the 2026-09 batch (design/plank-widgets-en-plugins.md §2) ---------- */

export const QuoteConfig = z.object({
  text: z.string().min(1),
  source: z.string().optional(),
  sourceUrl: z.string().optional(),
  /** block = quiet, in a box; pull = large, for a highlight mid-page. */
  variant: z.enum(["block", "pull"]).default("block"),
});
export type QuoteConfig = z.infer<typeof QuoteConfig>;

/** Grammars bundled by the code widget (code-highlight.ts); "text" = no highlighting. */
export const CODE_LANGUAGES = [
  "text", "typescript", "tsx", "javascript", "json", "bash", "css", "html", "sql",
  "python", "go", "rust", "c", "yaml", "markdown", "diff", "mermaid",
] as const;
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];

export const CodeConfig = z.object({
  title: z.string().optional(),
  language: z.enum(CODE_LANGUAGES).default("text"),
  code: z.string(),
  /** Shown above the block, like an editor tab. */
  filename: z.string().optional(),
  wrap: z.boolean().default(false),
});
export type CodeConfig = z.infer<typeof CodeConfig>;

export const MermaidConfig = z.object({
  title: z.string().optional(),
  /** Mermaid source: flowchart, sequence, class, er, gantt, … */
  code: z.string(),
  theme: z.enum(["default", "dark", "neutral", "forest"]).default("default"),
  caption: z.string().optional(),
});
export type MermaidConfig = z.infer<typeof MermaidConfig>;

export const V3ModelConfig = z.object({
  title: z.string().optional(),
  /** A V3 model document, pasted. Wins over `url`. */
  json: z.string().optional(),
  /** Or fetched from here (absolute URL, e.g. https://site/api/meta?format=v3). */
  url: z.string().optional(),
  showFields: z.boolean().default(true),
  /** Cap the drawing's width in pixels; it scales down on narrow screens. */
  maxWidth: z.number().int().positive().optional(),
  caption: z.string().optional(),
});
export type V3ModelConfig = z.infer<typeof V3ModelConfig>;

export const TabsConfig = z.object({
  title: z.string().optional(),
  tabs: z.array(z.object({ label: z.string().min(1), markdown: z.string().default("") })).default([]),
});
export type TabsConfig = z.infer<typeof TabsConfig>;

export const CardsConfig = z.object({
  title: z.string().optional(),
  columns: z.number().int().min(1).max(4).default(3),
  items: z
    .array(
      z.object({
        /** An emoji or short glyph shown above the title. */
        icon: z.string().optional(),
        title: z.string().min(1),
        markdown: z.string().default(""),
        href: z.string().optional(),
      })
    )
    .default([]),
});
export type CardsConfig = z.infer<typeof CardsConfig>;

export const ButtonsConfig = z.object({
  items: z
    .array(
      z.object({
        label: z.string().min(1),
        href: z.string().min(1),
        style: z.enum(["primary", "secondary", "ghost"]).default("primary"),
        newTab: z.boolean().default(false),
      })
    )
    .default([]),
  align: z.enum(["left", "center", "right"]).default("left"),
});
export type ButtonsConfig = z.infer<typeof ButtonsConfig>;

export const LogosConfig = z.object({
  title: z.string().optional(),
  items: z.array(z.object({ src: z.string().min(1), alt: z.string().default(""), href: z.string().optional() })).default([]),
  columns: z.number().int().min(2).max(8).default(5),
  /** Grey until hovered. */
  grayscale: z.boolean().default(true),
});
export type LogosConfig = z.infer<typeof LogosConfig>;

export const TocConfig = z.object({
  title: z.string().default("On this page"),
  /** Deepest heading level to list. */
  depth: z.enum(["2", "3"]).default("3"),
});
export type TocConfig = z.infer<typeof TocConfig>;

export const BreadcrumbConfig = z.object({
  homeLabel: z.string().default("Home"),
  showCurrent: z.boolean().default(true),
});
export type BreadcrumbConfig = z.infer<typeof BreadcrumbConfig>;

export const AudioConfig = z.object({
  src: z.string().min(1),
  title: z.string().optional(),
  caption: z.string().optional(),
  loop: z.boolean().default(false),
});
export type AudioConfig = z.infer<typeof AudioConfig>;

export const PdfConfig = z.object({
  src: z.string().min(1),
  title: z.string().optional(),
  height: z.number().int().positive().default(600),
});
export type PdfConfig = z.infer<typeof PdfConfig>;

export const FileConfig = z.object({
  src: z.string().min(1),
  label: z.string().min(1),
  /** Free text, e.g. "PDF · 1.2 MB". */
  meta: z.string().optional(),
  note: z.string().optional(),
});
export type FileConfig = z.infer<typeof FileConfig>;

export const TimelineConfig = z.object({
  title: z.string().optional(),
  items: z
    .array(
      z.object({
        date: z.string().default(""),
        title: z.string().min(1),
        markdown: z.string().default(""),
        tone: z.enum(["accent", "muted", "info", "warning"]).default("accent"),
      })
    )
    .default([]),
});
export type TimelineConfig = z.infer<typeof TimelineConfig>;

export const MediaTextConfig = z.object({
  title: z.string().optional(),
  src: z.string().min(1),
  alt: z.string().default(""),
  markdown: z.string().default(""),
  imageSide: z.enum(["left", "right"]).default("left"),
  imageWidth: z.enum(["third", "half"]).default("half"),
  buttonLabel: z.string().optional(),
  buttonUrl: z.string().optional(),
});
export type MediaTextConfig = z.infer<typeof MediaTextConfig>;

export const PeopleConfig = z.object({
  title: z.string().optional(),
  columns: z.number().int().min(1).max(4).default(3),
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        role: z.string().optional(),
        photo: z.string().optional(),
        bio: z.string().optional(),
        links: z.array(z.object({ label: z.string().min(1), href: z.string().min(1) })).default([]),
      })
    )
    .default([]),
});
export type PeopleConfig = z.infer<typeof PeopleConfig>;

export const TestimonialConfig = z.object({
  title: z.string().optional(),
  items: z
    .array(
      z.object({
        quote: z.string().min(1),
        name: z.string().min(1),
        role: z.string().optional(),
        photo: z.string().optional(),
      })
    )
    .default([]),
});
export type TestimonialConfig = z.infer<typeof TestimonialConfig>;

export const PricingConfig = z.object({
  title: z.string().optional(),
  plans: z
    .array(
      z.object({
        name: z.string().min(1),
        price: z.string().min(1),
        /** e.g. "/ month"; empty for one-off. */
        period: z.string().optional(),
        description: z.string().optional(),
        features: z.array(z.string()).default([]),
        buttonLabel: z.string().optional(),
        buttonUrl: z.string().optional(),
        highlighted: z.boolean().default(false),
      })
    )
    .default([]),
});
export type PricingConfig = z.infer<typeof PricingConfig>;

/**
 * The standard widgets, each with its own `version` (a widget is a component
 * of Imprint) and `help` (a one-line manual shown in the studio sidebar).
 */
export const standardWidgets = {
  text: { name: "text", label: "Text (markdown)", version: "1.0.0", help: "Rich text via markdown, with a visual editor.", configSchema: TextConfig },
  table: { name: "table", label: "Table", version: "1.0.0", help: "A data table; edit cells, add rows/columns.", configSchema: TableConfig },
  image: { name: "image", label: "Image", version: "1.0.0", help: "A single image with optional caption.", configSchema: ImageConfig },
  gallery: { name: "gallery", label: "Photo gallery", version: "1.0.0", help: "A grid of photos with a lightbox; can include the subject's media.", configSchema: GalleryConfig },
  carousel: { name: "carousel", label: "Photo carousel", version: "1.0.0", help: "One photo at a time with prev/next and optional auto-advance.", configSchema: CarouselConfig },
  album: { name: "album", label: "External album", version: "1.0.0", help: "A view on an online photo repo (JSON API, or a Lightroom share as link card).", configSchema: AlbumConfig },
  map: { name: "map", label: "Map", version: "1.0.0", help: "An interactive OpenStreetMap with markers and popups.", configSchema: MapConfig },
  kanban: { name: "kanban", label: "Kanban board", version: "1.0.0", help: "A small board: columns with static cards.", configSchema: KanbanConfig },
  hero: { name: "hero", label: "Hero", version: "1.1.0", help: "Big heading + subtitle, optional image and CTA button. *Word* in the title gets the accent colour; variant \"open\" drops the panel.", configSchema: HeroConfig },
  specs: { name: "specs", label: "Specs strip", version: "1.0.0", help: "A row of key figures in mono: big value + small caption.", configSchema: SpecsConfig },
  video: { name: "video", label: "Video", version: "1.0.0", help: "YouTube/Vimeo (privacy embed) or a direct video file.", configSchema: VideoConfig },
  accordion: { name: "accordion", label: "Accordion / FAQ", version: "1.0.0", help: "Collapsible question/answer blocks (no JS needed).", configSchema: AccordionConfig },
  divider: { name: "divider", label: "Divider", version: "1.1.0", help: "Visual rest between rows: line, dots, a scope-trace or just space.", configSchema: DividerConfig },
  posts: { name: "posts", label: "Posts / news feed", version: "1.0.0", help: "Latest devlog posts as linked cards (W6).", configSchema: PostsConfig },
  template: { name: "template", label: "Template (merge fields)", version: "1.0.0", help: "Markdown with {{fields}} merged from a content item.", configSchema: TemplateConfig },
  list: { name: "list", label: "List (links)", version: "1.0.0", help: "A list of links following the content graph (e.g. a product's releases).", configSchema: ListConfig },
  callout: { name: "callout", label: "Callout / CTA", version: "1.0.0", help: "A coloured box with markdown and an optional button.", configSchema: CalloutConfig },
  embed: { name: "embed", label: "Embed (iframe)", version: "1.0.0", help: "Embed an external page in a sandboxed iframe.", configSchema: EmbedConfig },
  treeview: { name: "treeview", label: "Treeview", version: "1.0.0", help: "A nested link tree; can auto-build from page slugs.", configSchema: TreeviewConfig },
  api: { name: "api", label: "API content", version: "1.0.0", help: "Fetch a JSON endpoint and show selected fields.", configSchema: ApiConfig },
  quote: { name: "quote", label: "Quote", version: "1.0.0", help: "A quotation with its source; \"pull\" makes it big.", configSchema: QuoteConfig },
  code: { name: "code", label: "Code", version: "1.0.0", help: "A code block with syntax highlighting (light/dark follow the site).", configSchema: CodeConfig },
  mermaid: { name: "mermaid", label: "Mermaid diagram", version: "1.0.0", help: "A diagram from mermaid text (flowchart, sequence, class, gantt, …), drawn in the browser.", configSchema: MermaidConfig },
  v3model: { name: "v3model", label: "V3 model diagram", version: "1.0.0", help: "A V3 metamodel as a diagram: entities in their domain colour, on their position or in a grid, with relations.", configSchema: V3ModelConfig },
  tabs: { name: "tabs", label: "Tabs", version: "1.0.0", help: "Tabbed panels of markdown; the first is open by default.", configSchema: TabsConfig },
  cards: { name: "cards", label: "Cards / features", version: "1.0.0", help: "A grid of cards: icon, title, text, optional link.", configSchema: CardsConfig },
  buttons: { name: "buttons", label: "Buttons", version: "1.0.0", help: "A row of buttons (primary, secondary or ghost).", configSchema: ButtonsConfig },
  logos: { name: "logos", label: "Logo cloud", version: "1.0.0", help: "A row of logos, grey until hovered, each optionally linked.", configSchema: LogosConfig },
  toc: { name: "toc", label: "Table of contents", version: "1.0.0", help: "Links to the headings on this page, whichever widget they come from.", configSchema: TocConfig },
  breadcrumb: { name: "breadcrumb", label: "Breadcrumb", version: "1.0.0", help: "Home › section › page, from the page's slug; parents that exist as pages get their title.", configSchema: BreadcrumbConfig },
  audio: { name: "audio", label: "Audio", version: "1.0.0", help: "An audio player for a file (mp3, ogg, wav, …).", configSchema: AudioConfig },
  pdf: { name: "pdf", label: "PDF", version: "1.0.0", help: "A PDF shown inline, with a download link.", configSchema: PdfConfig },
  file: { name: "file", label: "File download", version: "1.0.0", help: "One download link with a label and a note.", configSchema: FileConfig },
  timeline: { name: "timeline", label: "Timeline", version: "1.0.0", help: "Dated steps on a vertical line.", configSchema: TimelineConfig },
  mediatext: { name: "mediatext", label: "Media & text", version: "1.0.0", help: "An image beside text, as one block.", configSchema: MediaTextConfig },
  people: { name: "people", label: "People / team", version: "1.0.0", help: "Cards with photo, name, role, bio and links.", configSchema: PeopleConfig },
  testimonial: { name: "testimonial", label: "Testimonials", version: "1.0.0", help: "Quotes with the name and role of who said them.", configSchema: TestimonialConfig },
  pricing: { name: "pricing", label: "Pricing", version: "1.0.0", help: "Plans side by side with features and a button; one can be highlighted.", configSchema: PricingConfig },
} as const;
