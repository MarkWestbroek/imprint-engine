/**
 * Allow-list sanitizer for SVG that a server hands us (the Omnium render API,
 * design/opdracht-omnium-render-api.md §3.6) before it goes inline into the
 * page. Pure string work, no DOM: a small tokenizer for well-formed SVG
 * markup, and it fails closed — anything it cannot tokenise returns null
 * instead of being passed through.
 *
 * Kept: the drawing elements and their presentation attributes. Dropped:
 * unknown elements with their whole subtree (script, foreignObject, image,
 * style, …), unknown and `on*` attributes, comments, processing
 * instructions, doctypes. Links survive only as relative, fragment or
 * http(s) URLs; `url(…)` in an attribute only as a local `url(#id)`.
 */

const ELEMENTS = new Set([
  "svg", "g", "defs", "title", "desc", "marker", "symbol", "use",
  "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "text", "tspan", "a", "clipPath", "linearGradient", "radialGradient", "stop",
]);

const ATTRIBUTES = new Set([
  "xmlns", "id", "class", "role", "viewBox", "preserveAspectRatio",
  "aria-label", "aria-labelledby", "aria-describedby", "aria-hidden",
  "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "width", "height",
  "d", "points", "transform", "dx", "dy",
  "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-opacity",
  "stroke-dasharray", "stroke-dashoffset", "stroke-linecap", "stroke-linejoin",
  "stroke-miterlimit", "opacity", "paint-order", "clip-path", "clip-rule",
  "font-family", "font-size", "font-style", "font-weight", "text-anchor",
  "dominant-baseline", "alignment-baseline", "letter-spacing", "text-decoration",
  "marker-start", "marker-mid", "marker-end", "markerWidth", "markerHeight",
  "markerUnits", "refX", "refY", "orient",
  "offset", "stop-color", "stop-opacity", "gradientUnits", "gradientTransform",
  "href", "target", "tabindex", "focusable",
]);

/** Elements that may carry a link (`href`). */
const LINKING = new Set(["a", "use"]);

const TOKEN =
  /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<\/([A-Za-z][\w:.-]*)\s*>|<([A-Za-z][\w:.-]*)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|[^<]+/y;
const ATTR = /\s+([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

const decode = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(lt|gt|quot|apos|amp);/g, (_, n) => ({ lt: "<", gt: ">", quot: '"', apos: "'", amp: "&" })[n as string]!);

/** Re-escape a raw (possibly entity-encoded) attribute value for `"…"`. */
const quote = (raw: string) => raw.replace(/&(?!(?:#\d+|#x[0-9a-f]+|[a-z]+);)/gi, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function safeUrl(value: string): boolean {
  const v = value.replace(/[\s\u0000-\u001f]/g, "");
  return /^(?:#|\/(?!\/)|https?:\/\/)/i.test(v);
}

function safeAttribute(element: string, name: string, raw: string): boolean {
  const plain = name === "xlink:href" ? "href" : name;
  if (!ATTRIBUTES.has(plain)) return false;
  const value = decode(raw);
  if (/javascript:|data:|expression\(/i.test(value.replace(/\s/g, ""))) return false;
  // Only local paint servers/markers: url(#id).
  for (const m of value.matchAll(/url\(([^)]*)\)/gi)) {
    if (!/^\s*["']?#[\w.:-]+["']?\s*$/.test(m[1])) return false;
  }
  if (plain === "href") return LINKING.has(element) && (element === "use" ? value.startsWith("#") : safeUrl(value));
  return true;
}

/**
 * Returns the sanitised SVG, or null when the input is not an `<svg>`
 * document this tokenizer understands.
 */
export function sanitizeSvg(input: string): string | null {
  const src = input.trim();
  let out = "";
  let pos = 0;
  let root = false;
  /** Open elements: name + whether it is kept. */
  const stack: { name: string; kept: boolean }[] = [];
  const dropping = () => stack.some((e) => !e.kept);

  while (pos < src.length) {
    TOKEN.lastIndex = pos;
    const m = TOKEN.exec(src);
    if (!m || m.index !== pos) return null;
    pos = TOKEN.lastIndex;
    const [tok, closing, opening, attrs, selfClose] = m;

    if (closing) {
      const top = stack.pop();
      if (!top || top.name !== closing) return null;
      if (top.kept && !dropping()) out += `</${closing}>`;
      continue;
    }
    if (opening) {
      if (stack.length === 0) {
        // Exactly one root, and it is <svg>.
        if (root || opening !== "svg") return null;
        root = true;
      }
      const kept = ELEMENTS.has(opening) && !dropping();
      if (kept) {
        let a = "";
        for (const am of (attrs ?? "").matchAll(ATTR)) {
          const [, name, dq, sq] = am;
          const raw = dq ?? sq ?? "";
          if (safeAttribute(opening, name, raw)) a += ` ${name === "xlink:href" ? "href" : name}="${quote(raw)}"`;
        }
        out += `<${opening}${a}${selfClose ? "/" : ""}>`;
      }
      if (!selfClose) stack.push({ name: opening, kept: ELEMENTS.has(opening) });
      continue;
    }
    if (tok.startsWith("<")) {
      // Comment, CDATA, doctype or processing instruction: never kept.
      continue;
    }
    // Text: only inside the root, never raw markup.
    if (stack.length === 0) {
      if (tok.trim()) return null;
      continue;
    }
    if (!dropping()) out += tok.replace(/&(?!(?:#\d+|#x[0-9a-f]+|[a-z]+);)/gi, "&amp;").replace(/>/g, "&gt;");
  }
  return root && stack.length === 0 ? out : null;
}
