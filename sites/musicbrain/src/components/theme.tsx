import type { Theme } from "@imprint/content-core";
import { ThemeSwitcher } from "./theme-switcher";

/**
 * Theming: a theme is content (design tokens as data); this renders every
 * theme as CSS custom properties on `[data-theme="<name>"]`. Components only
 * ever use token classes (bg-background, text-accent, …), so switching the
 * attribute restyles the whole site instantly — the `:root` values in
 * globals.css stay the no-JS/default fallback.
 */
export function ThemeStyles({ themes }: { themes: Theme[] }) {
  const css = themes
    .map((t) => {
      const c = t.colors;
      const fonts = [
        t.fonts.sans && `--font-sans:${t.fonts.sans};`,
        t.fonts.mono && `--font-mono:${t.fonts.mono};`,
      ]
        .filter(Boolean)
        .join("");
      return (
        `[data-theme="${t.name}"]{` +
        `--background:${c.background};--surface:${c.surface};--border:${c.border};` +
        `--foreground:${c.foreground};--muted:${c.muted};--accent:${c.accent};` +
        `--accent-strong:${c.accentStrong};${fonts}}`
      );
    })
    .join("\n");
  return <style>{css}</style>;
}

/**
 * Applies the saved choice before first paint (inline, blocking, at the top
 * of <body>) so there's no flash of the default theme.
 */
export function ThemeInit() {
  const js =
    "try{var t=localStorage.getItem('imprint-theme');" +
    "if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}";
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}

export { ThemeSwitcher };
