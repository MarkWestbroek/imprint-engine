"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  WikiSchema,
  WikiFolderSchema,
  WikiPageSchema,
  type Wiki,
  type WikiFolder,
  type WikiPage,
} from "@imprint/content-core";
import { canEdit, getSession } from "@/lib/auth";
import { writableStore } from "@/lib/content";
import { scopedSlug, slugify } from "@/lib/wiki-href";
import type { ActionResult } from "../actions";

/**
 * Server actions voor de wiki-studio. Elke mutatie is een bitemporele put —
 * een pagina verplaatsen is alleen een folder-veldwijziging, dus History
 * blijft het verhaal van de structuur vertellen. Slugs worden per wiki
 * gescopet (wiki-prefix + nummering) zodat de redacteur alleen titels ziet.
 */

function refresh(wikiSlug: string) {
  revalidatePath("/", "layout"); // publieke wiki-route + site-cache
  revalidatePath(`/admin/wiki/${wikiSlug}`);
}

async function takenSlugs(type: "wiki" | "wiki-folder" | "wiki-page"): Promise<Set<string>> {
  return new Set((await writableStore!.listItems(type)).map((i) => i.slug));
}

export async function createWikiAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getSession();
  if (!canEdit(session) || !writableStore) return { ok: false, error: "Not signed in" };
  const title = String(formData.get("title") ?? "").trim();
  const lang = String(formData.get("lang") ?? "en");
  const slug = slugify(title);
  if (!slug) return { ok: false, error: "Titel is verplicht" };
  try {
    if ((await takenSlugs("wiki")).has(slug)) {
      return { ok: false, error: `Wiki "${slug}" bestaat al` };
    }
    const data = WikiSchema.parse({ slug, lang, title });
    await writableStore.putItem("wiki", slug, data, { lang, by: session.name });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  redirect(`/admin/wiki/${slug}`);
}

