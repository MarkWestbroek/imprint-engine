import type { Theme } from "@imprint/content-core";

/**
 * Themes are content (the admin's Themes): each renders as CSS custom
 * properties on `[data-theme="<name>"]` — the colour tokens globals.css
 * builds the Common Ground look on, and `--content-width` for the width of
 * the page. The `:root` values in globals.css are the default without a choice.
 */
export function ThemeStyles({ themes }: { themes: Theme[] }) {
  const css = themes
    .map((t) => {
      const c = t.colors;
      return (
        `[data-theme="${t.name}"]{` +
        `--background:${c.background};--surface:${c.surface};--border:${c.border};` +
        `--foreground:${c.foreground};--muted:${c.muted};--accent:${c.accent};` +
        `--accent-strong:${c.accentStrong};--accent-2:${c.accent2 || c.accent};` +
        (t.layout.width ? `--content-width:${t.layout.width};` : "") +
        (t.fonts.sans ? `--font-sans:${t.fonts.sans};` : "") +
        "}"
      );
    })
    .join("\n");
  return <style>{css}</style>;
}

/** Applies the saved choice before first paint (inline, blocking), so there is no flash of the default. */
export function ThemeInit() {
  const js =
    "try{var t=localStorage.getItem('imprint-theme');" +
    "if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}";
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
