import { definePlugin, type ImprintPlugin } from "@imprint/runtime-admin";
import { patchesContentTypes } from "./content-types";
import { patchesPublicRoute, type PatchesOptions } from "./public";

/**
 * @imprint/plugin-patches — the patch pool (MusicBrain doc/plans/patch-pool.md):
 * the content type `patch` (the editor's file as a library asset, metadata,
 * a pool, a licence), the ingest API `patchesApi` for the editor (the site
 * mounts it at /api/patches), and the pages /patches, /patches/lab,
 * /patches/vragen and /patches/<slug>. Who may propose, and that a proposal
 * is private to its author, is policy in content-core/access.ts
 * (`proposal`, `private`), not code here. The thread under a patch comes from
 * plugin-annotations once the site allows `patch` as a target.
 *
 * Node scripts import the React-free entries: `./content-types`, `./schemas`, `./href`.
 */
export function patchesPlugin(opts: PatchesOptions = {}): ImprintPlugin {
  return definePlugin({
    name: "patches",
    version: "0.12.0",
    contentTypes: patchesContentTypes,
    menu: [{ group: "content", section: "Patches", items: [{ href: "/admin/patch", label: "Patches" }] }],
    publicRoute: patchesPublicRoute(opts),
  });
}

export { patchesApi } from "./api";
export { patchesContentTypes } from "./content-types";
export { labHref, patchHref, patchesHref, questionsHref } from "./href";
export { derivedPatches, getPatch, listPatches, takeAssets } from "./patches";
export { License, PatchFormSchema, PatchInput, PatchSchema, Pool, Requires, poolAccess, type Patch } from "./schemas";
export type { PatchesOptions } from "./public";
