import "./load-env";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createImprint } from "@imprint/extension-api";
import config from "../imprint.config";

/**
 * Import the public pages of a Pleio site into this Imprint instance — the
 * Common Ground showcase (design/communities.md). Reads anonymously through
 * Pleio's GraphQL API (the same data every visitor gets) and writes through
 * the WritableContentStore, so every page is an ordinary, versioned Imprint
 * page afterwards, editable in the studio.
 *
 *   npm run import:pleio --workspace=commonground               # live
 *   npm run import:pleio --workspace=commonground -- --cache=DIR  # site.json + pages.json from DIR (and saves them there when live)
 *   … -- --dry-run                                                 # convert and report, write nothing
 *   … -- --base-url=https://…                                      # the site's own address (site.baseUrl)
 *
 * What it maps:
 * - site-level pages (not those inside groups) → `page`, slug from the URL;
 *   the start page becomes `home`;
 * - rows → cells → widgets: Pleio's 12-column widths become cell spans,
 *   text → text (or a callout when it has a background colour), lead → hero,
 *   callToAction → callout, linkList → cards, an iframe in an html widget →
 *   embed; widgets that list Pleio content (news, events, groups, activity,
 *   search) become a callout pointing at the original until that content
 *   comes along;
 * - rich text is TipTap JSON → Markdown;
 * - the main menu → menu `main`, the footer rows → page `_footer`.
 * Links to imported pages become Imprint paths; everything else (news,
 * events, groups, files, images) points at the Pleio site itself.
 * Unchanged pages are skipped, so running it again only adds real changes.
 */

// imprint.config reads DATABASE_URL when imported; the env is loaded before the import below runs.

const ORIGIN = (process.argv.find((a) => a.startsWith("--origin="))?.slice(9) ?? "https://commonground.nl").replace(/\/$/, "");
const CACHE = process.argv.find((a) => a.startsWith("--cache="))?.slice(8);
const DRY = process.argv.includes("--dry-run");
/** The public address of this Imprint site (site.baseUrl); kept when not given. */
const BASE_URL = process.argv.find((a) => a.startsWith("--base-url="))?.slice(11);
const BY = "import-pleio";

// ── Pleio GraphQL ────────────────────────────────────────────────────────

const ROW = `isFullWidth backgroundColor columns { width widgets { guid type settings { key value richDescription
  attachment { id mimeType url downloadUrl name dimension { width height } }
  links { id title description url image { id url } imageAlt buttonText } } } }`;

const SITE_QUERY = `query Site { site { name subtitle startpage
  menu { label link children { label link children { label link } } }
  footerRows { ${ROW} } } }`;

const PAGES_QUERY = `query Pages($offset: Int, $limit: Int) { entities(subtype: "page", offset: $offset, limit: $limit) {
  total edges { guid ... on Page { pageType statusPublished accessId title url description richDescription
  timeCreated timeUpdated group { guid } rows { ${ROW} } } } } }`;

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${ORIGIN}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (!res.ok || body.errors?.length || !body.data) {
    throw new Error(`Pleio GraphQL ${res.status}: ${body.errors?.map((e) => e.message).join("; ") ?? "no data"}`);
  }
  return body.data;
}

/** Read from the cache dir when the file is there, else fetch live (and save it there). */
async function cached<T>(file: string, load: () => Promise<T>): Promise<T> {
  if (CACHE) {
    try {
      const json = JSON.parse(await fs.readFile(path.join(CACHE, file), "utf8"));
      return (json.data ?? json) as T;
    } catch {
      /* not cached yet */
    }
  }
  const data = await load();
  if (CACHE) await fs.writeFile(path.join(CACHE, file), JSON.stringify({ data }, null, 1));
  return data;
}

