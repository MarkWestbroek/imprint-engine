import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ReactElement } from "react";

/**
 * Render harness for the characterisation of the public renderer (Fase 2).
 * Renders the real engine renderer with this site's real viewers, DefaultView
 * and SiteChrome to static HTML in plain Node, with React's own prerenderer
 * (async server components included).
 *
 * Content reaches the viewers through the WidgetContext the test builds, so no
 * module has to be swapped out. The one seam left is global `fetch` (album
 * and api widgets), replaced by canned responses: no network.
 */

export const SITE_DIR = path.resolve(import.meta.dirname, "../..");
const GOLDEN_DIR = path.join(import.meta.dirname, "__golden__");

export type CannedResponse = { status?: number; body: string; url?: string };

/** URLs a widget asked for that no canned response covers (should stay empty). */
export const unexpectedFetches: string[] = [];

export function installFetchMock(responses: Record<string, CannedResponse>): void {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const canned = responses[url];
    if (!canned) {
      unexpectedFetches.push(url);
      throw new Error(`no canned response for ${url}`);
    }
    const res = new Response(canned.body, { status: canned.status ?? 200 });
    // A real fetch reports the final URL after redirects; the Lightroom
    // loader reads it, so make the canned one say where it "ended up".
    Object.defineProperty(res, "url", { value: canned.url ?? url });
    return res;
  }) as typeof fetch;
}

/** Prerender to a complete HTML string; any render error fails the call. */
export async function renderHtml(element: ReactElement): Promise<string> {
  const { prerenderToNodeStream } = await import("react-dom/static");
  const errors: unknown[] = [];
  const { prelude } = await prerenderToNodeStream(element, {
    onError: (error) => {
      errors.push(error);
    },
  });
  let html = "";
  for await (const chunk of prelude) html += chunk;
  if (errors.length > 0) throw errors[0];
  return html;
}

/**
 * One element per line, so a golden diff points at the changed element
 * instead of one endless line. The footer year is the only clock-dependent
 * output; it is neutralised. React separates adjacent text with `<!-- -->`
 * ("© <!-- -->2026"), so the pattern allows for that marker.
 */
export function formatHtml(html: string): string {
  return html.replace(/></g, ">\n<").replace(/(© (?:<!-- -->)?)\d{4}/g, "$1YYYY");
}

/**
 * Compare against `__golden__/<name>.html`. `UPDATE_GOLDEN=1` (re)writes the
 * file instead — do that only when a rendering change is intended, and review
 * the golden diff like any other code change.
 */
export async function expectGolden(name: string, actual: string): Promise<void> {
  const file = path.join(GOLDEN_DIR, `${name}.html`);
  const rel = path.relative(SITE_DIR, file);
  const content = actual.endsWith("\n") ? actual : `${actual}\n`;
  if (process.env.UPDATE_GOLDEN) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content, "utf8");
    return;
  }
  let expected: string;
  try {
    // A Windows checkout (core.autocrlf) has CRLF on disk; the renderer speaks LF.
    expected = (await fs.readFile(file, "utf8")).replace(/\r\n/g, "\n");
  } catch {
    assert.fail(`golden file ${rel} is missing — run: UPDATE_GOLDEN=1 npm test --workspace=musicbrain`);
  }
  assert.equal(content, expected, `rendered HTML differs from ${rel}`);
}
