/**
 * @imprint/runtime-admin/studio — the client-safe part of the page studio:
 * the draft shape and its pure mutations. The screens and actions live in
 * `./admin-server` (server) and `./admin` (client components).
 */
export { applyOp, MAX_CELLS, MAX_SPAN, type DraftOp, type PageDraft, type WidgetPath } from "./layout-ops";
