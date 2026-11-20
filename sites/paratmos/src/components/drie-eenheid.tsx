/**
 * The widget `drie-eenheid` (schema in src/widgets/registry.ts): data,
 * processes and rules, the three aspects that together are the basis of how
 * an enterprise functions. Drawn as a triangle with the three at its corners
 * and, along each side, what the two have to do with each other. Around it a
 * ring with what surrounds that basis: the services, the vision, the goals,
 * and what comes from outside (rules, constraints, the task at hand). Beside
 * it one short text per aspect. Plain SVG and CSS (`.de-*` in globals.css),
 * no client code.
 */
export type DrieEenheidProps = {
  kop?: string;
  intro?: string;
  /** Top, bottom left, bottom right; each with the notation it is modelled in. */
  gegevens: Punt;
  processen: Punt;
  regels: Punt;
  /** Along the sides: processes–data, rules–data, processes–rules. */
  verbandProcessenGegevens?: string;
  verbandRegelsGegevens?: string;
  verbandProcessenRegels?: string;
  /** Around the triangle, clockwise from the top; the first is centred above the ring, so the longest goes there. */
  omgeving?: string[];
};
type Punt = { titel: string; tekst?: string; notatie?: string };

const CX = 380;
const CY = 275;
const RING = 245;

/** Where the i-th of n surrounding labels goes: evenly round the ring, starting at the top. */
function plek(i: number, n: number) {
  const hoek = ((-90 + (i * 360) / n) * Math.PI) / 180;
  const cos = Math.cos(hoek);
  const sin = Math.sin(hoek);
  const anchor = Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end";
  // Above the ring a label sits on its baseline, below it hangs; at the sides it is centred on the point.
  const dy = sin < -0.9 ? -4 : sin > 0.9 ? 18 : 5;
  return { x: Math.round(CX + (RING + 20) * cos), y: Math.round(CY + (RING + 20) * sin + dy), anchor } as const;
}

export function DrieEenheid(props: DrieEenheidProps) {
  const { kop, intro, gegevens, processen, regels, omgeving = [] } = props;
  const punten: [string, Punt][] = [
    ["gegevens", gegevens],
    ["processen", processen],
    ["regels", regels],
  ];
  const label = [`${gegevens.titel}, ${processen.titel} en ${regels.titel}, elk verbonden met de andere twee`, omgeving.length ? `daaromheen: ${omgeving.join(", ")}` : ""].filter(Boolean).join("; ");
  return (
    <section className="de">
      {kop ? <h2 className="de-kop">{kop}</h2> : null}
      {intro ? <p className="de-intro">{intro}</p> : null}
      <div className="de-rij">
        <svg className="de-beeld" viewBox="-60 -25 880 580" role="img" aria-label={label}>
          {omgeving.length > 0 ? <circle className="de-ring" cx={CX} cy={CY} r={RING} /> : null}
          {omgeving.map((naam, i) => {
            const p = plek(i, omgeving.length);
            return (
              <text key={naam} className="de-omgeving" x={p.x} y={p.y} textAnchor={p.anchor}>
                {naam}
              </text>
            );
          })}
          <path className="de-lijn" d="M 380 160 L 270 335 L 490 335 Z" />
          <circle className="de-punt de-gegevens" cx="380" cy="160" r="11" />
          <circle className="de-punt de-processen" cx="270" cy="335" r="11" />
          <circle className="de-punt de-regels" cx="490" cy="335" r="11" />
          <text className="de-naam" x="380" y="136" textAnchor="middle">
            {gegevens.titel}
          </text>
          <text className="de-naam" x="270" y="374" textAnchor="middle">
            {processen.titel}
          </text>
          <text className="de-naam" x="490" y="374" textAnchor="middle">
            {regels.titel}
          </text>
          {props.verbandProcessenGegevens ? (
            <text className="de-verband" x="312" y="250" textAnchor="end">
              {props.verbandProcessenGegevens}
            </text>
          ) : null}
          {props.verbandRegelsGegevens ? (
            <text className="de-verband" x="448" y="250" textAnchor="start">
              {props.verbandRegelsGegevens}
            </text>
          ) : null}
          {props.verbandProcessenRegels ? (
            <text className="de-verband" x="380" y="322" textAnchor="middle">
              {props.verbandProcessenRegels}
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
