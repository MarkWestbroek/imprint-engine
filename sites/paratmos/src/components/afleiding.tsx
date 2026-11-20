import Link from "next/link";

/**
 * The widget `afleiding` (schema in src/widgets/registry.ts): one model drawn
 * as a class, and beside it what is derived from it, each on a line from the
 * model. The picture of the site's message: the model is the source, the
 * interfaces, the schema and the documentation follow from it. Plain HTML and
 * CSS (`.afl-*` in globals.css), no client code.
 */
export type AfleidingProps = {
  kop?: string;
  /** The heading is the title of the page (h1) instead of a section heading (h2). */
  alsTitel?: boolean;
  intro?: string;
  model: { stereotype?: string; naam: string; attributen: string[] };
  afgeleiden: { label?: string; titel: string; tekst?: string; url?: string }[];
};

export function Afleiding({ kop, alsTitel, intro, model, afgeleiden }: AfleidingProps) {
  const Kop = alsTitel ? "h1" : "h2";
  return (
    <section className="afl">
      {kop ? <Kop className="afl-kop">{kop}</Kop> : null}
      {intro ? <p className="afl-intro">{intro}</p> : null}
      <div className="afl-diagram">
        <div className="afl-model">
          <div className="afl-model-naam">
            {model.stereotype ? <span className="afl-stereo">«{model.stereotype}»</span> : null}
            <span className="afl-naam">{model.naam}</span>
          </div>
          {model.attributen.length > 0 ? (
            <ul className="afl-attrs">
              {model.attributen.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="afl-stam" aria-hidden="true" />
        <ul className="afl-uit" aria-label={`Afgeleid uit ${model.naam}`}>
          {afgeleiden.map((item) => {
            const inhoud = (
              <>
                {item.label ? <span className="afl-label">{item.label}</span> : null}
                <span className="afl-titel">{item.titel}</span>
                {item.tekst ? <span className="afl-tekst">{item.tekst}</span> : null}
              </>
            );
            return (
              <li key={item.titel} style={{ display: "contents" }}>
                {item.url ? (
                  <Link href={item.url} className="afl-item">
                    {inhoud}
                  </Link>
                ) : (
                  <div className="afl-item">{inhoud}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
