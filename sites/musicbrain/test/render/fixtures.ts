import type { ContentType } from "@imprint/content-core";
import { createMemoryDb, MemoryContentStore } from "@imprint/content-core/memory-store";
import { ContentTypeRegistry, coreContentTypeDefinitions } from "@imprint/content-core";
import { planningContentTypes } from "@imprint/plugin-planning/content-types";
import { widgetRegistry } from "../../src/widgets/registry";
import type { CannedResponse } from "./harness";

/**
 * Fixture content and cases for the renderer characterisation. Small, but
 * rich enough that every widget renders its real data path (not just its
 * empty state), plus the empty and error paths that matter.
 *
 * Dates: the past is 2025/2026, the future 2099, so "now" always falls in
 * between and the goldens don't age.
 */

export type SubjectKey = "product:cortex" | "product:relay" | "component:adc8" | "release:cortex-fw-v0.2";

export type WidgetCase = { name: string; config: Record<string, unknown>; subject?: SubjectKey };

const COLORS = {
  background: "#0e1116",
  surface: "#151b23",
  border: "#232b36",
  foreground: "#f2f4f8",
  muted: "#8c96a5",
  accent: "#f5a623",
  accentStrong: "#b87f1f",
};

export async function buildStore(): Promise<MemoryContentStore> {
  // The site's own registry: layouts are validated on put, as in production.
  // The registry the site runs with: the core's types plus the planning plugin's (imprint.config.ts).
  const contentTypes = ContentTypeRegistry.of(coreContentTypeDefinitions, planningContentTypes);
  const store = new MemoryContentStore(createMemoryDb(), { widgets: widgetRegistry, contentTypes });
  const validFrom = new Date("2020-01-01T00:00:00Z");
  const put = (type: ContentType, slug: string, data: unknown) =>
    store.putItem(type, slug, data, { validFrom, by: "fixture" });

  await put("site", "site", {
    name: "MusicBrain",
    tagline: "The open brain for your analog rig",
    motto: "open hardware · est. NL",
    baseUrl: "https://musicbrain.test",
    links: { github: "https://github.com/musicbrain", discord: "https://discord.gg/musicbrain" },
  });

  await put("menu", "main", {
    name: "main",
    items: [
      { label: "Products", url: "/#products" },
      { label: "About", page: "about" },
      { label: "Devlog", page: "posts/hello-world" },
    ],
  });
  await put("theme", "amber", { name: "amber", label: "Amber", colors: COLORS, order: 0 });
  await put("theme", "light", { name: "light", label: "Light", colors: { ...COLORS, background: "#ffffff" }, order: 1 });

  await put("component", "adc8", {
    slug: "adc8",
    name: "ADC8",
    description: "Eight CV inputs.",
    versions: [
      { number: "v1.2", date: "2026-02-01", spec: "adc8@v1.2" },
      { number: "v1.3", date: "2026-05-01" },
    ],
    phase: "beta",
  });
  await put("component", "busboard", {
    slug: "busboard",
    name: "Busboard",
    description: "Power and I²C bus.",
    children: ["adc8"],
    versions: [{ number: "v2.0" }],
    phase: "produced",
  });
  await put("component", "dac8", { slug: "dac8", name: "DAC8", phase: "design" });

  await put("board-spec", "adc8@v1.2", {
    slug: "adc8@v1.2",
    component: "adc8",
    version: "v1.2",
    connectors: [
      { ref: "J1", label: "Bus", rows: 2, pins: [{ pin: "1", net: "+12V" }, { pin: "2", net: "GND" }] },
      { ref: "J2", label: "CV in", pins: [{ pin: "1", net: "CV1" }] },
    ],
    assets: {
      renderTop: "/api/assets/adc8/v1.2/top.png",
      overview: "/api/assets/adc8/v1.2/overview.svg",
      model3d: "/api/assets/adc8/v1.2/board.glb",
      pinouts: { J1: "/api/assets/adc8/v1.2/pinout-J1.svg" },
    },
    points: [
      { x: 0.25, y: 0.5, connector: "J1" },
      { x: 0.75, y: 0.4, label: "Trim", markdown: "Offset **trim**" },
    ],
    sections: [{ heading: "Calibration", markdown: "Turn the trimmer until the LED is steady." }],
    fab: { jlcNotes: "4-layer, ENIG", bomHighlights: ["MCP3208"] },
    related: ["busboard"],
  });

  await put("product", "cortex", {
    slug: "cortex",
    name: "Cortex",
    tagline: "The brain module",
    audience: "for modular synths",
    status: "beta",
    description: "Cortex **routes** CV between modules.",
    specs: [
      { label: "Width", value: "12 HP" },
      { label: "Power", value: "+12V 80 mA" },
    ],
    media: ["/boards/cortex-top.png", "/boards/cortex-bottom.png"],
    components: ["adc8", "busboard"],
    order: 1,
  });
  await put("product", "relay", {
    slug: "relay",
    name: "Relay",
    tagline: "Stompbox switcher",
    status: "in-development",
    order: 2,
  });

  const releases = [
    {
      project: "cortex-fw",
      version: "v0.2",
      date: "2026-01-15",
      channel: "beta",
      product: "cortex",
      components: [
        { component: "adc8", version: "v1.2" },
        { component: "busboard", version: "v2.0" },
      ],
      highlights: ["First beta"],
      downloads: [
        {
          label: "Firmware v0.2",
          url: "https://example.test/cortex-v0.2.uf2",
          checksumSha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        },
      ],
    },
    {
      project: "cortex-fw",
      version: "v0.3",
      date: "2026-04-01",
      channel: "stable",
      product: "cortex",
      components: [{ component: "adc8", version: "v1.3" }],
      downloads: [{ label: "Firmware v0.3", url: "https://example.test/cortex-v0.3.uf2" }],
    },
    { project: "simulator", version: "0.1.0", date: "2026-03-01", channel: "beta" },
    // Dated in the future: hidden from the dated release lists, but see the
    // product-mode releases golden — that path lists it anyway.
    { project: "cortex-fw", version: "v1.0", date: "2099-01-01", product: "cortex" },
  ];
  for (const r of releases) await put("release", `${r.project}-${r.version}`, r);

  const pages = [
    { slug: "about", title: "About", publishedAt: "2026-01-01", body: "About us." },
    { slug: "posts/hello-world", title: "Hello world", description: "First devlog post", publishedAt: "2026-02-01", body: "Hi." },
    { slug: "posts/second", title: "Second post", publishedAt: "2026-03-10", body: "More." },
    { slug: "posts/draft", title: "Draft post", draft: true, publishedAt: "2026-03-11", body: "Not yet." },
    { slug: "guides/intro", title: "Intro", publishedAt: "2026-01-03", body: "" },
    { slug: "guides/setup/power", title: "Power", publishedAt: "2026-01-02", body: "" },
    { slug: "guides/setup/midi", title: "MIDI", publishedAt: "2026-01-04", body: "" },
    {
      slug: "_view/product",
      title: "Product view",
      body: "",
      layout: {
        rows: [
          { cells: [{ span: 1, widgets: [{ type: "subjectheader", config: {} }] }] },
          {
            cells: [
              { span: 1, widgets: [{ type: "spectable", config: {} }] },
              { span: 2, widgets: [{ type: "components", config: { showBoards: false } }] },
            ],
          },
          { cells: [{ span: 1, widgets: [{ type: "releases", config: {} }] }] },
        ],
      },
    },
    {
      slug: "_view/component",
      title: "Component view",
      body: "",
      layout: {
        rows: [
          {
            cells: [
              {
                span: 1,
                widgets: [
                  { type: "template", config: { template: "**{{name}}** in versions {{#versions}}{{number}} {{/versions}}" } },
                ],
              },
            ],
          },
        ],
      },
    },
  ];
  for (const p of pages) await put("page", p.slug, p);

  await put("planning", "roadmap", {
    slug: "roadmap",
    name: "Roadmap",
    product: "cortex",
    phases: [
      { key: "backlog", label: "Backlog", order: 0 },
      { key: "onderhanden", label: "Onderhanden", order: 1 },
      { key: "live", label: "Live", order: 2 },
    ],
  });
  const cards = [
    { slug: "vcf8", title: "VCF8 module", planning: "roadmap", status: "backlog", owner: "mark", body: "8-channel **filter**", order: 0 },
    { slug: "adc8-rev", title: "ADC8 rev", planning: "roadmap", status: "onderhanden", component: "adc8", componentVersion: "v1.3", order: 0 },
    { slug: "stray", title: "Unknown phase", planning: "roadmap", status: "nonsense", order: 0 },
  ];
  for (const c of cards) await put("planning-item", c.slug, c);

  return store;
}

