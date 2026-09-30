import { z } from "zod";
import { WidgetFrame, type WidgetContext } from "@imprint/runtime-admin";
import { listTerms } from "./glossary";
import { GlossaryCards } from "./glossary-cards";
import { termHref, termSummary } from "./href";

/**
 * The glossary overview: a card per term (title and summary), with a search
 * field that filters as you type. `tag` narrows it to one kind (the
 * "Afkortingen" page is the same widget with `tag: afkorting`).
 */
export const GlossaryConfig = z.object({
  title: z.string().optional(),
  /** Only terms with this tag; empty = all terms. */
  tag: z.string().default(""),
  showSearch: z.boolean().default(true),
});
export type GlossaryConfig = z.infer<typeof GlossaryConfig>;

export async function GlossaryWidget({ config, ctx }: { config: GlossaryConfig; ctx: WidgetContext }) {
  if (!ctx.writableStore) {
    return (
      <WidgetFrame title={config.title}>
        <p className="text-sm text-muted">The glossary needs the database (set DATABASE_URL).</p>
      </WidgetFrame>
    );
  }
  const terms = (await listTerms(ctx.writableStore)).filter(
    (t) => t.access === "public" && (!config.tag || t.tags.includes(config.tag))
  );
  return (
    <section>
      {config.title && <h2 className="mb-4 text-2xl font-semibold tracking-tight">{config.title}</h2>}
      <GlossaryCards
        showSearch={config.showSearch}
        terms={terms.map((t) => ({ href: termHref(t.slug), title: t.title, summary: termSummary(t) }))}
      />
    </section>
  );
}
