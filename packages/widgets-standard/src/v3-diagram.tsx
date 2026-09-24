/**
 * The V3 metamodel (docs/design/v3-metamodel-spec.md) as a diagram: one card
 * per entity in its domain's colour, fields listed inside, relations as
 * arrows. Cards sit on their `positie` when the model carries layout (the
 * Omnium UML editor writes it); otherwise they are laid out per domain in a
 * grid. Pure server-side SVG, no library.
 */

export type V3Field = { naam: string; type?: string; format?: string; verplicht?: boolean };
export type V3Relation = { naam?: string; doelEntiteit: string; doelKardinaliteit?: string };
export type V3Entity = {
  typenaam: string;
  domein?: string;
  isAbstract?: boolean;
  erft?: string;
  positie?: { x: number; y: number };
  gegevenselementen?: { naam: string; momentvoorkomen?: string; velden?: V3Field[] }[];
  relaties?: V3Relation[];
};
export type V3Model = {
  naam?: string;
  domeinen?: { naam: string; kleur?: string; beschrijving?: string }[];
  entiteiten?: V3Entity[];
};

const CARD_W = 220;
const LINE_H = 15;
const HEAD_H = 30;
const MAX_FIELDS = 8;
const GAP_X = 40;
const GAP_Y = 30;
const BAND_HEAD = 28;
const PAD = 20;
const FALLBACK = "#6b7280";

type Rect = { x: number; y: number; w: number; h: number };
type Card = { entity: V3Entity; lines: string[]; more: number; color: string } & Rect;

function fieldLines(entity: V3Entity): string[] {
  const groups = entity.gegevenselementen ?? [];
  const lines: string[] = [];
  for (const g of groups) {
    const many = g.momentvoorkomen === "meervoudig";
    for (const f of g.velden ?? []) {
      const prefix = groups.length > 1 ? `${g.naam}.` : "";
      const t = f.format ?? f.type ?? "";
      lines.push(`${prefix}${f.naam}${many ? "[]" : ""}${f.verplicht ? "*" : ""}${t ? `: ${t}` : ""}`);
    }
  }
  return lines;
}

/** The point where a line from the rect's centre towards `to` leaves the rect. */
function edgePoint(r: Rect, to: { x: number; y: number }): { x: number; y: number } {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const dx = to.x - cx;
  const dy = to.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const sx = dx === 0 ? Infinity : r.w / 2 / Math.abs(dx);
  const sy = dy === 0 ? Infinity : r.h / 2 / Math.abs(dy);
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}

export function layoutV3(model: V3Model, showFields: boolean): { cards: Card[]; bands: { label: string; color: string; y: number }[]; width: number; height: number } {
  const domains = model.domeinen ?? [];
  const colorOf = (name?: string) => domains.find((d) => d.naam === name)?.kleur ?? FALLBACK;
  const entities = model.entiteiten ?? [];
  const cards: Card[] = entities.map((entity) => {
    const all = showFields ? fieldLines(entity) : [];
    const lines = all.slice(0, MAX_FIELDS);
    const more = all.length - lines.length;
    const h = HEAD_H + (lines.length + (more > 0 ? 1 : 0)) * LINE_H + (lines.length > 0 || more > 0 ? 8 : 0);
    return { entity, lines, more, color: colorOf(entity.domein), x: 0, y: 0, w: CARD_W, h };
  });

  const positioned = cards.length > 0 && cards.every((c) => c.entity.positie);
  const bands: { label: string; color: string; y: number }[] = [];
  let width = 0;
  let height = 0;

  if (positioned) {
    for (const c of cards) {
      c.x = c.entity.positie!.x;
      c.y = c.entity.positie!.y;
      width = Math.max(width, c.x + c.w + PAD);
      height = Math.max(height, c.y + c.h + PAD);
    }
  } else {
    // Per domain a band; inside it a grid of at most four columns.
    const order = [...domains.map((d) => d.naam)];
    for (const c of cards) if (!order.includes(c.entity.domein ?? "")) order.push(c.entity.domein ?? "");
    let y = PAD;
    for (const domain of order) {
      const members = cards.filter((c) => (c.entity.domein ?? "") === domain);
      if (members.length === 0) continue;
      const cols = Math.min(4, Math.ceil(Math.sqrt(members.length)));
      bands.push({ label: domain || "—", color: colorOf(domain), y });
      y += BAND_HEAD;
      let rowH = 0;
      members.forEach((c, i) => {
        const col = i % cols;
        if (col === 0 && i > 0) {
          y += rowH + GAP_Y;
          rowH = 0;
        }
        c.x = PAD + col * (CARD_W + GAP_X);
        c.y = y;
        rowH = Math.max(rowH, c.h);
        width = Math.max(width, c.x + c.w + PAD);
      });
      y += rowH + GAP_Y + 10;
    }
    height = y;
  }
  return { cards, bands, width: Math.max(width, CARD_W + 2 * PAD), height: Math.max(height, 60) };
}

