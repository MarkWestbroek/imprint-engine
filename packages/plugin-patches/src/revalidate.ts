import { revalidatePath } from "next/cache";
import { labHref, patchHref, patchesHref, questionsHref } from "./href";

/**
 * Every page one patch can show up on. A patch changes pool more often than
 * anything else about it (moderation, and an update that sends it back to
 * `voorstel`), and a pool change means it leaves one list and joins another —
 * so refresh the lot instead of guessing which.
 */
export function touchPatch(slug: string): void {
  for (const path of [patchesHref(), labHref(), questionsHref(), patchHref(slug), `/members${patchHref(slug)}`, "/admin/patches"]) {
    try {
      revalidatePath(path);
    } catch {
      // no Next.js request context (a Node script, a test)
    }
  }
}
