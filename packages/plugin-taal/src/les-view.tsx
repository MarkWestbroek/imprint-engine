import { audioKaart, zinKey, type AudioKaart, type Stemmen } from "./audio";
import { teksten, type Teksten } from "./i18n";
import { Oefeningen } from "./oefeningen";
import { metVertaling, oefeningenVoor } from "./lessen";
import type { Les } from "./schemas";
import { Speak } from "./speak";

/**
 * The server halves of the two widgets: they read the lesson's recordings and
 * the interface texts and hand both to the client parts as plain props.
 */

function Zin({ text, lang, audio, t }: { text: string; lang: string; audio: AudioKaart; t: Teksten }) {
  return <Speak text={text} lang={lang} audio={audio[zinKey(lang, text)]} labels={{ speel: t.speel, langzaam: t.langzaam }} />;
}

/** The dialogue as a table: the sentence with its play buttons, and the translation beside it. */
export function Lesdialoog({ les, ui, stemmen, brokken = true }: { les: Les; ui: string; stemmen?: Stemmen; brokken?: boolean }) {
  const t = teksten(ui);
  const audio = audioKaart(les, stemmen);
  const vertaald = metVertaling(les, ui);
  const steun = les.steuntaal ?? "";
  return (
    <div className="space-y-6">
      {les.dialoog.length > 0 && (
        <table className="w-full border-collapse">
          <caption className="sr-only">{t.dialoog}</caption>
          <tbody>
            {les.dialoog.map((regel, i) => (
              <tr key={i} className="border-b border-line align-top">
                <td className="py-3 pr-3">
                  <Zin text={regel[les.taal] ?? ""} lang={les.taal} audio={audio} t={t} />
                </td>
                <td className="py-3 pr-4 text-lg font-medium" lang={les.taal}>
                  {regel[les.taal]}
                </td>
                {vertaald && (
                  <td className="py-3 text-muted" lang={steun}>
                    {regel[steun]}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {brokken && les.brokken.length > 0 && (
        <section>
          <h3 className="eyebrow mb-3">{t.brokken}</h3>
          <ul className="flex flex-wrap gap-2">
            {les.brokken.map((brok) => (
              <li key={brok} className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-4 pr-1">
                <span lang={les.taal}>{brok}</span>
                <Zin text={brok} lang={les.taal} audio={audio} t={t} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** The exercises of a lesson, for this interface language. */
export function LesOefeningen({ les, ui, stemmen }: { les: Les; ui: string; stemmen?: Stemmen }) {
  const lijst = oefeningenVoor(les, ui);
  if (lijst.length === 0) return null;
  return <Oefeningen lesId={les.id} taal={les.taal} oefeningen={lijst} audio={audioKaart(les, stemmen)} t={teksten(ui)} />;
}