export async function saveWikiAction(wiki: Wiki): Promise<ActionResult> {
  const session = await getSession();
  if (!canEdit(session) || !writableStore) return { ok: false, error: "Not signed in" };
  try {
    const data = WikiSchema.parse(wiki);
    await writableStore.putItem("wiki", data.slug, data, { lang: data.lang, by: session.name });
    refresh(data.slug);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function createFolderAction(
  wikiSlug: string,
  parent: string,
  title: string,
  lang: string
): Promise<ActionResult & { slug?: string }> {
  const session = await getSession();
  if (!canEdit(session) || !writableStore) return { ok: false, error: "Not signed in" };
  try {
    const slug = scopedSlug(wikiSlug, title, await takenSlugs("wiki-folder"));
    const data = WikiFolderSchema.parse({ slug, lang, wiki: wikiSlug, parent, title });
    await writableStore.putItem("wiki-folder", slug, data, { lang, by: session.name });
    refresh(wikiSlug);
    return { ok: true, slug };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function createPageAction(
  wikiSlug: string,
  folder: string,
  title: string,
  lang: string
): Promise<ActionResult & { slug?: string }> {
  const session = await getSession();
  if (!canEdit(session) || !writableStore) return { ok: false, error: "Not signed in" };
  try {
    const slug = scopedSlug(wikiSlug, title, await takenSlugs("wiki-page"));
    const data = WikiPageSchema.parse({ slug, lang, wiki: wikiSlug, folder, title });
    await writableStore.putItem("wiki-page", slug, data, { lang, by: session.name });
    refresh(wikiSlug);
    return { ok: true, slug };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function saveFolderAction(folder: WikiFolder): Promise<ActionResult> {
  const session = await getSession();
  if (!canEdit(session) || !writableStore) return { ok: false, error: "Not signed in" };
  try {
    const data = WikiFolderSchema.parse(folder);
    await writableStore.putItem("wiki-folder", data.slug, data, { lang: data.lang, by: session.name });
    refresh(data.wiki);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function savePageAction(page: WikiPage): Promise<ActionResult> {
  const session = await getSession();
  if (!canEdit(session) || !writableStore) return { ok: false, error: "Not signed in" };
  try {
    const data = WikiPageSchema.parse(page);
    await writableStore.putItem("wiki-page", data.slug, data, { lang: data.lang, by: session.name });
    refresh(data.wiki);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Verplaats een pagina/folder naar `targetParent` op positie `index`, en
 * hernummer de broertjes (computeMove-stijl, zoals het planbord): alleen
 * items waarvan order of ouder wijzigt krijgen een nieuwe versie.
 * `targetParent` is de folderslug (pagina's) of de parent-folderslug —
 * "" = bovenin de wiki (alleen folders).
 */
export async function moveWikiItemAction(
  kind: "wiki-page" | "wiki-folder",
  slug: string,
  wikiSlug: string,
  targetParent: string,
  index: number
): Promise<ActionResult> {
  const session = await getSession();
  if (!canEdit(session) || !writableStore) return { ok: false, error: "Not signed in" };
  try {
    const records = await writableStore.listItems(kind);
    const items = records.flatMap((r) => {
      const parsed = (kind === "wiki-page" ? WikiPageSchema : WikiFolderSchema).safeParse(r.data);
      return parsed.success && parsed.data.wiki === wikiSlug ? [parsed.data] : [];
    }) as Array<WikiPage | WikiFolder>;

    const moved = items.find((i) => i.slug === slug);
    if (!moved) return { ok: false, error: `"${slug}" niet gevonden` };
    if (kind === "wiki-page" && !targetParent) {
      return { ok: false, error: "Pagina's leven in een folder" };
    }
    if (kind === "wiki-folder") {
      // Cykel-check: niet in zichzelf of een eigen nakomeling.
      const folders = items as WikiFolder[];
      let cursor = folders.find((f) => f.slug === targetParent);
      const seen = new Set<string>();
      while (cursor && !seen.has(cursor.slug)) {
        if (cursor.slug === slug) return { ok: false, error: "Kan een folder niet in zichzelf plaatsen" };
        seen.add(cursor.slug);
        cursor = folders.find((f) => f.slug === cursor!.parent);
      }
    }

    const parentOf = (i: WikiPage | WikiFolder) =>
      kind === "wiki-page" ? (i as WikiPage).folder : ((i as WikiFolder).parent || "");
    const siblings = items
      .filter((i) => parentOf(i) === targetParent && i.slug !== slug)
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
    const clamped = Math.max(0, Math.min(index, siblings.length));
    const movedNext =
      kind === "wiki-page"
        ? { ...(moved as WikiPage), folder: targetParent }
        : { ...(moved as WikiFolder), parent: targetParent };
    siblings.splice(clamped, 0, movedNext);

    for (let i = 0; i < siblings.length; i++) {
      const item = siblings[i];
      const changed = item.order !== i || (item.slug === slug && parentOf(moved) !== targetParent);
      if (!changed) continue;
      await writableStore.putItem(kind, item.slug, { ...item, order: i }, {
        lang: item.lang,
        by: session.name,
      });
    }
    refresh(wikiSlug);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Verwijderen (tombstone). Folders alleen als ze leeg zijn — geen cascade. */
export async function deleteWikiItemAction(
  kind: "wiki-folder" | "wiki-page",
  slug: string,
  lang: string,
  wikiSlug: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!canEdit(session) || !writableStore) return { ok: false, error: "Not signed in" };
  try {
    if (kind === "wiki-folder") {
      const [folders, pages] = await Promise.all([
        writableStore.listItems("wiki-folder"),
        writableStore.listItems("wiki-page"),
      ]);
      const hasChildren =
        folders.some((f) => (f.data as { parent?: string }).parent === slug) ||
        pages.some((p) => (p.data as { folder?: string }).folder === slug);
      if (hasChildren) {
        return { ok: false, error: "Folder is niet leeg — verplaats of verwijder eerst de inhoud" };
      }
    }
    await writableStore.deleteItem(kind, slug, lang);
    refresh(wikiSlug);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
