import type { AuthzenSubject, Page, PageLayout, WidgetInstance } from "@imprint/content-core";
import { PageRenderer as EnginePageRenderer, Widget as EngineWidget } from "@imprint/runtime-admin";
import { widgetContext } from "@/lib/widget-context";
import { widgetComponents } from "@/widgets/components";

/**
 * MusicBrain's renderer: the engine's PageRenderer (@imprint/runtime-admin)
 * bound to this site's widget viewers and the request's WidgetContext. The
 * site composes, the engine renders (architecture.md §0).
 *
 * `reader` is who is looking (the members route passes the session's subject);
 * `subject` is what a default view is about — unrelated, despite the names.
 */

export async function Widget(props: { widget: WidgetInstance; subject?: unknown; reader?: AuthzenSubject }) {
  const { reader, ...rest } = props;
  return <EngineWidget {...rest} viewers={widgetComponents} ctx={await widgetContext(reader)} />;
}

export async function PageRenderer(props: {
  page: Page & { layout: PageLayout };
  subject?: unknown;
  reader?: AuthzenSubject;
}) {
  const { reader, ...rest } = props;
  return <EnginePageRenderer {...rest} viewers={widgetComponents} ctx={await widgetContext(reader)} />;
}
