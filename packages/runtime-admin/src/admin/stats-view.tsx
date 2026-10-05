"use client";

import { useState } from "react";

type Term = { term: string; count: number; hits: number };
type Stats = { since: string; total: number; automated: number; terms: Term[]; empty: Term[] };
type Report = { html: string; updated: string } | { missing: string };

/**
 * The statistics screen's client half: tabs (searches, searches without a
 * result, visits) and a period. The visits report is GoAccess's own page,
 * shown sandboxed (its scripts run, it reaches nothing of the admin).
 */
export function StatsView({ searches, report }: { searches: { label: string; stats: Stats }[]; report: Report }) {
  const [tab, setTab] = useState<"terms" | "empty" | "visits">("terms");
  const [period, setPeriod] = useState(Math.min(1, searches.length - 1));
  const current = searches[period]?.stats;
  const when = (iso: string) => new Date(iso).toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Amsterdam" });
  const tabCls = (on: boolean) => `border-b-2 px-1 pb-2 text-sm ${on ? "border-accent font-semibold text-foreground" : "border-transparent text-muted hover:text-foreground"}`;

  return (
    <div className="space-y-4">
      <div role="tablist" className="flex gap-6 border-b border-line">
        <button type="button" role="tab" aria-selected={tab === "terms"} className={tabCls(tab === "terms")} onClick={() => setTab("terms")}>
          Top zoekopdrachten
        </button>
        <button type="button" role="tab" aria-selected={tab === "empty"} className={tabCls(tab === "empty")} onClick={() => setTab("empty")}>
          Zonder resultaat
        </button>
        <button type="button" role="tab" aria-selected={tab === "visits"} className={tabCls(tab === "visits")} onClick={() => setTab("visits")}>
          Bezoek
        </button>
      </div>

      {tab !== "visits" &&
        (current ? (
          <>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label>
                Periode{" "}
                <select className="ml-1 rounded-md border border-line bg-background px-2 py-1" value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
                  {searches.map((s, i) => (
                    <option key={s.label} value={i}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <span className="text-muted">
                {current.total} zoekopdrachten van mensen
                {current.automated > 0 && ` · ${current.automated} van machines weggelaten`}
              </span>
            </div>
            <Terms list={tab === "terms" ? current.terms : current.empty} empty={tab === "terms" ? "Nog geen zoekopdrachten in deze periode." : "Alles wat gezocht werd, leverde iets op."} showHits={tab === "terms"} />
            {tab === "empty" && <p className="text-sm text-muted">Wat mensen zochten en niet vonden: kandidaten voor nieuwe inhoud, of voor een synoniem in een bestaande pagina.</p>}
          </>
        ) : (
          <p className="text-sm text-muted">Zoekstatistiek vraagt een database.</p>
        ))}

      {tab === "visits" &&
        ("html" in report ? (
          <div className="space-y-2">
            <p className="text-sm text-muted">Uit het toegangslog van de webserver, zonder cookies en met ingekorte IP-adressen; bots en crawlers zijn weggelaten. Bijgewerkt: {when(report.updated)}.</p>
            <iframe title="Bezoekrapport" srcDoc={report.html} sandbox="allow-scripts" className="h-[80vh] w-full rounded-md border border-line bg-white" />
          </div>
        ) : (
          <p className="text-sm text-muted">{report.missing}</p>
        ))}
    </div>
  );
}

function Terms({ list, empty, showHits }: { list: Term[]; empty: string; showHits: boolean }) {
  if (list.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <table className="w-full max-w-3xl text-sm">
      <thead>
        <tr className="border-b border-line text-left text-muted">
          <th className="py-2 font-medium">Zoekopdracht</th>
          {showHits && <th className="py-2 text-right font-medium">Resultaten</th>}
          <th className="py-2 text-right font-medium">Aantal</th>
        </tr>
      </thead>
      <tbody>
        {list.map((t) => (
          <tr key={t.term} className="border-b border-line">
            <td className="py-2">
              <a href={`/search?q=${encodeURIComponent(t.term)}`} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                {t.term}
              </a>
            </td>
            {showHits && <td className="py-2 text-right tabular-nums text-muted">{t.hits}</td>}
            <td className="py-2 text-right tabular-nums">{t.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