type Setting = {
  key: string;
  value: string | null;
  richDescription: string | null;
  attachment: { url: string | null; downloadUrl: string | null; name: string | null } | null;
  links: { title: string | null; description: string | null; url: string | null }[] | null;
};
type PWidget = { guid: string; type: string; settings: Setting[] };
type PRow = { isFullWidth: boolean; backgroundColor: string | null; columns: { width: number[]; widgets: PWidget[] }[] };
type PPage = {
  guid: string;
  pageType: string;
  statusPublished: string;
  accessId: number;
  title: string;
  url: string;
  description: string | null;
  richDescription: string | null;
  group: { guid: string } | null;
  rows: PRow[] | null;
};
type PMenuItem = { label: string; link: string | null; children?: PMenuItem[] | null };
type PSite = { name: string; subtitle: string; startpage: string | null; menu: PMenuItem[]; footerRows: PRow[] };

// ── Links ────────────────────────────────────────────────────────────────

const GUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
/** Pleio guid → Imprint slug, for every imported page. */
const slugOf = new Map<string, string>();

/** A Pleio href as it should be on the Imprint site. */
function href(raw: string | null | undefined): string {
  if (!raw) return "";
  let url = raw.trim();
  if (url.startsWith(ORIGIN)) url = url.slice(ORIGIN.length) || "/";
  if (/^(mailto:|tel:|#)/.test(url) || /^[a-z]+:\/\//i.test(url)) return url;
  const page = url.match(new RegExp(`^/page/view/(${GUID.source})`)) ?? url.match(new RegExp(`^(${GUID.source})`));
  if (page && slugOf.has(page[1]!)) {
    const slug = slugOf.get(page[1]!)!;
    return slug === "home" ? "/" : `/${slug}`;
  }
  // Everything that did not come along (news, events, groups, files) stays on Pleio.
  return `${ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
}

// ── TipTap JSON → Markdown ───────────────────────────────────────────────

type TNode = { type: string; text?: string; attrs?: Record<string, unknown>; marks?: { type: string; attrs?: Record<string, unknown> }[]; content?: TNode[] };

const escapeMd = (s: string) => s.replace(/([\\`*_[\]])/g, "\\$1");

function inline(nodes: TNode[] = []): string {
  let out = "";
  for (const node of nodes) {
    if (node.type === "hardBreak") {
      out += "  \n";
      continue;
    }
    if (node.type === "button") {
      out += `[${inline(node.content).trim() || "Lees meer"}](${href(String(node.attrs?.url ?? ""))})`;
      continue;
    }
    if (node.type !== "text") {
      out += inline(node.content);
      continue;
    }
    let text = escapeMd(node.text ?? "");
    const marks = new Set((node.marks ?? []).map((m) => m.type));
    // Emphasis around the text, keeping surrounding spaces outside the markers.
    const [, lead = "", core = "", trail = ""] = text.match(/^(\s*)([\s\S]*?)(\s*)$/) ?? [];
    text = core;
    if (text) {
      if (marks.has("italic")) text = `*${text}*`;
      if (marks.has("bold")) text = `**${text}**`;
      const link = node.marks?.find((m) => m.type === "link");
      if (link) text = `[${text}](${href(String(link.attrs?.href ?? ""))})`;
    }
    out += lead + text + trail;
  }
  return out;
}

