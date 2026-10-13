import { promises as fs } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Cloud, Code, Database, Globe, CircleCheck, Lock, Send, Zap, type LucideIcon } from "lucide-react";
import { notesOf, sanitizeSlide } from "./sanitize";
import { PresentationSchema, type Presentation } from "./schemas";

/**
 * A deck from the Slides format (an export: `deck.json` with `title`,
 * `order`, `sections`, `faces`, and `slides/<id>.html`, one `<section>` each,
 * the speaker notes in an `<aside>`) into a Presentation:
 *
 * - the notes leave the HTML and go to `notes`;
 * - `<x-icon name>` becomes the Lucide icon as inline SVG, `<x-shape>` a
 *   plain SVG or box, with the size and colour of its inline style;
 * - `/_blob/<id>` images become the site's own paths (`blobs`), as an
 *   artifact's blobs do not exist outside it;
 * - everything is sanitised (sanitize.ts).
 */

const ICONS: Record<string, LucideIcon> = {
  Code, Database, Globe, Cloud, Lock, Lightning: Zap, Zap, PaperPlane: Send, Send, CheckCircle: CircleCheck, CircleCheck,
};

const attr = (tag: string, name: string) => new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1] ?? "";
const styleValue = (style: string, prop: string) => new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`).exec(style)?.[1]?.trim() ?? "";

function icon(tag: string): string {
  const name = attr(tag, "name");
  const style = attr(tag, "style");
  const Icon = ICONS[name];
  if (!Icon) return "";
  const size = styleValue(style, "width") || "48px";
  const svg = renderToStaticMarkup(createElement(Icon, { size: parseInt(size, 10) || 48, color: styleValue(style, "color") || "currentColor", strokeWidth: 2 }));
  return svg.replace(/ class="[^"]*"/, "").replace("<svg ", `<svg aria-label="${name}" style="flex:none;${style}" `);
}

function shape(tag: string): string {
  const kind = attr(tag, "kind");
  const style = attr(tag, "style");
  const fill = styleValue(style, "background") || "#94a3b8";
  const rest = style.replace(/(?:^|;)\s*background\s*:[^;]+/, "");
  if (kind === "ellipse") return `<div style="flex:none;border-radius:9999px;${style}"></div>`;
  if (kind === "rect" || kind === "rounded") return `<div style="flex:none;${kind === "rounded" ? "border-radius:16px;" : ""}${style}"></div>`;
  const arrows: Record<string, string> = {
    "arrow-right": "M0 12h40V0l24 18-24 18V24H0z",
    "arrow-left": "M64 12H24V0L0 18l24 18V24h40z",
    "arrow-up": "M12 64V24H0L18 0l18 24H24v40z",
    "arrow-down": "M12 0v40H0l18 24 18-24H24V0z",
  };
  const d = arrows[kind];
  if (!d) return "";
  const box = kind === "arrow-up" || kind === "arrow-down" ? "0 0 36 64" : "0 0 64 36";
  return `<svg viewBox="${box}" preserveAspectRatio="none" aria-label="${kind}" style="flex:none;${rest}"><path d="${d}" fill="${fill}"/></svg>`;
}

export function convertSlide(html: string, blobs: Record<string, string>): { html: string; notes: string } {
  const notes = notesOf(html);
  let out = html
    .replace(/<x-icon\b[^>]*>(?:\s*<\/x-icon>)?/g, icon)
    .replace(/<x-shape\b[^>]*>(?:\s*<\/x-shape>)?/g, shape)
    .replace(/\/_blob\/([0-9a-f]+)/g, (m, id: string) => blobs[id] ?? m);
  out = sanitizeSlide(out);
  return { html: out.trim(), notes };
}

type DeckIndex = {
  title: string;
  order: string[];
  sections?: Record<string, { description?: string; start: string }>;
  faces?: Record<string, { family: string; href?: string }>;
};

export async function importDeck(dir: string, opts: { slug: string; blobs?: Record<string, string>; description?: string }): Promise<Presentation> {
  const index = JSON.parse(await fs.readFile(path.join(dir, "deck.json"), "utf8")) as DeckIndex;
  const sections = Object.entries(index.sections ?? {}).map(([id, s]) => ({ id, description: s.description ?? "", start: s.start }));
  const sectionOf = (id: string) => {
    let current: string | undefined;
    for (const slide of index.order) {
      const opened = sections.find((s) => s.start === slide);
      if (opened) current = opened.id;
      if (slide === id) return current;
    }
    return undefined;
  };
  const slides = [];
  for (const id of index.order) {
    const raw = await fs.readFile(path.join(dir, "slides", `${id}.html`), "utf8");
    const { html, notes } = convertSlide(raw, opts.blobs ?? {});
    slides.push({ id, section: sectionOf(id), html, notes });
  }
  return PresentationSchema.parse({
    slug: opts.slug,
    lang: "en",
    access: "public",
    title: index.title,
    description: opts.description ?? "",
    sections,
    faces: Object.values(index.faces ?? {})
      .filter((f) => f.href)
      .map((f) => ({ family: f.family, href: f.href! })),
    slides,
  });
}
