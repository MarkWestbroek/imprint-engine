import Link from "next/link";
import { ANONYMOUS, contentResource, permit, userSubject, type Page } from "@imprint/content-core";
import { Markdown, type PluginCall, type PublicRouteContext, type PublicRouteResult } from "@imprint/runtime-admin";
import { GroupCards } from "./group-cards";
import { getGroup, listGroups } from "./groups";
import { GROUPS_PREFIX, groupHref, groupPagePrefix, groupsHref } from "./href";
import { JoinButton } from "./join-button";
import type { Group } from "./schemas";
import { toCard } from "./widget";

function GroupView({
  group,
  pages,
  wikiTitle,
  call,
}: {
  group: Group;
  pages: Page[];
  wikiTitle: string | null;
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
  const [pages, wiki] = await Promise.all([
    (members ? imprint.storeFor(subject) : imprint.store).listPages({ prefix: groupPagePrefix(group.slug) }),
    group.wiki ? store.getItem("wiki", group.wiki) : null,
  ]);
  const wikiTitle = (wiki?.data as { title?: string } | undefined)?.title ?? null;
  return {
    render: <GroupView group={group} pages={pages} wikiTitle={wikiTitle} call={call} />,
    metadata: { title: group.title, description: group.summary },
  };
}
