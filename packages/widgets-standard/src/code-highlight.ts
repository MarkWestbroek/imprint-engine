import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

/**
 * Server-side syntax highlighting for the code widget (shiki, MIT). A fixed
 * set of grammars is bundled explicitly — the JavaScript regex engine needs
 * no WASM, so the bundle stays plain ESM — and the highlighter is built once
 * per process. Colours come as inline styles for a light and a dark theme,
 * switched by the page's `color-scheme` via CSS `light-dark()`; the site
 * needs no extra stylesheet.
 */

import { CODE_LANGUAGES, type CodeLanguage } from "./schemas";
export { CODE_LANGUAGES, type CodeLanguage };

const GRAMMARS: Record<Exclude<CodeLanguage, "text">, () => Promise<unknown>> = {
  typescript: () => import("@shikijs/langs/typescript"),
  tsx: () => import("@shikijs/langs/tsx"),
  javascript: () => import("@shikijs/langs/javascript"),
  json: () => import("@shikijs/langs/json"),
  bash: () => import("@shikijs/langs/bash"),
  css: () => import("@shikijs/langs/css"),
  html: () => import("@shikijs/langs/html"),
  sql: () => import("@shikijs/langs/sql"),
  python: () => import("@shikijs/langs/python"),
  go: () => import("@shikijs/langs/go"),
  rust: () => import("@shikijs/langs/rust"),
  c: () => import("@shikijs/langs/c"),
  yaml: () => import("@shikijs/langs/yaml"),
  markdown: () => import("@shikijs/langs/markdown"),
  diff: () => import("@shikijs/langs/diff"),
  mermaid: () => import("@shikijs/langs/mermaid"),
};

let core: Promise<HighlighterCore> | null = null;
function highlighter(): Promise<HighlighterCore> {
  core ??= createHighlighterCore({
    themes: [import("@shikijs/themes/github-light"), import("@shikijs/themes/github-dark")],
    // The grammar modules are shiki's own LanguageRegistration bundles.
    langs: Object.values(GRAMMARS).map((load) => load() as never),
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  });
  return core;
}

/** Highlighted `<pre class="shiki">…</pre>` HTML; plain escaped text for "text". */
export async function highlightCode(code: string, language: CodeLanguage): Promise<string> {
  const h = await highlighter();
  return h.codeToHtml(code, {
    lang: language === "text" ? "text" : language,
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: "light-dark()",
  });
}
