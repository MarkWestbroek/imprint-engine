import { cookies, draftMode } from "next/headers";
import type { ReadOptions } from "@imprint/content-core";

/**
 * As-of preview (S6, backlog §2): an editor picks a moment and browses the
 * public site as it was (or, with scheduled content, will be) at that moment.
 * Rides on Next draft mode: the bypass cookie makes the prerendered pages
 * render dynamically, and our own cookie carries the chosen moment. Pages
 * stay fully static for normal visitors — draftMode() is the only check.
 */

export const ASOF_COOKIE = "imprint_asof";

export type Preview = { active: boolean; asOf?: Date };

export async function getPreview(): Promise<Preview> {
  const { isEnabled } = await draftMode();
  if (!isEnabled) return { active: false };
  const raw = (await cookies()).get(ASOF_COOKIE)?.value;
  const asOf = raw ? new Date(raw) : undefined;
  return { active: true, asOf: asOf && !Number.isNaN(asOf.getTime()) ? asOf : undefined };
}

/** ReadOptions for the current request: {} for visitors, asOf+drafts in preview. */
export async function readOpts(): Promise<ReadOptions> {
  const preview = await getPreview();
  if (!preview.active) return {};
  return { includeDrafts: true, ...(preview.asOf ? { asOf: preview.asOf } : {}) };
}