function cellText(node: TNode): string {
  return blocks(node.content ?? [])
    .replace(/\n+/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
}

function blocks(nodes: TNode[], depth = 0): string {
  const out: string[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "paragraph": {
        const content = node.content ?? [];
        if (content.length && content.every((n) => n.type === "button")) {
          // A row of Pleio buttons: its own buttons widget (see widgetsFromRich); links in plain Markdown.
          const items = content.map((n) => ({
            label: inline(n.content).trim() || "Lees meer",
            href: href(String(n.attrs?.url ?? "")),
          }));
          out.push(`${BUTTONS}${JSON.stringify(items)}${BUTTONS}`);
          break;
        }
        const text = inline(content).trim();
        if (text) out.push(text);
        break;
      }
      case "heading": {
        // The page title is the h1; content headings start at h2.
        const level = Math.min(6, Math.max(2, Number(node.attrs?.level ?? 2)));
        const text = inline(node.content).trim();
        if (text) out.push(`${"#".repeat(level)} ${text}`);
        break;
      }
      case "bulletList":
      case "orderedList": {
        const items = (node.content ?? []).map((item, i) => {
          const marker = node.type === "orderedList" ? `${i + 1}.` : "-";
          const body = blocks(item.content ?? [], depth + 1).split("\n");
          const pad = " ".repeat(marker.length + 1);
          return `${marker} ${body[0] ?? ""}${body.slice(1).map((l) => (l ? `\n${pad}${l}` : "\n")).join("")}`;
        });
        out.push(items.join("\n"));
        break;
      }
      case "blockquote": {
        const text = blocks(node.content ?? [], depth);
        const who = [node.attrs?.author, node.attrs?.sourceTitle].filter(Boolean).join(", ");
        out.push(
          (text + (who ? `\n\n— ${who}` : ""))
            .split("\n")
            .map((l) => `> ${l}`.trimEnd())
            .join("\n")
        );
        break;
      }
      case "accordion": {
        // No <details> in Markdown: the summary as a bold lead-in, then its content.
        out.push(`**${escapeMd(String(node.attrs?.summary ?? ""))}**`);
        const inner = blocks(node.content ?? [], depth);
        if (inner) out.push(inner);
        break;
      }
      case "image": {
        const src = href(String(node.attrs?.src ?? ""));
        if (src) out.push(`![${escapeMd(String(node.attrs?.alt ?? ""))}](${src})`);
        if (node.attrs?.caption) out.push(`*${escapeMd(String(node.attrs.caption))}*`);
        break;
      }
      case "file": {
        const url = href(String(node.attrs?.download ?? node.attrs?.url ?? ""));
        out.push(`[${escapeMd(String(node.attrs?.name ?? "Bestand"))}](${url})`);
        break;
      }
      case "video": {
        const a = node.attrs ?? {};
        const url =
          a.platform === "youtube" && a.guid ? `https://www.youtube.com/watch?v=${a.guid}` : String(a.url ?? "");
        if (url) out.push(`▶ [${escapeMd(String(a.title || "Video"))}](${url})`);
        break;
      }
      case "button": {
        const text = inline(node.content).trim() || "Lees meer";
        out.push(`[${text}](${href(String(node.attrs?.url ?? ""))})`);
        break;
      }
      case "table": {
        const rows = (node.content ?? []).map((row) => (row.content ?? []).map(cellText));
        if (!rows.length) break;
        const width = Math.max(...rows.map((r) => r.length));
        const line = (cells: string[]) => `| ${[...cells, ...Array(width - cells.length).fill("")].join(" | ")} |`;
        out.push([line(rows[0]!), line(Array(width).fill("---")), ...rows.slice(1).map(line)].join("\n"));
        break;
      }
      case "horizontalRule":
        out.push("---");
        break;
      default:
        if (node.content) {
          const inner = blocks(node.content, depth);
          if (inner) out.push(inner);
        }
    }
  }
  return out.join("\n\n");
}

/** Marks a row of buttons inside converted Markdown, until it is split off into a widget. */
const BUTTONS = "\u0000";
const BUTTONS_RE = new RegExp(`${BUTTONS}(.*?)${BUTTONS}`, "g");
type ButtonItem = { label: string; href: string };

/** TipTap JSON (a string, as Pleio stores it) → Markdown with button rows marked. Plain text passes through. */
function richMarkdown(rich: string | null | undefined): string {
  if (!rich) return "";
  try {
    const doc = JSON.parse(rich) as TNode;
    return blocks(doc.content ?? []).trim();
  } catch {
    return rich.trim();
  }
}

