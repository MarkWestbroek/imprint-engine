import matter from "gray-matter";
import type { WritableContentStore } from "@imprint/content-core";
import { slugFromFile } from "./href";
import { GrammaticaSchema, LesSchema, type Grammatica, type Les } from "./schemas";

/**
 * A lesson file (Markdown with frontmatter, design/taaltraining/lessen/) as a
 * lesson: the frontmatter is the lesson, the body the rebuild assignment, the
 * file name the slug. Node only.
 */
export function parseLes(file: string, text: string): Les {
  const { data, content } = matter(text);
  return LesSchema.parse({ slug: slugFromFile(file), ...data, ombouwen: content.trim() });
}

/**
 * A value as JSON with the keys of every object sorted: the database may hand
 * an object back in another key order (Postgres jsonb does: `{ pl, nl }`
 * comes back as `{ nl, pl }`), and that is not a change.
 */
export function stabiel(value: unknown): string {
  return JSON.stringify(value, (_, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v
  );
}

/** Everything but the recordings: what an import may change. */
const inhoud = (les: Les) => stabiel({ ...les, audio: undefined });

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

/**
 * A grammar file (`grammatica/nl/tegenwoordige-tijd.md`) as a topic: all in
 * the frontmatter (the texts per reader language as YAML blocks), the file
 * name the slug, the id the language taught + the slug. The body stays empty.
 */
export function parseGrammatica(file: string, text: string): Grammatica {
  const { data, content } = matter(text);
  if (content.trim()) throw new Error("a grammar file has everything in its frontmatter (tekst: pl: | …); the body must be empty");
  const slug = slugFromFile(file);
  const taal = typeof data.taal === "string" ? data.taal : "";
  return GrammaticaSchema.parse({ slug, id: `${taal}-${slug}`, ...data });
}

/** Write a topic through the store; an unchanged one gets no new version. */
export async function importGrammatica(store: WritableContentStore, g: Grammatica, by = "import"): Promise<"new" | "changed" | "same"> {
  const record = await store.getItem("grammatica", g.id);
  const current = record ? GrammaticaSchema.safeParse(record.data) : null;
  const old = current?.success ? current.data : null;
  if (old && stabiel(old) === stabiel(g)) return "same";
  await store.putItem("grammatica", g.id, g, { by });
  return old ? "changed" : "new";
}
