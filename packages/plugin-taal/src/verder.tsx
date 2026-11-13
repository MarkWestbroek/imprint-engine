"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { Teksten } from "./i18n";
import { useOpslag, VOORTGANG_KEY } from "./opslag";
import { leesVoortgang } from "./stand";

export type VerderLes = { id: string; href: string; titel: string };

const vul = (tekst: string, w: Record<string, string | number>) => tekst.replace(/\{(\w+)\}/g, (_, k: string) => String(w[k] ?? ""));

/**
 * "Continue where you left off": the first lesson without a result, and how
 * many are done. Reads what this browser keeps (and, for a member, what came
 * from the account); the server and the first render show the start.
 */
export function Verder({ lessen, overzicht, t }: { lessen: VerderLes[]; overzicht: string; t: Teksten["verder"] }) {
  const bewaard = useOpslag(VOORTGANG_KEY);
  const voortgang = useMemo(() => leesVoortgang(bewaard), [bewaard]);
  if (lessen.length === 0) return null;
  const gedaan = lessen.filter((l) => voortgang[l.id]).length;
  const i = lessen.findIndex((l) => !voortgang[l.id]);
  const volgende = i >= 0 ? lessen[i]! : null;
  const knop = "inline-block rounded-md bg-accent px-5 py-2.5 font-semibold text-background hover:bg-accent-strong";
  return (
    <div className="space-y-4 rounded-md border border-line bg-surface p-6">
      {gedaan === 0 ? (
        <p className="text-muted">{t.uitleg}</p>
      ) : (
        <div className="space-y-2">
          <p>{vul(t.gedaan, { n: gedaan, totaal: lessen.length })}</p>
          <div className="h-2 overflow-hidden rounded-full bg-background" aria-hidden>
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round((gedaan / lessen.length) * 100)}%` }} />
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-4">
        {volgende ? (
          <Link href={volgende.href} className={knop}>
            {gedaan === 0 ? t.begin : vul(t.dalej, { nr: i + 1 })}: <span lang="nl">{volgende.titel}</span>
          </Link>
        ) : (
          <p className="font-semibold">{t.alles}</p>
        )}
        <Link href={overzicht} className="underline underline-offset-4">
          {t.overzicht}
        </Link>
      </div>
    </div>
  );
}
