/**
 * The widget `drie-eenheid` (schema in src/widgets/registry.ts): processes,
 * data and rules, the three aspects that together are the basis of how an
 * enterprise functions. Drawn as an equilateral triangle, processes at the
 * top, data bottom left and rules bottom right (the same arrangement as the
 * Common Ground role banner), with along each side what the two have to do
 * with each other. Around it a ring with what surrounds that basis: on top
 * what the organisation itself aims for (services, flanked by goals and
 * vision), below what comes from outside (the task at hand, external rules
 * and constraints). Beside it one short text per aspect. Plain SVG and CSS
 * (`.de-*` in globals.css), no client code.
 */
export type DrieEenheidProps = {
  kop?: string;
  intro?: string;
  /** Bottom left, top, bottom right; each with the notation it is modelled in. */
  gegevens: Punt;
  processen: Punt;
  regels: Punt;
  /** Along the sides: processes–data (left), rules–data (bottom), processes–rules (right). */
  verbandProcessenGegevens?: string;
  verbandRegelsGegevens?: string;
  verbandProcessenRegels?: string;
  /** Around the triangle, clockwise from the top. With five: top, top right, bottom right, bottom left, top left; a sixth goes bottom centre. */
  omgeving?: string[];
};
type Punt = { titel: string; tekst?: string; notatie?: string };

const CX = 380;
const CY = 275;
const RING = 245;

/** The corners of the equilateral triangle: processes on top, data bottom left, rules bottom right. */
const BOVEN = { x: 380, y: 145 };
const LINKS = { x: 270, y: 335 };
const RECHTS = { x: 490, y: 335 };

/**
 * The angles (degrees, 0 = right, clockwise) of the surrounding labels. Five
 * and six get a fixed arrangement: three on top round the centre, the rest
 * below; other counts are spread evenly from the top.
 */
const INDELING: Record<number, number[]> = {
  5: [-90, -40, 50, 130, 220],
  6: [-90, -40, 40, 90, 140, 220],
};

/** A long label goes on two lines, split at the space nearest its middle. */
function lijnenVan(naam: string): string[] {
  if (naam.length <= 16) return [naam];
  const spaties = [...naam.matchAll(/ /g)].map((m) => m.index);
  if (!spaties.length) return [naam];
  const half = naam.length / 2;
  const midden = spaties.reduce((a, b) => (Math.abs(b - half) < Math.abs(a - half) ? b : a));
  return [naam.slice(0, midden), naam.slice(midden + 1)];
}

/** Where the i-th of n surrounding labels goes, and how it is anchored. */
function plek(i: number, n: number, lijnen: number) {
  const graden = INDELING[n]?.[i] ?? -90 + (i * 360) / n;
  const hoek = (graden * Math.PI) / 180;
  const cos = Math.cos(hoek);
  const sin = Math.sin(hoek);
  const anchor = Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end";
  // Above the ring a label sits on its (last) baseline, below it hangs; at the sides it is centred on the point.
  const hoogte = (lijnen - 1) * 24;
  const dy = sin < -0.5 ? -4 - hoogte : sin > 0.5 ? 18 : 5 - hoogte / 2;
  return { x: Math.round(CX + (RING + 20) * cos), y: Math.round(CY + (RING + 20) * sin + dy), anchor } as const;
}

export function DrieEenheid(props: DrieEenheidProps) {
  const { kop, intro, gegevens, processen, regels, omgeving = [] } = props;
  // The list beside it follows the drawing: top, then left, then right.
  const punten: [string, Punt][] = [
    ["processen", processen],
    ["gegevens", gegevens],
    ["regels", regels],
  ];
  const label = [`${processen.titel}, ${gegevens.titel} en ${regels.titel}, elk verbonden met de andere twee`, omgeving.length ? `daaromheen: ${omgeving.join(", ")}` : ""].filter(Boolean).join("; ");
  return (
    <section className="de">
      {kop ? <h2 className="de-kop">{kop}</h2> : null}
      {intro ? <p className="de-intro">{intro}</p> : null}
      <div className="de-rij">
        <svg className="de-beeld" viewBox="-60 -25 880 630" role="img" aria-label={label}>
          {omgeving.length > 0 ? <circle className="de-ring" cx={CX} cy={CY} r={RING} /> : null}
          {omgeving.map((naam, i) => {
            const lijnen = lijnenVan(naam);
            const p = plek(i, omgeving.length, lijnen.length);
            return (
              <text key={naam} className="de-omgeving" x={p.x} y={p.y} textAnchor={p.anchor}>
                {lijnen.map((tekst, j) => (
                  <tspan key={j} x={p.x} dy={j === 0 ? 0 : 24}>
                    {tekst}
                  </tspan>
                ))}
              </text>
            );
          })}
          <path className="de-lijn" d={`M ${BOVEN.x} ${BOVEN.y} L ${LINKS.x} ${LINKS.y} L ${RECHTS.x} ${RECHTS.y} Z`} />
          <circle className="de-punt de-processen" cx={BOVEN.x} cy={BOVEN.y} r="11" />
          <circle className="de-punt de-gegevens" cx={LINKS.x} cy={LINKS.y} r="11" />
          <circle className="de-punt de-regels" cx={RECHTS.x} cy={RECHTS.y} r="11" />
          <text className="de-naam" x={BOVEN.x} y={BOVEN.y - 24} textAnchor="middle">
            {processen.titel}
          </text>
          <text className="de-naam" x={LINKS.x} y={LINKS.y + 39} textAnchor="middle">
            {gegevens.titel}
          </text>
          <text className="de-naam" x={RECHTS.x} y={RECHTS.y + 39} textAnchor="middle">
            {regels.titel}
          </text>
          {props.verbandProcessenGegevens ? (
            <text className="de-verband" x="312" y="245" textAnchor="end">
              {props.verbandProcessenGegevens}
            </text>
          ) : null}
          {props.verbandProcessenRegels ? (
            <text className="de-verband" x="448" y="245" textAnchor="start">
              {props.verbandProcessenRegels}
            </text>
          ) : null}
          {props.verbandRegelsGegevens ? (
            <text className="de-verband" x="380" y="322" textAnchor="middle">
              {props.verbandRegelsGegevens}
            </text>
          ) : null}
        </svg>
        <dl className="de-lijst">
          {punten.map(([soort, punt]) => (
            <div key={soort} className={`de-item de-${soort}`}>
              <dt>
                <span className="de-stip" aria-hidden="true" />
                {punt.titel}
                {punt.notatie ? <span className="de-notatie">{punt.notatie}</span> : null}
              </dt>
              {punt.tekst ? <dd>{punt.tekst}</dd> : null}
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
