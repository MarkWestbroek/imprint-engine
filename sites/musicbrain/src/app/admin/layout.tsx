import Link from "next/link";
import { canEdit, getSession } from "@/lib/auth";
import { writableStore } from "@/lib/content";
import { LoginForm } from "@/components/admin/login-form";
import { logoutAction } from "./actions";

// Sessions live in a cookie, so everything under /admin renders per request.
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/page", label: "Pages" },
  { href: "/admin/product", label: "Products" },
  { href: "/admin/component", label: "Components" },
  { href: "/admin/board-spec", label: "Board specs" },
  { href: "/admin/release", label: "Releases" },
  { href: "/admin/menu", label: "Menus" },
  { href: "/admin/theme", label: "Themes" },
  { href: "/admin/views", label: "Default views" },
  { href: "/admin/relations", label: "Relations" },
  { href: "/admin/site", label: "Site" },
];

// Managing other accounts is admin-only; /admin/users itself is not — everyone
// signed in reaches it through their name in the header to set a password.
const ADMIN_ONLY = [{ href: "/admin/users", label: "Users" }];

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!writableStore) {
    return (
      <main className="mx-auto max-w-xl px-4 py-24 text-sm text-muted">
        <h1 className="mb-2 text-lg font-semibold text-foreground">Admin unavailable</h1>
        <p>
          The admin needs a database: set <code>DATABASE_URL</code> in{" "}
          <code>.env.local</code> (see <code>.env.example</code>), run the
          migrations and seed, and restart. Without it the site serves the
          file-backed content from git (v0 mode).
        </p>
      </main>
    );
  }

  const session = await getSession();
  if (!canEdit(session)) {
    return <main className="flex-1 px-4">{<LoginForm />}</main>;
  }

  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <nav className="flex items-center gap-4 text-sm">
            <span className="font-semibold">
              <span className="text-accent">Imprint</span> admin
            </span>
            {[...NAV, ...(session.role === "admin" ? ADMIN_ONLY : [])].map((item) => (
              <Link key={item.href} href={item.href} className="text-muted hover:text-foreground">
                {item.label}
              </Link>
            ))}
            <a href="/" target="_blank" className="text-muted hover:text-foreground">
              View site ↗
            </a>
          </nav>
          <form action={logoutAction} className="flex items-center gap-3 text-sm text-muted">
            <Link href="/admin/users" className="hover:text-foreground">
              {session.name} · {session.role}
            </Link>
            <button className="rounded border border-line px-2 py-1 hover:border-accent">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
