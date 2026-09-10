import { z } from "zod";
import { WidgetTypeRegistry } from "../src/widgets";

/**
 * One fixture set, materialised by every backend under test: the file store
 * writes these as files, the database store puts them through `putItem`.
 * Keeping the data in one place is what makes the contract suite in
 * store-contract.ts meaningful — both backends see exactly the same content.
 *
 * Dates are deliberately in the past (2025/2026) and the far future (2099),
 * so "now" is always somewhere in between.
 */

export const SITE = {
  name: "Fixture",
  tagline: "A site for characterisation tests",
  baseUrl: "https://fixture.test",
};

/** Page payloads as the stores understand them (meta + body + optional layout). */
export const PAGES = [
  { slug: "about", lang: "en", title: "About", publishedAt: "2026-01-10", body: "About EN" },
  { slug: "about", lang: "nl", title: "Over", publishedAt: "2026-01-10", body: "Over NL" },
  { slug: "secret", title: "Secret", draft: true, publishedAt: "2026-01-01", body: "hidden" },
  { slug: "future", title: "Future", publishedAt: "2099-01-01", body: "not yet" },
  { slug: "posts/hello", title: "Hello", publishedAt: "2026-02-01", body: "first post" },
  { slug: "posts/older", title: "Older", publishedAt: "2025-12-01", body: "old post" },
  { slug: "nodate", title: "No date", body: "always visible" },
  {
    slug: "composed",
    title: "Composed",
    publishedAt: "2026-01-05",
    body: "",
    layout: {
      rows: [
        {
          cells: [
            { span: 1, widgets: [{ type: "text", config: { markdown: "hi" } }] },
            { span: 2, widgets: [] },
          ],
        },
      ],
    },
  },
  {
    slug: "legacy",
    title: "Legacy layout",
    publishedAt: "2026-01-06",
    body: "",
    layout: {
      template: "sidebar-left",
      widgets: [{ type: "text", config: { markdown: "side" }, region: "sidebar" }],
    },
  },
] as const;

export const PRODUCTS = [
  { slug: "alpha", lang: "en", name: "Alpha", tagline: "first", status: "available", order: 2 },
  { slug: "alpha", lang: "nl", name: "Alfa", tagline: "eerste", status: "available", order: 2 },
  { slug: "beta", lang: "en", name: "Beta", tagline: "second", status: "beta", order: 1 },
] as const;

export const RELEASES = [
  { project: "fw", version: "1.0.0", date: "2026-01-01", product: "alpha" },
  {
    project: "fw",
    version: "1.1.0",
    date: "2026-03-01",
    product: "alpha",
    components: [{ component: "c1", version: "v1" }],
  },
  { project: "sim", version: "0.1.0", date: "2099-01-01" },
] as const;

export const MENUS = [
  {
    name: "main",
    items: [
      { label: "About", page: "about" },
      { label: "Posts", url: "/posts", children: [{ label: "Hello", page: "posts/hello" }] },
    ],
  },
];

export const THEMES = [
  { name: "zulu", label: "Zulu", order: 0, colors: COLORS() },
  { name: "alpha", label: "Alpha", order: 1, colors: COLORS() },
  { name: "mid", label: "Mid", order: 0, colors: COLORS() },
];

function COLORS() {
  return {
    background: "#000",
    surface: "#111",
    border: "#222",
    foreground: "#fff",
    muted: "#888",
    accent: "#f5a623",
    accentStrong: "#b87f1f",
  };
}

/** A registry that knows the one widget the fixtures use. */
export function textOnlyRegistry(): WidgetTypeRegistry {
  return new WidgetTypeRegistry().register({
    name: "text",
    configSchema: z.object({ title: z.string().optional(), markdown: z.string() }),
  });
}

/** A registry that knows nothing the fixtures use — reads must fail loudly. */
export function emptyRegistry(): WidgetTypeRegistry {
  return new WidgetTypeRegistry().register({
    name: "other",
    configSchema: z.object({}),
  });
}
