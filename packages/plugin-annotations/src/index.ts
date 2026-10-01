import { definePlugin, type ImprintPlugin, type PluginAction } from "@imprint/runtime-admin";
import { annotationsActions, type AnnotationsConfig } from "./actions";
import { annotationsContentTypes } from "./content-types";

/**
 * @imprint/plugin-annotations — annotations after the W3C Web Annotation
 * model (design/annotaties.md): the content type `annotation` (targets with
 * selector and state, bodies as text or resource, motivation), and the
 * thread below an item: comments, replies, edit your own, moderators hide,
 * "bewerkt" with versions, "the text changed since". Step 2 adds selectors
 * and the margin. The site mounts `AnnotationThread` under the items whose
 * public route names them (`PublicRouteResult.item`); the config says per
 * type whether items may be annotated, an item may override that with its
 * own `annotations` field. Both the form and the write ask the PDP.
 */

export function annotationsPlugin(config: AnnotationsConfig): ImprintPlugin & { config: AnnotationsConfig } {
  return {
    ...definePlugin({
      name: "annotations",
      version: "0.11.0",
      contentTypes: annotationsContentTypes,
      menu: [{ group: "content", section: "Annotations", items: [{ href: "/admin/annotation", label: "Annotations" }] }],
      actions: annotationsActions as unknown as Record<string, PluginAction>,
    }),
    config,
  };
}

export { annotationsContentTypes } from "./content-types";
export { AnnotationSchema, AnnotationSetting, type Annotation } from "./schemas";
export { annotationsActions, type AnnotationsConfig, type Target, type ThreadItem, type ThreadStatus } from "./actions";
export { AnnotationThread } from "./thread";
