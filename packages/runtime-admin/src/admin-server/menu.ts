import type { MenuGroup } from "../admin/admin-shell";
import type { AdminContext } from "../admin-context";

/**
 * The admin menu, built rather than written (design/fase-3 §7): the content
 * types come from the catalogue (a definition's `menu` says where a type
 * belongs; only active, listable types appear), the rest from the site's
 * contributions. The standard groups keep the order and icons the admin has
 * always had; a contribution may add a group of its own.
 */

const STANDARD: Omit<MenuGroup, "sections">[] = [
  { id: "overview", label: "Overzicht", icon: "home" },
  { id: "content", label: "Content", icon: "content" },
  { id: "design", label: "Vormgeving", icon: "design" },
  { id: "config", label: "Model & config", icon: "model" },
  { id: "manage", label: "Beheer", icon: "access", adminOnly: true },
];

export function adminMenu(admin: AdminContext): MenuGroup[] {
  const groups = new Map<string, MenuGroup>(STANDARD.map((g) => [g.id, { ...g, sections: [] }]));
  const section = (groupId: string, label: string | undefined, fallback?: { label: string }) => {
    let group = groups.get(groupId);
    if (!group) {
      group = { id: groupId, label: fallback?.label ?? groupId, sections: [] };
      groups.set(groupId, group);
    }
    let sec = group.sections.find((s) => s.label === label);
    if (!sec) {
      sec = { label, items: [] };
      group.sections.push(sec);
    }
    return sec;
  };

  section("overview", undefined).items.push({ href: "/admin", label: "Dashboard" });

  const catalog = admin.imprint.contentTypes;
  for (const type of catalog.types("listable")) {
    const info = catalog.info(type);
    if (!info.menu) continue;
    section(info.menu.group, info.menu.section).items.push({ href: `/admin/${type}`, label: info.label });
  }

  const contributions = [...admin.plugins.flatMap((p) => p.menu ?? []), ...admin.contributions];
  for (const c of contributions) {
    const sec = section(c.group, c.section, c.label ? { label: c.label } : undefined);
    if (c.adminOnly) groups.get(c.group)!.adminOnly = true;
    sec.items.push(...c.items);
  }

  // Users are part of the shared admin, whoever hosts it.
  section("manage", undefined).items.push({ href: "/admin/users", label: "Users" });

  return [...groups.values()];
}
