import Link from "next/link";

/**
 * The widget `doorbraak` (schema in src/widgets/registry.ts): the opening of
 * the home page. The brand's picture, "Doorbraak" (merkrichtlijnen §2), drawn
 * large on ink: the arc of the atmosphere as a horizon, and one straight
 * course that breaks through it to a beacon beyond. Below the arc the course
 * is light (the concrete work), above it blue (no limits). Beside it only a
 * heading, one line and one button.
 *
 * An illustration after the mark, not the logo itself: same angle and colours,
 * other proportions. The arc runs far outside the viewBox, so it reaches the
 * edges of the screen at any width. Styles: `.db-*` in globals.css.
 */
export type DoorbraakProps = {
  kop: string;
  tekst?: string;
  knopLabel?: string;
  knopUrl?: string;
  /** Small labels along the course: at its foot, on the arc, at the beacon. */
  labelVoet?: string;
  labelBoog?: string;
  labelBaken?: string;
};

export function Doorbraak({ kop, tekst, knopLabel, knopUrl, labelVoet, labelBoog, labelBaken }: DoorbraakProps) {
  return (
    <section className="db">
      <svg className="db-beeld" viewBox="0 0 1200 520" preserveAspectRatio="xMaxYMid meet" aria-hidden="true">
        {/* The atmosphere: a circle of radius 800 around (1100, 1084). It crosses the course at (860, 321) and drops away to the left, under the text. */}
        <path className="db-boog" d="M 300 1084 A 800 800 0 0 1 1900 1084" />
        <path className="db-koers db-koers-onder" d="M 783 450 L 860 321" pathLength={1} />
        <path className="db-koers db-koers-boven" d="M 860 321 L 999 90" pathLength={1} />
        <circle className="db-voet" cx="783" cy="450" r="5" />
        <circle className="db-baken" cx="999" cy="90" r="11" />
        {labelVoet ? (
          <text className="db-label" x="803" y="456">
            {labelVoet}
          </text>
        ) : null}
        {labelBoog ? (
          <text className="db-label db-label-boog" x="902" y="282">
            {labelBoog}
          </text>
        ) : null}
        {labelBaken ? (
          <text className="db-label db-label-baken" x="1024" y="96">
            {labelBaken}
          </text>
        ) : null}
      </svg>
      <div className="pm-container db-tekst">
        <h1 className="db-kop">{kop}</h1>
        {tekst ? <p className="db-sub">{tekst}</p> : null}
        {knopLabel && knopUrl ? (
          <Link href={knopUrl} className="db-knop">
            {knopLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
