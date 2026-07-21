import { canEdit, getSession } from "@/lib/auth";
import { writableStore } from "@/lib/content";
import { LoginForm } from "@/components/admin/login-form";
import { AdminShell } from "@/components/admin/admin-shell";

// Sessions live in a cookie, so everything under /admin renders per request.
export const dynamic = "force-dynamic";

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
    <AdminShell session={{ name: session.name, role: session.role }}>{children}</AdminShell>
  );
}
