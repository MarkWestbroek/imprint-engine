import Link from "next/link";
import type { PluginScreenProps } from "@imprint/runtime-admin";
import type { AudioOverzicht } from "./actions";
import { AudioKnop } from "./audio-knop";

/**
 * `/admin/taal`: per lesson how many sentences have a recording, and the
 * button that makes the missing ones. The count and the characters are shown
 * before anything is asked of the speech service.
 */
export function taalScreen(audioStatus: (admin: PluginScreenProps["admin"]) => Promise<AudioOverzicht | null>) {
  return async function TaalScreen({ admin, path, call }: PluginScreenProps) {
    if (path.length > 0) return null;
    const overzicht = await audioStatus(admin);
    if (!overzicht) return <p className="text-sm text-muted">Alleen voor de redactie, met een database.</p>;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="text-2xl font-semibold">Audio van de lessen</h1>
          <Link href="/admin/les" className="text-sm text-muted hover:underline">
            Alle lessen als lijst →
          </Link>
        </div>
        <p className="max-w-2xl text-sm text-muted">
          Elke zin krijgt twee opnamen: normaal en langzaam. Alleen wat nog ontbreekt wordt aangevraagd; een zin die een
          andere les al heeft, wordt overgenomen. Zonder opname leest de browser de zin zelf voor.
        </p>
        {!overzicht.kan && (
          <p className="rounded-md border border-line bg-surface p-3 text-sm">
            Er is geen sleutel voor tekst-naar-spraak ingesteld (<code>AZURE_TTS_KEY</code>). Overnemen uit andere lessen kan wel.
          </p>
        )}
        {overzicht.lessen.length === 0 ? (
          <p className="text-sm text-muted">Er zijn nog geen lessen.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-4">Les</th>
                <th className="py-2 pr-4">Zinnen</th>
                <th className="py-2 pr-4">Opnamen</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {overzicht.lessen.map((l) => {
                const nodig = l.zinnen * 2;
                const open = l.ontbreekt + l.hergebruik;
                return (
                  <tr key={l.id} className="border-b border-line align-top">
                    <td className="py-3 pr-4">
                      <Link href={`/admin/les/edit/${l.id}`} className="font-medium hover:underline">
                        {l.titel}
                      </Link>
                      <div className="text-xs text-muted">{l.id}</div>
                    </td>
                    <td className="py-3 pr-4">{l.zinnen}</td>
                    <td className="py-3 pr-4">
                      {nodig - open} van {nodig}
                    </td>
                    <td className="py-3">
                      {open === 0 ? (
                        <span className="text-muted">Compleet</span>
                      ) : l.ontbreekt > 0 && !overzicht.kan && l.hergebruik === 0 ? (
                        <span className="text-muted">Wacht op de sleutel</span>
                      ) : (
                        <AudioKnop id={l.id} ontbreekt={overzicht.kan ? l.ontbreekt : 0} tekens={l.tekens} hergebruik={l.hergebruik} call={call} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    );
  };
}
