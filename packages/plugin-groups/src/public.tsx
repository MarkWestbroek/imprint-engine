import Link from "next/link";
import { ANONYMOUS, contentResource, permit, userSubject, type ContentStore, type Page, type WritableContentStore } from "@imprint/content-core";
import { Markdown, type PluginCall, type PublicRouteContext, type PublicRouteResult } from "@imprint/runtime-admin";
import { GroupCards } from "./group-cards";
import { getGroup, listGroups } from "./groups";
import { GROUPS_PREFIX, groupHref, groupPagePrefix, groupsHref } from "./href";
import { GroupPosts } from "./group-posts";
import { JoinButton } from "./join-button";
import type { Group } from "./schemas";
import { toCard } from "./widget";

import { groupPosts, type GroupPost } from "./timeline";

/** An event of the group (plugin-events' `event`), likewise. */
type GroupEvent = { slug: string; title: string; start: string; end: string; location: string };

function GroupView({
  group,
  pages,
  wikiTitle,
  posts,
  events,
  call,
}: {
  group: Group;
  pages: Page[];
  wikiTitle: string | null;
  posts: GroupPost[];
  events: GroupEvent[];
  call?: PluginCall;
}) {
  return (
    <article>
      <Link href={groupsHref()} className="text-sm text-muted hover:underline">
        ← Alle communities
      </Link>
      <header className="mt-4 overflow-hidden rounded-md border border-line bg-surface">
        {group.image && (
          // eslint-disable-next-line @next/next/no-img-element -- remote group image, sized by CSS
          <img src={group.image} alt="" className="max-h-72 w-full object-cover" />
        )}
        <div className="flex flex-wrap items-start justify-between gap-4 p-6">
          <div>
            <p className="text-xs text-muted">
              Community
              {group.closed ? " · besloten" : group.membershipOnRequest ? " · lid worden op aanvraag" : ""}
              {group.memberCount !== undefined && ` · ${group.memberCount} ${group.memberCount === 1 ? "lid" : "leden"}`}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">{group.title}</h1>
            {group.summary && <p className="mt-2 max-w-2xl text-lg text-muted">{group.summary}</p>}
          </div>
          {/* Who is looking is asked in the browser (G1): the page itself stays prerendered. */}
          <JoinButton slug={group.slug} call={call} loginHref={`/account/login?next=${encodeURIComponent(groupHref(group.slug))}`} />
        </div>
      </header>

      {(wikiTitle || pages.length > 0) && (
        <nav aria-label="In deze community" className="mt-6 flex flex-wrap gap-2 text-sm">
          {wikiTitle && (
            <Link href={`/${group.wiki}`} className="rounded-full border border-line px-3 py-1 hover:bg-surface">
              Wiki: {wikiTitle}
            </Link>
          )}
          {pages.map((p) => (
            <Link key={p.slug} href={`/${p.slug}`} className="rounded-full border border-line px-3 py-1 hover:bg-surface">
              {p.title}
            </Link>
          ))}
        </nav>
      )}

      <div className="markdown mt-8 max-w-3xl">
        {group.introduction && <Markdown>{group.introduction}</Markdown>}
        {group.body && <Markdown>{group.body}</Markdown>}
      </div>
      {events.length > 0 && (
        <section className="mt-10 max-w-3xl">
          <h2 className="text-xl font-semibold">Agenda</h2>
          <ul className="mt-2 divide-y divide-line">
            {events.map((e) => (
              <li key={e.slug} className="py-2">
                <Link href={`/events/${e.slug}`} className="font-semibold text-accent hover:underline">
                  {e.title}
                </Link>
                <span className="ml-2 text-sm text-muted">
                  {new Date(e.start).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" })}
                  {e.location && ` · ${e.location}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {/* The timeline, with the member's form and delete buttons (G3a); without a dispatcher it is just the list. */}
      <GroupPosts slug={group.slug} posts={posts} closed={group.closed} call={call} />
      {group.tags.length > 0 && (
        <ul className="mt-8 flex flex-wrap gap-2" aria-label="Tags">
          {group.tags.map((tag) => (
            <li key={tag} className="rounded-full border border-line px-3 py-0.5 text-sm text-muted">
              {tag}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/** The group's upcoming events (type `event`, when the site has plugin-events), soonest first. */
async function groupEvents(reader: ContentStore, slug: string): Promise<GroupEvent[]> {
  const listing = reader as Partial<WritableContentStore>;
  if (typeof listing.listItems !== "function") return [];
  try {
    const now = Date.now();
    return (await listing.listItems("event"))
      .map((r) => r.data as Partial<GroupEvent> & { group?: string })
      .filter((e): e is GroupEvent & { group: string } => e.group === slug && typeof e.slug === "string" && typeof e.title === "string" && typeof e.start === "string")
      .map((e) => ({ slug: e.slug, title: e.title, start: e.start, end: e.end ?? "", location: e.location ?? "" }))
      .filter((e) => new Date(e.end || e.start).getTime() >= now)
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, 5);
  } catch {
    return []; // no such type on this site
  }
}

/**
 * `/groups`: the overview; `/groups/<slug>`: the group's page. A group's own
 * pages (`/groups/<slug>/<page>`) are ordinary pages, left to the site.
 * Restricted groups go to /members (G2), where the PDP decides.
 */
export async function groupsPublicRoute({ imprint, slug, members, session, subject: given, call }: PublicRouteContext): Promise<PublicRouteResult | null> {
  const store = imprint.writableStore;
  if (!store || slug[0] !== GROUPS_PREFIX || slug.length > 2) return null;
  if (slug.length === 1) {
    const groups = (await listGroups(store)).filter((g) => g.access === "public");
    return {
      render: (
        <section>
          <h1 className="mb-6 text-3xl font-semibold tracking-tight">Communities</h1>
          <GroupCards showSearch groups={groups.map(toCard)} />
        </section>
      ),
      metadata: { title: "Communities" },
    };
  }
  const group = await getGroup(store, slug[1]!);
  if (!group) return null;
  if (group.access !== "public" && !members) return { redirect: `/members/${slug.join("/")}` };
  const subject = given ?? (session ? userSubject(session.name, session.role) : ANONYMOUS);
  if (members && !(await permit(imprint.pdp, subject, "read", contentResource("group", group.slug, group)))) return null;
  // The group's pages as this visitor may see them (public in the catch-all; the member's own under /members).
  const reader = members ? imprint.storeFor(subject) : imprint.store;
  const [pages, wiki, posts, events] = await Promise.all([
    reader.listPages({ prefix: groupPagePrefix(group.slug) }),
    group.wiki ? store.getItem("wiki", group.wiki) : null,
    groupPosts(reader, group.slug),
    groupEvents(reader, group.slug),
  ]);
  const wikiTitle = (wiki?.data as { title?: string } | undefined)?.title ?? null;
  return {
    render: <GroupView group={group} pages={pages} wikiTitle={wikiTitle} posts={posts} events={events} call={call} />,
    metadata: { title: group.title, description: group.summary },
  };
}
