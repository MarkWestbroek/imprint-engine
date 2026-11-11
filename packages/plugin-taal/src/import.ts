import matter from "gray-matter";
import type { WritableContentStore } from "@imprint/content-core";
import { slugFromFile } from "./href";
import { LesSchema, type Les } from "./schemas";

/**
 * A lesson file (Markdown with frontmatter, design/taaltraining/lessen/) as a
 * lesson: the frontmatter is the lesson, the body the rebuild assignment, the
 * file name the slug. Node only.
 */
export function parseLes(file: string, text: string): Les {
  const { data, content } = matter(text);
  return LesSchema.parse({ slug: slugFromFile(file), ...data, ombouwen: content.trim() });
}

/** Everything but the recordings: what an import may change. */
const inhoud = (les: Les) => JSON.stringify({ ...les, audio: undefined });

/**
 * Write a lesson through the store. An unchanged lesson gets no new version,
 * and the recordings of the stored lesson stay (the import knows none).
 */
export async function importLes(store: WritableContentStore, les: Les, by = "import"): Promise<"new" | "changed" | "same"> {
  const record = await store.getItem("les", les.id);
  const current = record ? LesSchema.safeParse(record.data) : null;
  const old = current?.success ? current.data : null;
  if (old && inhoud(old) === inhoud(les)) return "same";
  await store.putItem("les", les.id, { ...les, audio: { ...old?.audio, ...les.audio } }, { by });
  return old ? "changed" : "new";
}
