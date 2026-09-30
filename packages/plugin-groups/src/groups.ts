import type { WritableContentStore } from "@imprint/content-core";
import { GroupSchema, type Group } from "./schemas";

/** All current groups, by `order` then title (Dutch collation). */
export async function listGroups(store: WritableContentStore): Promise<Group[]> {
  const records = await store.listItems("group");
  return records
    .map((r) => GroupSchema.safeParse(r.data))
    .filter((r) => r.success)
    .map((r) => r.data)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "nl", { sensitivity: "base" }));
}

export async function getGroup(store: WritableContentStore, slug: string): Promise<Group | null> {
  const record = await store.getItem("group", slug);
  const parsed = record ? GroupSchema.safeParse(record.data) : null;
  return parsed?.success ? parsed.data : null;
}