export async function resolveSubject(store: MemoryContentStore, key: SubjectKey): Promise<unknown> {
  const [type, slug] = key.split(":");
  if (type === "product") return store.getProduct(slug);
  if (type === "component") return store.getComponent(slug);
  return (await store.getItem("release", slug))?.data;
}

const LR_SPACE = "https://photos.adobe.io/v2/spaces/0123abcd/";
const json = (value: unknown) => JSON.stringify(value);

/** Every URL a widget may fetch in these cases. Anything else fails the suite. */
export const CANNED_RESPONSES: Record<string, CannedResponse> = {
  // Lightroom share: redirect → space id → resources → album assets.
  "https://adobe.ly/street": { body: "<html>share</html>", url: "https://lightroom.adobe.com/shares/0123abcd" },
  [`${LR_SPACE}resources?api_key=LightroomMobileWeb1`]: {
    body: `while (1) {}\n${json({
      resources: [
        { type: "catalog" },
        { type: "album", links: { "/rels/space_album_images_videos": { href: "albums/a1/assets?embed=asset" } } },
      ],
    })}`,
  },
  [`${LR_SPACE}albums/a1/assets?embed=asset&api_key=LightroomMobileWeb1`]: {
    body: `while (1) {}\n${json({
      resources: [
        { asset: { links: { "/rels/rendition_type/1280": { href: "assets/p1/renditions/1280" } } } },
        { asset: { links: { "/rels/rendition_type/640": { href: "assets/p2/renditions/640" } } } },
        { asset: { links: {} } },
      ],
    })}`,
  },
  "https://photos.example.test/album.json": {
    body: json({
      data: {
        photos: [
          { url: "https://photos.example.test/1.jpg", title: "One" },
          { url: "relative.jpg", title: "Skipped: not absolute" },
          { url: "/local/2.jpg" },
          { url: "https://photos.example.test/3.jpg", title: "Over the limit" },
        ],
      },
    }),
  },
  "https://down.example.test/album.json": { status: 503, body: "unavailable" },
  "https://api.example.test/artists?q=kraftwerk": {
    body: json({
      artists: [
        { name: "Kraftwerk", area: { name: "Germany" } },
        { name: "Kraftwerk Tribute" },
        { name: "Over the limit" },
      ],
    }),
  },
  "https://api.example.test/single": { body: json({ name: "Solo", tags: ["a", "b"] }) },
  "https://down.example.test/x": { status: 500, body: "boom" },
};

