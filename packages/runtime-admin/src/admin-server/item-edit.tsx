import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ItemEditor } from "../admin/item-editor";
import type { AdminContext } from "../admin-context";
import type { AdminActions } from "./actions";
import { itemLang } from "@imprint/content-core";
import { withAccessOptions, withLocaleOptions } from "../forms";
import { accessGroups } from "./members";

/** Date → value for <input type="datetime-local"> (minute precision). */
function toLocalInput(date: Date | null | undefined): string | undefined {
  if (!date) return undefined;
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/**
 * The generic item editor for one content type: a form from the type's
 * schema, validity, and save. Pages are not handled here — the site routes
 * them to its studio (Fase 4 moves that here too).
 */
export async function ItemEditScreen({
  admin,
  type,
  slug,
  lang,
  actions,
}: {
  admin: AdminContext;
  type: string;
  slug: string | undefined;
  /** Absent = the language items of this type have by default (the site's base language for pages). */
  lang?: string;
  actions: Pick<AdminActions, "saveItem">;
}) {
  if (!admin.imprint.contentTypes.has(type, "editable")) notFound();
  // An asset's file part is the upload's, not a form's: it is edited in the library.
  if (type === "asset") redirect(slug ? `/admin/asset?open=${encodeURIComponent(slug)}` : "/admin/asset");
  const contentType = type;
  const def = admin.imprint.contentTypes.definition(type);
  const store = admin.imprint.writableStore!;

  const baseLang = itemLang(contentType, admin.imprint.defaultLocale);
  const item = slug ? await store.getItem(contentType, slug, lang ?? baseLang) : null;
  if (slug && !item) notFound();

  // Menu items point to pages; give the editor the real list to pick from.
  const pages =
    contentType === "menu"
      ? (await store.listItems("page")).map((p) => ({
          slug: p.slug,
          title: String((p.data as Record<string, unknown>).title ?? p.slug),
        }))
      : undefined;

  return (
    <div className="max-w-3xl">
      <p className="text-sm text-muted">
        <Link href={`/admin/${type}`} className="hover:text-foreground">
          ← {type}s
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {item ? `Edit ${type}: ${slug}` : `New ${type}`}
      </h1>
      <div className="mt-6">
        <ItemEditor
          type={contentType}
          initialData={(item?.data as Record<string, unknown>) ?? def.emptyData?.() ?? {}}
          formSchema={withLocaleOptions(withAccessOptions(admin.forms.content(contentType), await accessGroups(admin)), admin.imprint.locales)}
          isNew={!item}
          validFrom={toLocalInput(item?.validFrom)}
          validTo={toLocalInput(item?.validTo)}
          pages={pages}
          action={actions.saveItem}
        />
      </div>
    </div>
  );
}
