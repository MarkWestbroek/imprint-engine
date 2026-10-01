/**
 * Anchoring a segment in text (design/annotaties.md §3): pure functions over
 * a string, so the same code runs in tests, in the browser (against the
 * rendered text of the current version) and later on the server (against a
 * stored version). The W3C model's advice is followed: describe a segment
 * with a TextQuoteSelector (exact + context) *and* a TextPositionSelector;
 * find it again by the quote, use the context and the position to choose
 * between several occurrences, and give up (an orphan) rather than guess.
 */

export type TextQuote = { type: "TextQuoteSelector"; exact: string; prefix?: string; suffix?: string };
export type TextPosition = { type: "TextPositionSelector"; start: number; end: number };
export type Selector = TextQuote | TextPosition | { type: string; [k: string]: unknown };

/** Characters of context kept on each side of a quote. */
export const CONTEXT = 32;

/** Describe the segment `start..end` of `text` as the two selectors. */
export function describe(text: string, start: number, end: number): [TextQuote, TextPosition] {
  return [
    {
      type: "TextQuoteSelector",
      exact: text.slice(start, end),
      prefix: text.slice(Math.max(0, start - CONTEXT), start),
      suffix: text.slice(end, end + CONTEXT),
    },
    { type: "TextPositionSelector", start, end },
  ];
}

/** The length of the common ending of `a` and `b`. */
function commonSuffix(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
}

/** The length of the common beginning of `a` and `b`. */
function commonPrefix(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

/**
 * Find the segment the selectors describe in `text`: the quote must occur
 * literally; among several occurrences the one whose surroundings match the
 * stored context best wins, and the stored position breaks a tie. No quote
 * (or an empty one) and the position alone is trusted only when the text
 * there still reads the same — which it cannot without a quote, so that
 * case is an orphan too.
 */
export function anchor(text: string, selectors: Selector[]): { start: number; end: number } | null {
  const quote = selectors.find((s): s is TextQuote => s.type === "TextQuoteSelector" && typeof (s as TextQuote).exact === "string");
  const position = selectors.find((s): s is TextPosition => s.type === "TextPositionSelector");
  if (!quote || !quote.exact) return null;
  const hits: number[] = [];
  for (let i = text.indexOf(quote.exact); i !== -1; i = text.indexOf(quote.exact, i + 1)) hits.push(i);
  if (hits.length === 0) return null;
  if (hits.length === 1) return { start: hits[0]!, end: hits[0]! + quote.exact.length };
  let best = hits[0]!;
  let bestScore = -Infinity;
  for (const i of hits) {
    const before = text.slice(Math.max(0, i - CONTEXT), i);
    const after = text.slice(i + quote.exact.length, i + quote.exact.length + CONTEXT);
    const context = commonSuffix(before, quote.prefix ?? "") + commonPrefix(after, quote.suffix ?? "");
    const distance = position ? Math.abs(i - position.start) : 0;
    const score = context * 1000 - distance;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return { start: best, end: best + quote.exact.length };
}

/** The quote of a target's selectors, for showing an orphan or a balloon. */
export function quoteOf(selectors: Selector[]): string {
  const q = selectors.find((s): s is TextQuote => s.type === "TextQuoteSelector");
  return q?.exact ?? "";
}
