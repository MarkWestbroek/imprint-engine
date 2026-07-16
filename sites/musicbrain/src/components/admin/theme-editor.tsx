"use client";

/**
 * Colour-picker editor for themes: each design token gets a picker + hex
 * field, plus optional font-stack overrides. Live preview strip at the
 * bottom shows the palette in context.
 */

const TOKENS: { key: string; label: string }[] = [
  { key: "background", label: "Background" },
  { key: "surface", label: "Surface (cards)" },
  { key: "border", label: "Border" },
  { key: "foreground", label: "Text" },
  { key: "muted", label: "Muted text" },
  { key: "accent", label: "Accent" },
  { key: "accentStrong", label: "Accent (strong)" },
];

type Colors = Record<string, string>;
type Fonts = { sans?: string; mono?: string };

export function ThemeEditor({
  colors,
  fonts,
  onColors,
  onFonts,
}: {
  colors: Colors;
  fonts: Fonts;
  onColors: (colors: Colors) => void;
  onFonts: (fonts: Fonts) => void;
}) {
  const set = (key: string, value: string) => onColors({ ...colors, [key]: value });
  const isHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {TOKENS.map(({ key, label }) => {
          const value = colors[key] ?? "#000000";
          return (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="color"
                value={isHex(value) ? value : "#000000"}
                onChange={(e) => set(key, e.target.value)}
                className="h-8 w-10 cursor-pointer rounded border border-line bg-transparent"
              />
              <input
                value={value}
                onChange={(e) => set(key, e.target.value)}
                className="w-24 rounded-md border border-line bg-background px-2 py-1 font-mono text-xs"
              />
              <span className="text-xs text-muted">{label}</span>
            </label>
          );
        })}
      </div>

      <details className="rounded-lg border border-line px-3 py-2 text-sm">
        <summary className="cursor-pointer text-muted">Fonts (optioneel)</summary>
        <div className="mt-2 space-y-2">
          <label className="block">
            <span className="block text-xs font-medium uppercase tracking-wide text-muted">
              sans-stack (leeg = site-default)
            </span>
            <input
              className="mt-1 w-full rounded-md border border-line bg-background px-2 py-1 font-mono text-xs"
              placeholder="bijv. Georgia, serif"
              value={fonts.sans ?? ""}
              onChange={(e) => onFonts({ ...fonts, sans: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium uppercase tracking-wide text-muted">
              mono-stack (leeg = site-default)
            </span>
            <input
              className="mt-1 w-full rounded-md border border-line bg-background px-2 py-1 font-mono text-xs"
              value={fonts.mono ?? ""}
              onChange={(e) => onFonts({ ...fonts, mono: e.target.value })}
            />
          </label>
        </div>
      </details>

      {/* Live palette preview */}
      <div
        className="rounded-xl border p-4"
        style={{ background: colors.background, borderColor: colors.border }}
      >
        <div
          className="rounded-lg border p-3"
          style={{ background: colors.surface, borderColor: colors.border }}
        >
          <p className="text-sm font-semibold" style={{ color: colors.foreground }}>
            Preview — zo oogt dit thema
          </p>
          <p className="text-xs" style={{ color: colors.muted }}>
            Gedempte tekst, en een{" "}
            <span style={{ color: colors.accent }}>accentkleur</span> met een{" "}
            <span
              className="rounded px-1.5 py-0.5 text-xs font-semibold"
              style={{ background: colors.accent, color: colors.background }}
            >
              knop
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
