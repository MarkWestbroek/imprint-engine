/**
 * The text of a rendered field as one string, with a way back to the DOM:
 * selectors are made and anchored on the string (anchor.ts), ranges and
 * highlights live in the DOM. Browser-only; nothing here touches React.
 */

export type TextIndex = { root: Element; text: string; nodes: { node: Text; start: number }[] };

const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"]);

/** Walk the text nodes under `root` in document order. */
export function indexText(root: Element): TextIndex {
  const nodes: TextIndex["nodes"] = [];
  let text = "";
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement && SKIP.has(n.parentElement.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n as Text;
    nodes.push({ node: t, start: text.length });
    text += t.data;
  }
  return { root, text, nodes };
}

/** The global offset of a DOM point (a node and an offset inside it), or null when outside the index. */
export function offsetOf(index: TextIndex, node: Node, offset: number): number | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const entry = index.nodes.find((e) => e.node === node);
    return entry ? entry.start + offset : null;
  }
  // An element point: the start of the first text node at or after the child at `offset`.
  const child = node.childNodes[offset] ?? null;
  if (!child) {
    const last = index.nodes.filter((e) => node.contains(e.node)).pop();
    return last ? last.start + last.node.data.length : null;
  }
  const first = index.nodes.find((e) => child === e.node || child.contains(e.node) || child.compareDocumentPosition(e.node) & Node.DOCUMENT_POSITION_FOLLOWING);
  return first ? first.start : null;
}

/** A DOM Range for the global offsets `start..end`, or null when the index has no text there. */
export function rangeFor(index: TextIndex, start: number, end: number): Range | null {
  const at = (offset: number, endSide: boolean): [Text, number] | null => {
    for (let i = index.nodes.length - 1; i >= 0; i--) {
      const e = index.nodes[i]!;
      const within = endSide ? offset > e.start || (offset === e.start && i === 0) : offset >= e.start;
      if (within && offset <= e.start + e.node.data.length) return [e.node, offset - e.start];
    }
    return null;
  };
  const s = at(start, false);
  const e = at(end, true);
  if (!s || !e) return null;
  const range = document.createRange();
  range.setStart(s[0], s[1]);
  range.setEnd(e[0], e[1]);
  return range;
}

/** The current selection as global offsets in the index, when it lies inside the root. */
export function selectionIn(index: TextIndex): { start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const r = sel.getRangeAt(0);
  if (!index.root.contains(r.startContainer) || !index.root.contains(r.endContainer)) return null;
  const start = offsetOf(index, r.startContainer, r.startOffset);
  const end = offsetOf(index, r.endContainer, r.endOffset);
  if (start === null || end === null || end <= start) return null;
  return { start, end };
}

// The CSS Custom Highlight API; typed here because lib.dom may lag behind.
type HighlightLike = { add(range: AbstractRange): void; clear(): void };
type HighlightRegistry = { set(name: string, h: HighlightLike): void; delete(name: string): boolean };
declare const Highlight: { new (...ranges: AbstractRange[]): HighlightLike } | undefined;

/** Paint `ranges` under the highlight `name` (styled with `::highlight(name)`); a no-op where unsupported. */
export function paint(name: string, ranges: Range[]): void {
  const registry = (CSS as unknown as { highlights?: HighlightRegistry }).highlights;
  if (!registry || typeof Highlight === "undefined") return;
  registry.set(name, new Highlight(...ranges));
}

export function unpaint(name: string): void {
  (CSS as unknown as { highlights?: HighlightRegistry }).highlights?.delete(name);
}

/** The DOM point under a click, for finding the highlight that was clicked. */
export function pointAt(x: number, y: number): { node: Node; offset: number } | null {
  const d = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (d.caretPositionFromPoint) {
    const p = d.caretPositionFromPoint(x, y);
    return p ? { node: p.offsetNode, offset: p.offset } : null;
  }
  const r = d.caretRangeFromPoint?.(x, y);
  return r ? { node: r.startContainer, offset: r.startOffset } : null;
}
