import { z } from "zod";
import { WidgetFrame, type WidgetContext } from "@imprint/runtime-admin";
import { DeckPlayer } from "./deck-player";
import { sanitizeSlide } from "./sanitize";
import { PresentationSchema } from "./schemas";

/**
 * A presentation on a page: the deck by its slug, shown with the player.
 * Only each slide's HTML goes to the browser, sanitised once more; the
 * speaker notes stay on the server.
 */
export const PresentationConfig = z.object({
  /** The presentation's slug (Content → Presentations). */
  deck: z.string().min(1),
});
export type PresentationConfig = z.infer<typeof PresentationConfig>;

export async function PresentationWidget({ config, ctx }: { config: PresentationConfig; ctx: WidgetContext }) {
  const record = ctx.writableStore ? await ctx.writableStore.getItem("presentation", config.deck) : null;
  const parsed = record ? PresentationSchema.safeParse(record.data) : null;
  if (!parsed?.success || parsed.data.access !== "public") {
    return (
      <WidgetFrame>
        <p className="text-sm text-muted">Presentatie “{config.deck}” niet gevonden.</p>
      </WidgetFrame>
    );
  }
  const deck = parsed.data;
  return (
    <DeckPlayer
      title={deck.title}
      fonts={deck.faces.map((f) => f.href)}
      slides={deck.slides.map((s) => ({ id: s.id, html: sanitizeSlide(s.html) }))}
    />
  );
}
