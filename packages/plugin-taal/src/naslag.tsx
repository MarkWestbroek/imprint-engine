import Link from "next/link";
import type { ReactNode } from "react";
import { Markdown, type MarkdownComponents } from "@imprint/runtime-admin";
import { indeling, lessenOver } from "./grammatica";
import { grammaticaHref, lesHref, pakketHref, woordenHref } from "./href";
import { teksten, vul } from "./i18n";
import { tekstVoor } from "./lessen";
import type { Grammatica, Les } from "./schemas";
import { uitspreekbaar, vormen } from "./tekst";
import { Uitspreken } from "./uitspreken";

/**
 * The grammar reference of a package (server): the overview per group and one
 * topic. Bold in a text is the language taught and gets a button that says it
 * (uitspreken.tsx) — unless it is a piece of a word (`-en`, `ge-…-t`) or a
 * single letter, which no voice says well.
 */

function tekstVan(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(tekstVan).join("");
  if (typeof node === "object" && "props" in node) return tekstVan((node as { props: { children?: ReactNode } }).props.children);
  return "";
}

function NaslagTekst({ children, taal, label }: { children: string; taal: string; label: string }) {
  const components: MarkdownComponents = {
    strong: ({ children: inhoud }) => {
      const tekst = tekstVan(inhoud).trim();
      return uitspreekbaar(tekst) ? (
        <Uitspreken text={tekst} lang={taal} label={label}>
          {inhoud}
        </Uitspreken>
      ) : (
        <strong>{inhoud}</strong>
      );
    },
  };
  // Markdown renders on the server, which knows no choice of forms: both.
  return <Markdown components={components}>{vormen(children)}</Markdown>;
}

export function GrammaticaOverzicht({ ui, taal, topics, metWoorden = false }: { ui: string; taal: string; topics: Grammatica[]; metWoorden?: boolean }) {
  const t = teksten(ui);
  const g = t.grammatica;
  return (
    <div lang={ui} className="max-w-3xl">
      <Link href={pakketHref(ui, taal)} className="text-sm text-muted hover:underline">
        ← {t.alleLessen}
      </Link>
      <p className="eyebrow mt-4">{t.pakket[taal] ?? taal}</p>
      <h1 className="text-3xl font-semibold tracking-tight">{g.naam}</h1>
      <p className="mt-3 text-lg text-muted">{vul(g.intro, { taal: t.inTaal[taal] ?? taal })}</p>
      {metWoorden && (
        <p className="mt-4">
          <Link href={woordenHref(ui, taal)} className="font-semibold text-accent hover:underline">
            {t.woorden.naam} →
          </Link>
        </p>
      )}
      {topics.length === 0 && <p className="mt-6 text-muted">{g.geen}</p>}
      {indeling(topics).map(({ groep, topics: vanGroep }) => (
        <section key={groep} className="mt-8">
          <h2 className="eyebrow mb-3">{g.groepen[groep]}</h2>
          <ul className="space-y-2">
            {vanGroep.map((onderwerp) => (
              <li key={onderwerp.id}>
                <Link href={grammaticaHref(ui, taal, onderwerp.slug)} className="block rounded-md border border-line bg-background px-5 py-4 hover:border-accent">
                  <span className="text-lg font-semibold">{tekstVoor(onderwerp.titel, ui)}</span>
                  {tekstVoor(onderwerp.kort, ui) && <span className="mt-1 block text-muted">{vormen(tekstVoor(onderwerp.kort, ui))}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function GrammaticaView({ ui, onderwerp, lessen }: { ui: string; onderwerp: Grammatica; lessen: Les[] }) {
  const t = teksten(ui);
  const g = t.grammatica;
  const kort = tekstVoor(onderwerp.kort, ui);
  const anders = tekstVoor(onderwerp.anders, ui);
  const over = lessenOver(onderwerp, lessen);
  return (
    <article lang={ui} className="max-w-3xl">
      <Link href={grammaticaHref(ui, onderwerp.taal)} className="text-sm text-muted hover:underline">
        ← {g.alle}
      </Link>
      <p className="eyebrow mt-4">
        {g.naam} · {g.groepen[onderwerp.soort === "verschil" ? "verschil" : onderwerp.groep]}
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">{tekstVoor(onderwerp.titel, ui)}</h1>
      {kort && <p className="mt-3 text-lg text-muted">{vormen(kort)}</p>}

      <div className="mt-6">
        <NaslagTekst taal={onderwerp.taal} label={g.uitspreken}>
          {tekstVoor(onderwerp.tekst, ui)}
        </NaslagTekst>
      </div>

      {anders && (
        <section className="mt-8 rounded-md border border-line bg-surface p-5">
          <h2 className="eyebrow mb-2">{g.anders}</h2>
          <NaslagTekst taal={onderwerp.taal} label={g.uitspreken}>
            {anders}
          </NaslagTekst>
        </section>
      )}

      {over.length > 0 && (
        <section className="mt-8">
          <h2 className="eyebrow mb-3">{g.inLessen}</h2>
          <ul className="space-y-1">
            {over.map((les) => (
              <li key={les.id}>
                <Link href={lesHref(ui, les)} className="hover:underline">
                  <span className="mr-2 text-muted">{lessen.indexOf(les) + 1}</span>
                  <span lang={les.taal}>{les.titel}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

/** Under "Did you see that?": the topics this lesson points at, that can be read in this interface language. */
export function MeerGrammatica({ ui, les, topics }: { ui: string; les: Les; topics: Grammatica[] }) {
  const t = teksten(ui);
  const gelinkt = les.grammatica.map((id) => topics.find((g) => g.id === id)).filter((g): g is Grammatica => !!g);
  if (gelinkt.length === 0) return null;
  return (
    <p className="mt-3 text-sm">
      <span className="text-muted">{t.grammatica.meer}</span>{" "}
      {gelinkt.map((g, i) => (
        <span key={g.id}>
          {i > 0 && ", "}
          <Link href={grammaticaHref(ui, g.taal, g.slug)} className="font-semibold text-accent hover:underline">
            {tekstVoor(g.titel, ui)} →
          </Link>
        </span>
      ))}
    </p>
  );
}
