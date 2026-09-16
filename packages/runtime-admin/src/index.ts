/**
 * @imprint/runtime-admin — the engine's rendering layer (architecture.md §0).
 * One package for runtime and admin for now (revision proposal §18): split
 * when the boundary proves stable during extraction. `./layout` is the
 * React-free subset.
 */
export { DefaultView, viewSlugFor, viewTargetType } from "./default-view";
export { LAYOUT_PRESETS, layoutRows } from "./layout";
export { Markdown } from "./markdown";
export { WidgetFrame } from "./widget-frame";
export {
  PageRenderer,
  Widget,
  type WidgetContext,
  type WidgetViewer,
  type WidgetViewers,
  type WidgetViewProps,
} from "./page-renderer";