/** TipTap JSON → plain Markdown: button rows become links. */
function markdown(rich: string | null | undefined): string {
  return richMarkdown(rich).replace(BUTTONS_RE, (_, json: string) =>
    (JSON.parse(json) as ButtonItem[]).map((b) => `[${b.label}](${b.href})`).join(" · ")
  );
}

/** TipTap JSON → widgets: Markdown text, split where a row of buttons stands on its own. */
function widgetsFromRich(rich: string | null | undefined): Widget[] {
  const out: Widget[] = [];
  richMarkdown(rich)
    .split(BUTTONS)
    .forEach((part, i) => {
      if (i % 2 === 1) {
        const items = (JSON.parse(part) as ButtonItem[]).map((b) => ({
          ...b,
          style: "primary",
          newTab: /^https?:/.test(b.href),
        }));
        out.push({ type: "buttons", config: { items, align: "left" } });
      } else if (part.trim()) {
        out.push({ type: "text", config: { markdown: part.trim() } });
      }
    });
  return out;
}

// ── Rows and widgets ─────────────────────────────────────────────────────

type Widget = { type: string; config: Record<string, unknown> };
const settingsOf = (w: PWidget) => new Map(w.settings.map((s) => [s.key, s]));
const val = (s: Map<string, Setting>, key: string) => s.get(key)?.value?.trim() ?? "";

/** Light blue backgrounds read as "info", yellow ones as "warning"; the rest as the neutral box. */
function tone(color: string | null | undefined): "info" | "warning" | "muted" {
  const hex = (color ?? "").replace("#", "").toLowerCase();
  if (hex.length !== 6) return "muted";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  if (b! > r! && b! >= g!) return "info";
  if (r! > b! + 30 && g! > b! + 10) return "warning";
  return "muted";
}

const LISTS: Record<string, string> = {
  news: "Nieuws",
  blog: "Blogs",
  event: "Agenda",
  events: "Agenda",
  groups: "Communities",
  activity: "Activiteit",
  search: "Zoeken",
  custom_term: "Termen",
  discussion: "Discussies",
  question: "Vragen",
};

