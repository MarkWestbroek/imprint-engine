"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { RoleType } from "@imprint/content-core";
import { logoutAction } from "@/app/admin/actions";

/**
 * Admin chrome: a VS Code-style activity rail (grouped by what you're doing,
 * not by data type) + a secondary panel listing the active group's items +
 * the editor. Replaces the old single top bar. The active group follows the
 * current route.
 */

type Item = { href: string; label: string };
type Group = {
  id: string;
  label: string;
  icon: string; // key into ICONS
  adminOnly?: boolean;
  sections: { label?: string; items: Item[] }[];
};

const GROUPS: Group[] = [
  {
    id: "overzicht",
    label: "Overzicht",
    icon: "home",
    sections: [{ items: [{ href: "/admin", label: "Dashboard" }] }],
  },
  {
    id: "content",
    label: "Content",
    icon: "content",
    sections: [
      { label: "Site", items: [{ href: "/admin/page", label: "Pages" }] },
      {
        label: "Catalogus",
        items: [
          { href: "/admin/product", label: "Products" },
          { href: "/admin/component", label: "Components" },
          { href: "/admin/board-spec", label: "Board specs" },
          { href: "/admin/release", label: "Releases" },
        ],
      },
      { label: "Planning", items: [{ href: "/admin/planning", label: "Planning" }] },
      { label: "Wiki", items: [{ href: "/admin/wiki", label: "Wikis" }] },
    ],
  },
  {
    id: "vormgeving",
    label: "Vormgeving",
    icon: "design",
    sections: [
      {
        items: [
          { href: "/admin/menu", label: "Menus" },
          { href: "/admin/theme", label: "Themes" },
          { href: "/admin/views", label: "Default views" },
        ],
      },
    ],
  },
  {
    id: "model",
    label: "Model & config",
    icon: "model",
    sections: [
      {
        items: [
          { href: "/admin/model", label: "Content model" },
          { href: "/admin/relations", label: "Relations" },
          { href: "/admin/site", label: "Site" },
        ],
      },
    ],
  },
  {
    id: "beheer",
    label: "Beheer",
    icon: "access",
    adminOnly: true,
    sections: [{ items: [{ href: "/admin/users", label: "Users" }] }],
  },
];

const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5M5 9.5V20h14V9.5M9.5 20v-6h5v6" />,
  content: (
    <>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H14l6 6v8.5A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5Z" />
      <path d="M14 4v6h6M8 13h7M8 16.5h5" />
    </>
  ),
  design: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1 0 1.6-.8 1.6-1.7 0-.9-.7-1.4-.7-2.1 0-.6.5-1.1 1.2-1.1H16a4 4 0 0 0 4-4c0-4.4-3.6-8.1-8-8.1Z" />
      <circle cx="7.5" cy="12" r="1" />
      <circle cx="15" cy="8" r="1" />
    </>
  ),
  model: (
    <>
      <rect x="4" y="4" width="7" height="5" rx="1" />
      <rect x="13" y="15" width="7" height="5" rx="1" />
      <path d="M7.5 9v3.5a2 2 0 0 0 2 2H16" />
    </>
  ),
  access: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 8.5a2.5 2.5 0 0 1 0 5M18 20a5 5 0 0 0-3-4.6" />
    </>
  ),
  site: <path d="M7 17 17 7M9 7h8v8" />,
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  out: <path d="M14 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H14M17 15l3-3-3-3M10 12h10" />,
  help: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.3a2.4 2.4 0 1 1 3.4 2.9c-.7.4-1 .9-1 1.8" />
      <circle cx="12" cy="16.6" r="0.4" fill="currentColor" />
    </>
  ),
};

function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {ICONS[name]}
    </svg>
  );
}

function itemActive(href: string, pathname: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

const flatItems = (g: Group) => g.sections.flatMap((s) => s.items);

export function AdminShell({
  session,
  children,
}: {
  session: { name: string; role: RoleType };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const groups = GROUPS.filter((g) => !g.adminOnly || session.role === "admin");

  // Active group = the one whose longest matching item href fits the path.
  let activeGroup = groups[0];
  let best = -1;
  for (const g of groups) {
    for (const it of flatItems(g)) {
      if (itemActive(it.href, pathname) && it.href.length > best) {
        best = it.href.length;
        activeGroup = g;
      }
    }
  }

  const railBtn =
    "group relative grid h-11 w-11 place-items-center rounded-lg text-muted hover:bg-foreground/10 hover:text-foreground";
  const tip =
    "pointer-events-none absolute left-[52px] top-1/2 z-20 -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-semibold text-background opacity-0 transition-opacity group-hover:opacity-100";

  return (
    <div className="flex h-screen overflow-hidden">
      {/* activity rail */}
      <nav className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-line bg-background py-2">
        <Link href="/admin" className="mb-1 grid h-9 w-9 place-items-center rounded-md bg-accent/15 text-sm font-bold text-accent">
          I
        </Link>
        {groups.map((g) => {
          const active = g.id === activeGroup.id;
          return (
            <Link key={g.id} href={flatItems(g)[0].href} className={railBtn} aria-current={active ? "page" : undefined}>
              {active && (
                <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-accent" />
              )}
              <Icon name={g.icon} className={`h-[21px] w-[21px] ${active ? "text-accent" : ""}`} />
              <span className={tip}>{g.label}</span>
            </Link>
          );
        })}
        <div className="flex-1" />
        {/* De handleiding leeft als Help-wiki op de site zelf (gedogfood). */}
        <a href="/help" target="_blank" rel="noreferrer" className={railBtn}>
          <Icon name="help" className="h-[21px] w-[21px]" />
          <span className={tip}>Help ↗</span>
        </a>
        <a href="/" target="_blank" rel="noreferrer" className={railBtn}>
          <Icon name="site" className="h-[21px] w-[21px]" />
          <span className={tip}>Bekijk site ↗</span>
        </a>
        <Link href="/admin/users" className={railBtn}>
          <Icon name="user" className="h-[21px] w-[21px]" />
          <span className={tip}>
            {session.name} · {session.role}
          </span>
        </Link>
        <form action={logoutAction}>
          <button type="submit" className={railBtn}>
            <Icon name="out" className="h-[21px] w-[21px]" />
            <span className={tip}>Afmelden</span>
          </button>
        </form>
      </nav>

      {/* secondary panel */}
      <aside className="w-56 shrink-0 overflow-y-auto border-r border-line bg-surface">
        <h2 className="px-4 pb-1.5 pt-4 text-xs font-semibold uppercase tracking-wider text-muted">
          {activeGroup.label}
        </h2>
        {activeGroup.sections.map((sec, i) => (
          <div key={i} className="pb-1">
            {sec.label && (
              <div className="px-4 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted/80">
                {sec.label}
              </div>
            )}
            {sec.items.map((it) => {
              const active = itemActive(it.href, pathname);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={`flex items-center gap-2.5 border-l-2 px-4 py-1.5 text-sm ${
                    active
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-transparent text-foreground hover:bg-foreground/[.06]"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-accent" : "bg-muted"}`} />
                  {it.label}
                </Link>
              );
            })}
          </div>
        ))}
      </aside>

      {/* editor */}
      <main className="min-w-0 flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