/** At least one case per registered widget type (enforced by the suite). */
export const WIDGET_CASES: Record<string, WidgetCase[]> = {
  text: [
    { name: "markdown-with-gfm", config: { title: "Intro", markdown: "Hello **world**\n\n- one\n- two\n\n| a | b |\n|---|---|\n| 1 | 2 |" } },
  ],
  table: [
    { name: "striped", config: { title: "Pins", headers: ["Pin", "Net"], rows: [["1", "+12V"], ["2", "GND"], ["3", "CV1"]] } },
    { name: "no-headers-unstriped", config: { rows: [["a", "b"]], striped: false } },
  ],
  image: [{ name: "caption-maxwidth", config: { src: "/boards/cortex.png", alt: "Cortex", caption: "Top view", maxWidth: 480 } }],
  gallery: [
    { name: "images", config: { title: "Workshop", images: [{ src: "/a.jpg", alt: "A", caption: "First" }, { src: "/b.jpg" }], columns: 2 } },
    { name: "subject-media", config: { useSubjectMedia: true }, subject: "product:cortex" },
    { name: "subject-media-empty", config: { useSubjectMedia: true }, subject: "product:relay" },
    { name: "empty", config: {} },
  ],
  carousel: [
    { name: "images", config: { images: [{ src: "/a.jpg", alt: "A" }, { src: "/b.jpg", alt: "B" }], interval: 5 } },
    { name: "empty", config: {} },
  ],
  album: [
    { name: "lightroom-share", config: { title: "Street", url: "https://adobe.ly/street" } },
    { name: "json-api", config: { source: "json-api", url: "https://photos.example.test/album.json", itemsPath: "data.photos", srcPath: "url", captionPath: "title", limit: 2, columns: 2 } },
    { name: "unreachable", config: { source: "json-api", url: "https://down.example.test/album.json" } },
  ],
  map: [
    { name: "markers", config: { title: "Studio", center: { lat: 52.09, lng: 5.12 }, zoom: 12, height: 300, markers: [{ lat: 52.09, lng: 5.12, label: "Studio", markdown: "**Here**" }] } },
  ],
  kanban: [
    { name: "columns", config: { title: "Board", columns: [{ title: "Todo", cards: [{ text: "Write *docs*", tone: "accent" }, { text: "Plain" }] }, { title: "Done" }] } },
  ],
  planning: [
    { name: "board-mode", config: { planning: "roadmap" } },
    {
      name: "generic-mode",
      config: {
        title: "Components by phase",
        itemType: "component",
        titleField: "name",
        phaseField: "phase",
        ownerField: "",
        componentField: "slug",
        phases: [
          { key: "design", label: "Design" },
          { key: "beta", label: "Beta" },
          { key: "produced", label: "Produced" },
        ],
      },
    },
    { name: "generic-without-phases", config: { itemType: "component" } },
    { name: "missing-planning", config: { planning: "nope" } },
    { name: "nothing-selected", config: {} },
  ],
  itinerary: [
    { name: "explicit-product", config: { title: "Itinerary", product: "cortex" } },
    { name: "subject-product", config: {}, subject: "product:cortex" },
    { name: "product-without-history", config: { product: "relay" } },
    { name: "no-product", config: {} },
  ],
  hero: [
    { name: "panel-image-button", config: { title: "Patch it in your *browser*.", subtitle: "No hardware needed.", image: "/hero.jpg", buttonLabel: "Open editor", buttonUrl: "https://editor.example.test" } },
    { name: "open-centered", config: { title: "Plain title", variant: "open", align: "center" } },
  ],
  video: [
    { name: "youtube", config: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", caption: "Demo" } },
    { name: "vimeo", config: { url: "https://vimeo.com/123456" } },
    { name: "file", config: { title: "Clip", url: "https://example.test/clip.mp4" } },
  ],
  accordion: [{ name: "items", config: { title: "FAQ", items: [{ title: "Is it open?", markdown: "Yes, **fully**." }, { title: "Price?" }] } }],
  divider: [
    { name: "line-default", config: {} },
    { name: "dots-small", config: { style: "dots", size: 1 } },
    { name: "scope", config: { style: "scope", size: 3 } },
    { name: "space-roomy", config: { style: "space", size: 4 } },
  ],
  specs: [
    { name: "capped-at-four-columns", config: { title: "In numbers", items: [{ value: "≤ 5 ms", label: "note-on → CV" }, { value: "16-bit" }, { value: "8", label: "CV out" }, { value: "12 HP", label: "width" }, { value: "2", label: "extra" }] } },
    { name: "empty", config: {} },
  ],
  downloads: [
    { name: "all-projects", config: { title: "Downloads" } },
    { name: "project-without-downloads", config: { project: "simulator" } },
  ],
  posts: [
    { name: "latest", config: { title: "Devlog" } },
    { name: "limit-one", config: { limit: 1 } },
    { name: "empty-prefix", config: { prefix: "news/" } },
  ],
  board: [
    { name: "hover", config: { title: "ADC8", image: "/boards/adc8.png", alt: "ADC8", points: [{ x: 0.2, y: 0.3, label: "J1", markdown: "| pin | net |\n|---|---|\n| 1 | GND |" }, { x: 0.8, y: 0.6, label: "J2", svgRef: "/pinouts/j2.svg" }] } },
    { name: "expanded", config: { image: "/boards/adc8.png", mode: "expanded", points: [{ x: 0.5, y: 0.5, label: "Centre", markdown: "Middle" }] } },
  ],
  boardspec: [
    { name: "explicit-spec", config: { title: "ADC8 v1.2", spec: "adc8@v1.2" } },
    { name: "from-subject-component", config: {}, subject: "component:adc8" },
    { name: "missing-spec", config: { spec: "nope@v1" } },
    { name: "no-spec", config: {} },
  ],
  template: [
    { name: "explicit-item", config: { type: "product", slug: "cortex", template: "# {{name}}\n\n{{tagline}}\n\n{{#specs}}- {{label}}: {{value}}\n{{/specs}}" } },
    { name: "subject", config: { template: "Hello {{name}}, status {{status}}" }, subject: "product:relay" },
    { name: "template-error", config: { template: "{{#open}} never closed" } },
  ],
  list: [
    { name: "query-explicit", config: { title: "Releases of Cortex", type: "release", matchField: "product", matchValue: "cortex", linkPattern: "/releases/{slug}", labelField: "version" } },
    { name: "query-subject", config: { type: "release", matchField: "product", linkPattern: "/releases/{slug}", limit: 2 }, subject: "product:cortex" },
    { name: "refs", config: { mode: "refs", field: "components", itemKey: "component", itemType: "component", linkPattern: "/components/{slug}" }, subject: "release:cortex-fw-v0.2" },
    { name: "empty", config: { type: "release", matchField: "product", matchValue: "nope", emptyText: "No releases." } },
  ],
  callout: [
    { name: "warning-button", config: { title: "Pre-order", markdown: "Ships **soon**.", tone: "warning", buttonLabel: "Order", buttonUrl: "/order" } },
    { name: "muted", config: { markdown: "Just a note.", tone: "muted" } },
  ],
  embed: [{ name: "iframe", config: { title: "Editor", url: "https://editor.example.test", height: 320 } }],
  treeview: [
    { name: "hand-written", config: { title: "Docs", items: [{ label: "Start", href: "/start", children: [{ label: "Power", href: "/power" }] }, { label: "Group", children: [{ label: "Leaf", href: "/leaf" }] }] } },
    { name: "from-pages", config: { title: "Guides", pagesPrefix: "guides/" } },
  ],
  api: [
    { name: "fields", config: { title: "Artists", url: "https://api.example.test/artists?q=kraftwerk", itemsPath: "artists", fields: [{ label: "Name", path: "name" }, { label: "Country", path: "area.name" }], limit: 2 } },
    { name: "raw-object", config: { url: "https://api.example.test/single" } },
    { name: "unreachable", config: { title: "Down", url: "https://down.example.test/x" } },
  ],
  releases: [
    { name: "latest", config: { title: "Latest", limit: 2 } },
    { name: "project", config: { project: "simulator" } },
    { name: "product-mode", config: { product: "cortex" } },
    { name: "subject-product", config: {}, subject: "product:cortex" },
  ],
  products: [{ name: "grid", config: { title: "Products" } }],
  subjectheader: [
    { name: "product", config: {}, subject: "product:cortex" },
    { name: "overrides", config: { title: "Custom", showStatus: false, showTagline: false, showDescription: false }, subject: "product:cortex" },
    { name: "no-subject", config: {} },
  ],
  spectable: [
    { name: "product", config: { title: "Technical" }, subject: "product:cortex" },
    { name: "product-without-specs", config: {}, subject: "product:relay" },
    { name: "no-subject", config: {} },
  ],
  components: [
    { name: "with-boards", config: {}, subject: "product:cortex" },
    { name: "without-boards", config: { title: "Parts", showBoards: false }, subject: "product:cortex" },
    { name: "product-without-components", config: {}, subject: "product:relay" },
    { name: "no-subject", config: {} },
  ],
};

/** Whole pages through PageRenderer (layout parsed by the registry, as the store does). */
export const PAGE_CASES: {
  name: string;
  page: { slug: string; title: string; body: string; layout: unknown };
  subject?: SubjectKey;
}[] = [
  {
    name: "rows-with-spans-title-and-body",
    page: {
      slug: "composed",
      title: "Composed page",
      body: "Intro **markdown**.",
      layout: {
        rows: [
          {
            cells: [
              { span: 1, widgets: [{ type: "text", config: { markdown: "Left" } }] },
              { span: 2, widgets: [{ type: "callout", config: { markdown: "Right" } }, { type: "divider", config: {} }] },
            ],
          },
          { cells: [{ span: 1, widgets: [] }] },
        ],
      },
    },
  },
  {
    name: "legacy-template-regions",
    page: {
      slug: "legacy",
      title: "Legacy",
      body: "",
      layout: {
        template: "sidebar-left",
        widgets: [
          { type: "treeview", config: { items: [{ label: "Nav", href: "/nav" }] }, region: "sidebar" },
          { type: "text", config: { markdown: "Main column" }, region: "main" },
        ],
      },
    },
  },
  {
    name: "empty-title-with-subject",
    page: {
      slug: "subjected",
      title: "",
      body: "",
      layout: { rows: [{ cells: [{ span: 1, widgets: [{ type: "subjectheader", config: {} }, { type: "spectable", config: {} }] }] }] },
    },
    subject: "product:cortex",
  },
];
