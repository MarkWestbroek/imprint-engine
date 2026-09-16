/**
 * @imprint/runtime-admin — the engine's rendering layer (architecture.md §0).
 * One package for runtime and admin for now (revision proposal §18): split
 * when the boundary proves stable during extraction. `./layout` is the
 * React-free subset.
 */
export { LAYOUT_PRESETS, layoutRows } from "./layout";
export { Markdown } from "./markdown";
export {
  PageRenderer,
  Widget,
  type WidgetViewer,
  type WidgetViewers,
  type WidgetViewProps,
} from "./page-renderer";