export function V3Diagram({
  model,
  showFields = true,
  maxWidth,
}: {
  model: V3Model;
  showFields?: boolean;
  maxWidth?: number;
}) {
  const { cards, bands, width, height } = layoutV3(model, showFields);
  const byName = new Map(cards.map((c) => [c.entity.typenaam, c]));
  const edges = cards.flatMap((from) =>
    [
      ...(from.entity.relaties ?? []).map((r) => ({ to: r.doelEntiteit, label: r.doelKardinaliteit ?? "", kind: "rel" as const })),
      ...(from.entity.erft ? [{ to: from.entity.erft, label: "", kind: "erft" as const }] : []),
    ].flatMap((e) => {
      const to = byName.get(e.to);
      if (!to || to === from) return [];
      const a = edgePoint(from, { x: to.x + to.w / 2, y: to.y + to.h / 2 });
      const b = edgePoint(to, { x: from.x + from.w / 2, y: from.y + from.h / 2 });
      return [{ a, b, label: e.label, kind: e.kind, key: `${from.entity.typenaam}-${e.to}-${e.kind}` }];
    })
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={{ maxWidth: maxWidth ? `${maxWidth}px` : undefined, height: "auto" }}
      className="text-foreground"
      role="img"
      aria-label={model.naam ?? "Model diagram"}
      fontFamily="ui-sans-serif, system-ui, sans-serif"
    >
      <defs>
        <marker id="v3-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="currentColor" />
        </marker>
        <marker id="v3-inherit" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="var(--color-surface, #fff)" stroke="currentColor" />
        </marker>
      </defs>
      {bands.map((b) => (
        <text key={b.label} x={PAD} y={b.y + 16} fontSize="12" fontWeight="600" fill={b.color} letterSpacing="0.08em">
          {b.label.toUpperCase()}
        </text>
      ))}
      {edges.map((e) => (
        <g key={e.key} stroke="currentColor" strokeOpacity={0.55}>
          <line x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y} markerEnd={e.kind === "erft" ? "url(#v3-inherit)" : "url(#v3-arrow)"} strokeDasharray={e.kind === "erft" ? "4 3" : undefined} />
          {e.label && (
            <text x={e.b.x + (e.a.x - e.b.x) * 0.15} y={e.b.y + (e.a.y - e.b.y) * 0.15 - 4} fontSize="10" fill="currentColor" stroke="none" opacity={0.8} textAnchor="middle">
              {e.label}
            </text>
          )}
        </g>
      ))}
      {cards.map((c) => (
        <g key={c.entity.typenaam} transform={`translate(${c.x} ${c.y})`}>
          <rect width={c.w} height={c.h} rx="6" fill="var(--color-surface, #fff)" stroke={c.color} strokeWidth="1.5" />
          <rect width={c.w} height={HEAD_H} rx="6" fill={c.color} fillOpacity={0.18} />
          <rect y={HEAD_H - 6} width={c.w} height={6} fill={c.color} fillOpacity={0.18} />
          <text x={c.w / 2} y={19} fontSize="13" fontWeight="600" textAnchor="middle" fill="currentColor" fontStyle={c.entity.isAbstract ? "italic" : undefined}>
            {c.entity.typenaam}
          </text>
          {c.lines.map((line, i) => (
            <text key={i} x={10} y={HEAD_H + 12 + i * LINE_H} fontSize="10.5" fill="currentColor" opacity={0.85} fontFamily="ui-monospace, monospace">
              {line}
            </text>
          ))}
          {c.more > 0 && (
            <text x={10} y={HEAD_H + 12 + c.lines.length * LINE_H} fontSize="10.5" fill="currentColor" opacity={0.6}>
              +{c.more} more…
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
