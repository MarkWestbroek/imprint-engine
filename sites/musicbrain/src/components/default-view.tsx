import type { ReactNode } from "react";
import type { ContentType } from "@imprint/content-core";
import { DefaultView as EngineDefaultView } from "@imprint/runtime-admin";
import { widgetContext } from "@/lib/widget-context";
import { widgetComponents } from "@/widgets/components";

/**
 * MusicBrain's default views: the engine's DefaultView bound to this site's
 * viewers and the request's WidgetContext. A per-type route passes its
 * hand-coded page as `fallback`.
 */
export async function DefaultView(props: {
  type: ContentType;
  subject: unknown;
  title: string;
  fallback: ReactNode;
}) {
  return <EngineDefaultView {...props} viewers={widgetComponents} ctx={await widgetContext()} />;
}
