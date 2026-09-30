import type { WritableContentStore } from "@imprint/content-core";
import { TermSchema, type Term } from "./schemas";

/** All current terms, sorted by title (Dutch collation: "ABAC" before "Aansluitcriteria" as in a dictionary). */
export async function listTerms(store: WritableContentStore): Promise<Term[]> {
  const records = await store.listItems("term");
  return records
    .map((r) => TermSchema.safeParse(r.data))
    .filter((r) => r.success)
    .map((r) => r.data)
    .sort((a, b) => a.title.localeCompare(b.title, "nl", { sensitivity: "base" }));
}

export async function getTerm(store: WritableContentStore, slug: string): Promise<Term | null> {
  const record = await store.getItem("term", slug);
  const parsed = record ? TermSchema.safeParse(record.data) : null;
  return parsed?.success ? parsed.data : null;
}
