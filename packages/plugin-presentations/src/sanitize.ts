/**
 * Slide HTML, cleaned: only the elements and attributes of the Slides format
 * (and the SVG that icons and shapes become on import) survive. No scripts,
 * no event handlers, no `javascript:` or `data:` URLs, no `expression()` or
 * `url()` in styles. Run on import and again when a slide is shown, so a
 * slide edited by hand in the admin is held to the same rules.
 *
 * The input is the small, regular HTML of a deck, not arbitrary web pages:
 * a tag scanner with an allow-list is enough and needs no DOM.
 */

const TAGS = new Set([
  "section", "div", "p", "h1", "h2", "h3", "h4", "ul", "ol", "li", "b", "strong", "i", "em", "u", "a", "span", "br",
  "img", "table", "thead", "tbody", "tr", "th", "td", "hr",
  // icons and shapes, after import
  "svg", "path", "circle", "ellipse", "line", "polyline", "polygon", "rect", "g",
]);
const VOID = new Set(["br", "img", "hr", "path", "circle", "ellipse", "line", "polyline", "polygon", "rect"]);
const ATTRS = new Set([
  "style", "src", "alt", "href", "title", "aria-label", "role",
  "viewbox", "xmlns", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
  "d", "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2", "points", "width", "height",
]);
/** Elements dropped together with everything inside them. */
const DROP = /<(script|style|iframe|object|embed|template|noscript|aside)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

const safeUrl = (v: string) => {
  const u = v.trim();
  if (/^(javascript|data|vbscript):/i.test(u)) return null;
  return /^(https?:\/\/|\/(?!\/)|#|mailto:)/i.test(u) || !/^[a-z]+:/i.test(u) ? u : null;
};
const safeStyle = (v: string) => (/expression\s*\(|url\s*\(|javascript:|@import|behavior\s*:/i.test(v) ? null : v);
const escapeAttr = (v: string) => v.replace(/&(?!(?:[a-z]+|#\d+|#x[0-9a-f]+);)/gi, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export function sanitizeSlide(html: string): string {
  return html.replace(DROP, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g, (whole, rawName: string, rest: string) => {
    const name = rawName.toLowerCase();
    if (!TAGS.has(name)) return "";
    if (whole.startsWith("</")) return VOID.has(name) ? "" : `</${name}>`;
    const kept: string[] = [];
    for (const m of rest.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
      const attr = m[1]!.toLowerCase();
      if (!ATTRS.has(attr)) continue;
      let value: string | null = m[3] ?? m[4] ?? "";
      if (attr === "href" || attr === "src") value = safeUrl(value);
      else if (attr === "style") value = safeStyle(value);
      if (value === null) continue;
      kept.push(`${attr === "viewbox" ? "viewBox" : attr}="${escapeAttr(value)}"`);
    }
    if (name === "a") kept.push('rel="noopener noreferrer"');
    const selfClose = /\/\s*$/.test(rest) || VOID.has(name);
    return `<${name}${kept.length ? ` ${kept.join(" ")}` : ""}${selfClose && name !== "br" && name !== "img" && name !== "hr" ? " /" : ""}>`;
  });
}

/** The speaker notes: the text of the slide's `<aside>`, if it has one. */
export function notesOf(html: string): string {
  const m = /<aside\b[^>]*>([\s\S]*?)<\/aside\s*>/i.exec(html);
  return m ? decode(m[1]!.replace(/<[^>]+>/g, "")).trim() : "";
}

const decode = (s: string) =>
  s.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
