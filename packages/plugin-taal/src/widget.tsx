import type { ReactNode } from "react";
import { z } from "zod";
import { WidgetFrame, type WidgetContext } from "@imprint/runtime-admin";
import { Lesdialoog, LesOefeningen } from "./les-view";
import { lesHref, pakketHref } from "./href";
import { teksten } from "./i18n";
import { getLes, listLessen } from "./lessen";
import { Verder } from "./verder";
import type { Les } from "./schemas";

/**
 * The two widgets of the language training, for any page: the dialogue of a
 * lesson as a table with play buttons, and its exercises. Both read the
 * lesson through the WidgetContext; the page of a lesson (public.tsx) shows
 * the same two parts.
 */
const base = {
  title: z.string().optional(),
  /** The id of the lesson (`nl-0-01`). */
  les: z.string().min(1),
  /** The interface language (pl, nl); empty = the support language of the lesson. */
  ui: z.string().default(""),
};

export const LesdialoogConfig = z.object({ ...base, brokken: z.boolean().default(true) });
export type LesdialoogConfig = z.infer<typeof LesdialoogConfig>;

export const OefeningenConfig = z.object(base);
export type OefeningenConfig = z.infer<typeof OefeningenConfig>;

/** "Continue where you left off", for a front page: the lessons of one package, the next one to do. */
export const VerderConfig = z.object({
  /** The interface language (pl, nl). */
  ui: z.string().default("pl"),
  /** The language taught: the package. */
  taal: z.string().default("nl"),
});
export type VerderConfig = z.infer<typeof VerderConfig>;

export async function VerderWidget({ config, ctx }: { config: VerderConfig; ctx: WidgetContext }) {
  const lessen = ctx.writableStore ? (await listLessen(ctx.writableStore)).filter((l) => l.taal === config.taal) : [];
  return (
    <Verder
      lessen={lessen.map((l) => ({ id: l.id, href: lesHref(config.ui, l), titel: l.titel }))}
      overzicht={pakketHref(config.ui, config.taal)}
      t={teksten(config.ui).verder}
    />
  );
}

async function metLes(config: { title?: string; les: string; ui: string }, ctx: WidgetContext, render: (les: Les, ui: string) => ReactNode) {
  const les = ctx.writableStore ? await getLes(ctx.writableStore, config.les) : null;
  if (!les) {
    return (
      <WidgetFrame title={config.title}>
        <p className="text-sm text-muted">
          {ctx.writableStore ? `No lesson "${config.les}".` : "The lessons need the database (set DATABASE_URL)."}
        </p>
      </WidgetFrame>
    );
  }
  return (
    <section>
      {config.title && <h2 className="mb-4 text-2xl font-semibold tracking-tight">{config.title}</h2>}
      {render(les, config.ui || les.steuntaal || les.taal)}
    </section>
  );
}

export function LesdialoogWidget({ config, ctx }: { config: LesdialoogConfig; ctx: WidgetContext }) {
  return metLes(config, ctx, (les, ui) => <Lesdialoog les={les} ui={ui} brokken={config.brokken} />);
}

export function OefeningenWidget({ config, ctx }: { config: OefeningenConfig; ctx: WidgetContext }) {
  return metLes(config, ctx, (les, ui) => <LesOefeningen les={les} ui={ui} />);
}