/** Widgets that list Pleio content: a pointer to the original until the content itself comes along. */
function listPlaceholder(w: PWidget, s: Map<string, Setting>, page: PPage | null): Widget {
  const subtypes = val(s, "subtypes") || val(s, "typeFilter");
  const kind = subtypes.replace(/[[\]"]/g, "").split(",")[0] || w.type;
  const title = val(s, "title") || LISTS[kind] || LISTS[w.type] || "Overzicht";
  return {
    type: "callout",
    config: {
      title,
      markdown: `Dit overzicht (${LISTS[kind] ?? kind}) komt uit Pleio en volgt in deze showcase zodra die inhoud wordt overgenomen.`,
      tone: "muted",
      buttonLabel: "Bekijk op commonground.nl",
      buttonUrl: page ? `${ORIGIN}${page.url}` : ORIGIN,
    },
  };
}

function widget(w: PWidget, page: PPage | null, rowColor: string | null): Widget[] {
  const s = settingsOf(w);
  switch (w.type) {
    case "text": {
      const rich = s.get("richDescription")?.richDescription ?? s.get("richDescription")?.value;
      const color = val(s, "backgroundColor");
      if (color && tone(color) !== "muted" && color.toLowerCase() !== (rowColor ?? "").toLowerCase()) {
        // A coloured block stays one block, its buttons as links inside the callout.
        const md = markdown(rich);
        return md ? [{ type: "callout", config: { markdown: md, tone: tone(color) } }] : [];
      }
      return widgetsFromRich(rich);
    }
    case "lead": {
      const title = val(s, "title");
      const image = s.get("image")?.attachment;
      const src = href(image?.downloadUrl ?? image?.url ?? val(s, "image"));
      const link = val(s, "link");
      if (!title && src) return [{ type: "image", config: { src, alt: val(s, "imageAlt") } }];
      if (!title) return [];
      return [
        {
          type: "hero",
          config: {
            title,
            ...(src ? { image: src } : {}),
            ...(link ? { buttonLabel: val(s, "linkText") || "Lees meer", buttonUrl: href(link) } : {}),
            variant: src ? "panel" : "open",
          },
        },
      ];
    }
    case "callToAction": {
      const link = val(s, "link");
      return [
        {
          type: "callout",
          config: {
            ...(val(s, "title") ? { title: val(s, "title") } : {}),
            markdown: markdown(s.get("description")?.richDescription ?? s.get("description")?.value),
            tone: "muted",
            ...(link ? { buttonLabel: val(s, "buttonText") || "Lees meer", buttonUrl: href(link) } : {}),
          },
        },
      ];
    }
    case "linkList": {
      const links = (s.get("links")?.links ?? []).filter((l) => l.title && l.url);
      if (!links.length) return [];
      return [
        {
          type: "cards",
          config: {
            ...(val(s, "title") ? { title: val(s, "title") } : {}),
            columns: Math.min(3, links.length),
            items: links.map((l) => ({ title: l.title!, markdown: l.description ?? "", href: href(l.url) })),
          },
        },
      ];
    }
    case "html": {
      const html = val(s, "description");
      const iframe = html.match(/<iframe[^>]*\ssrc="([^"]+)"/i);
      if (iframe && /^https?:\/\//.test(iframe[1]!)) {
        const title = html.match(/\stitle="([^"]+)"/i)?.[1];
        const height = Number(html.match(/\sheight="(\d+)/i)?.[1] ?? 600);
        return [{ type: "embed", config: { url: iframe[1], height, ...(title ? { title } : {}) } }];
      }
      // Other raw HTML (styled buttons, …): its links, as Markdown.
      const links = [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map(
        ([, url, text]) => `[${text!.replace(/<[^>]+>/g, "").trim() || url}](${href(url)})`
      );
      return links.length ? [{ type: "text", config: { markdown: links.join("\n\n") } }] : [];
    }
    case "objects":
    case "featured":
    case "events":
    case "groups":
    case "activity":
    case "search":
      return [listPlaceholder(w, s, page)];
    case "create":
      return []; // "new item" buttons for signed-in members; nothing to show publicly
    default:
      console.warn(`  ! widget type "${w.type}" not mapped (${page?.url ?? "footer"})`);
      return [];
  }
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** Pleio's 12-column row → an Imprint row: spans are the widths in lowest terms, at most 4. */
function rows(pRows: PRow[], page: PPage | null) {
  const out: { cells: { span: number; widgets: Widget[] }[] }[] = [];
  for (const row of pRows) {
    const cols = row.columns.map((c) => ({
      width: c.width?.[0] ?? 12,
      widgets: c.widgets.flatMap((w) => widget(w, page, row.backgroundColor)),
    }));
    if (!cols.some((c) => c.widgets.length)) continue;
    const g = cols.reduce((acc, c) => gcd(acc, c.width), 0) || 12;
    let spans = cols.map((c) => c.width / g);
    if (Math.max(...spans) > 4) spans = cols.map((c) => Math.max(1, Math.min(4, Math.round((c.width / 12) * 4))));
    out.push({ cells: cols.map((c, i) => ({ span: spans[i]!, widgets: c.widgets })) });
  }
  return out;
}

// ── Main ─────────────────────────────────────────────────────────────────

function slugFromUrl(url: string): string {
  const last = url.replace(/\/$/, "").split("/").pop() ?? "";
  return (
    last
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "pagina"
  );
}

function menu(items: PMenuItem[]): { label: string; page?: string; url?: string; children?: unknown[] }[] {
  return items.map((item) => {
    const target = href(item.link);
    const internal = target.startsWith("/") ? target.slice(1) || "home" : null;
    const children = item.children?.length ? menu(item.children) : undefined;
    return {
      label: item.label,
      ...(internal !== null ? { page: internal } : target ? { url: target } : {}),
      ...(children ? { children } : {}),
    };
  });
}

async function main() {
  const site = await cached<{ site: PSite }>("site.json", () => gql(SITE_QUERY)).then((d) => d.site);
  const pages = await cached<{ entities: { edges: PPage[] } }>("pages.json", () =>
    gql(PAGES_QUERY, { offset: 0, limit: 1000 })
  ).then((d) => d.entities.edges);

  // Public, published, site-level pages only; groups come with the community work.
  const wanted = pages.filter((p) => !p.group && p.statusPublished === "published" && p.accessId === 2);
  const taken = new Set<string>(["zoeken", "admin", "api"]);
  for (const p of wanted) {
    let slug = p.guid === site.startpage ? "home" : slugFromUrl(p.url);
    for (let n = 2; taken.has(slug); n++) slug = `${slugFromUrl(p.url)}-${n}`;
    taken.add(slug);
    slugOf.set(p.guid, slug);
  }

  const docs: { slug: string; data: Record<string, unknown> }[] = [];
  for (const p of wanted) {
    const layoutRows = p.pageType === "campagne" ? rows(p.rows ?? [], p) : [];
    const body = p.pageType === "campagne" ? "" : markdown(p.richDescription);
    const data: Record<string, unknown> = {
      slug: slugOf.get(p.guid)!,
      lang: "en",
      title: p.title,
      description: (p.description ?? "").replace(/\s+/g, " ").trim().slice(0, 300),
      body,
    };
    if (layoutRows.length) data.layout = { rows: layoutRows };
    else if (!body) data.body = `*Deze pagina is leeg op ${ORIGIN}.*`;
    docs.push({ slug: data.slug as string, data });
  }

  const footer = rows(site.footerRows ?? [], null);
  if (footer.length) {
    docs.push({
      slug: "_footer",
      data: { slug: "_footer", lang: "en", title: "Footer", description: "", body: "", layout: { rows: footer } },
    });
  }
  const mainMenu = { name: "main", items: menu(site.menu ?? []) };

  console.log(`${wanted.length} pages (of ${pages.length}), footer ${footer.length ? "✓" : "–"}, menu ${mainMenu.items.length} items`);
  if (DRY) {
    for (const d of docs) console.log(`  ${d.slug}  ${(d.data.layout as { rows: unknown[] } | undefined)?.rows.length ?? 0} rows`);
    console.log(JSON.stringify(mainMenu, null, 1));
    return;
  }

  const store = createImprint(config).writableStore;
  if (!store) throw new Error("Writing needs DATABASE_URL (see .env.example)");

  let written = 0;
  const put = async (type: string, slug: string, data: unknown) => {
    const current = await store.getItem(type, slug, "en");
    if (current && JSON.stringify(current.data) === JSON.stringify(data)) return;
    try {
      await store.putItem(type, slug, data, { lang: "en", by: BY });
      written++;
    } catch (err) {
      console.error(`  ✗ ${type} ${slug}: ${(err as Error).message.slice(0, 400)}`);
    }
  };

  const current = await store.getItem("site", "site", "en");
  const siteData = {
    ...((current?.data as Record<string, unknown>) ?? {}),
    name: site.name,
    tagline: site.subtitle || "",
    baseUrl: BASE_URL ?? (current?.data as { baseUrl?: string } | undefined)?.baseUrl ?? "http://localhost:3300",
    defaultLocale: "nl",
  };
  await put("site", "site", siteData);
  for (const d of docs) await put("page", d.slug, d.data);
  await put("menu", "main", mainMenu);
  // Stored values get their schema defaults, so a re-run compares unequal once; the second re-run is quiet.
  console.log(`✓ ${written} written, ${docs.length + 2 - written} unchanged or failed`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
