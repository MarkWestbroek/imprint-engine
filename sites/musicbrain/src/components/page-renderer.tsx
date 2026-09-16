import type { Page, PageLayout, WidgetInstance } from "@imprint/content-core";
import { PageRenderer as EnginePageRenderer, Widget as EngineWidget } from "@imprint/runtime-admin";
import { widgetContext } from "@/lib/widget-context";
import { widgetComponents } from "@/widgets/components";

/**
 * MusicBrain's renderer: the engine's PageRenderer (@imprint/runtime-admin)
 * bound to this site's widget viewers and the request's WidgetContext. The
 * site composes, the engine renders (architecture.md §0).
 */

export async function Widget(props: { widget: WidgetInstance; subject?: unknown }) {
  return <EngineWidget {...props} viewers={widgetComponents} ctx={await widgetContext()} />;
}

export async function PageRenderer(props: { page: Page & { layout: PageLayout }; subject?: unknown }) {
  return <EnginePageRenderer {...props} viewers={widgetComponents} ctx={await widgetContext()} />;
}
