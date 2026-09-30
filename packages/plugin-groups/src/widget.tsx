import { z } from "zod";
import { WidgetFrame, type WidgetContext } from "@imprint/runtime-admin";
import { GroupCards, type GroupCard } from "./group-cards";
import { listGroups } from "./groups";
import { groupHref } from "./href";
import type { Group } from "./schemas";

/**
 * The groups overview: a card per group, with a search field that filters
 * as you type. `tag` narrows it to the groups with that tag.
 */
export const GroupsConfig = z.object({
  title: z.string().optional(),
  /** Only groups with this tag; empty = all groups. */
  tag: z.string().default(""),
  showSearch: z.boolean().default(true),
});
export type GroupsConfig = z.infer<typeof GroupsConfig>;

export const toCard = (g: Group): GroupCard => ({
  href: groupHref(g.slug),
  title: g.title,
  summary: g.summary,
  image: g.image,
  tags: g.tags,
  memberCount: g.memberCount,
  closed: g.closed,
  membershipOnRequest: g.membershipOnRequest,
});

export async function GroupsWidget({ config, ctx }: { config: GroupsConfig; ctx: WidgetContext }) {
  if (!ctx.writableStore) {
    return (
      <WidgetFrame title={config.title}>
        <p className="text-sm text-muted">Groups need the database (set DATABASE_URL).</p>
      </WidgetFrame>
    );
  }
  const groups = (await listGroups(ctx.writableStore)).filter(
    (g) => g.access === "public" && (!config.tag || g.tags.includes(config.tag))
  );
  return (
    <section>
      {config.title && <h2 className="mb-4 text-2xl font-semibold tracking-tight">{config.title}</h2>}
      <GroupCards showSearch={config.showSearch} groups={groups.map(toCard)} />
    </section>
  );
}
