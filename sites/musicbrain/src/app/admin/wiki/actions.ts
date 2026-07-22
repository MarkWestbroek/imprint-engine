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

/**
 * Publiceer een lokaal opgebouwde wiki naar de live site: POST per item op
 * de content-API van het doel (Bearer INGEST_TOKEN), in relatie-veilige
 * volgorde — wiki → folders (ouders eerst) → pagina's. Elke publicatie is
 * daar gewoon een nieuwe bitemporele versie; nogmaals publiceren = update.
 * Vereist in .env.local: PUBLISH_URL (bijv. https://musicbrain.nl) en
 * PUBLISH_TOKEN (het INGEST_TOKEN van het doel).
 */
export async function publishWikiAction(
  wikiSlug: string
): Promise<ActionResult & { published?: number }> {
  const session = await getSession();
  if (!canEdit(session) || !writableStore) return { ok: false, error: "Not signed in" };
  const base = process.env.PUBLISH_URL?.replace(/\/+$/, "");
  const token = process.env.PUBLISH_TOKEN;
  if (!base || !token) {
    return { ok: false, error: "Zet PUBLISH_URL en PUBLISH_TOKEN in sites/musicbrain/.env.local" };
  }

  try {
    const wikiRec = (await writableStore.listItems("wiki")).find((i) => i.slug === wikiSlug);
    if (!wikiRec) return { ok: false, error: `Wiki "${wikiSlug}" niet gevonden` };
    const wiki = WikiSchema.parse(wikiRec.data);

    const folders = (await writableStore.listItems("wiki-folder")).flatMap((r) => {
      const f = WikiFolderSchema.safeParse(r.data);
      return f.success && f.data.wiki === wikiSlug ? [f.data] : [];
    });
    const pages = (await writableStore.listItems("wiki-page")).flatMap((r) => {
      const p = WikiPageSchema.safeParse(r.data);
      return p.success && p.data.wiki === wikiSlug ? [p.data] : [];
    });

    // Ouders vóór kinderen (relatieregel wiki-folder.parent is enforced).
    const ordered: WikiFolder[] = [];
    const emitted = new Set<string>([""]);
    let remaining = [...folders];
    while (remaining.length > 0) {
      const ready = remaining.filter((f) => emitted.has(f.parent || ""));
      if (ready.length === 0) {
        ordered.push(...remaining); // wees-parents: laat de API het zeggen
        break;
      }
      for (const f of ready) {
        ordered.push(f);
        emitted.add(f.slug);
      }
      remaining = remaining.filter((f) => !emitted.has(f.slug));
    }

    const post = async (type: string, slug: string, data: unknown) => {
      const res = await fetch(`${base}/api/content/${type}/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`${type}/${slug}: ${res.status} ${text.slice(0, 200)}`);
      }
    };

    await post("wiki", wiki.slug, wiki);
    for (const f of ordered) await post("wiki-folder", f.slug, f);
    for (const p of pages) await post("wiki-page", p.slug, p);

    return { ok: true, published: 1 + ordered.length + pages.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Verwijderen (tombstone, herstelbaar via History). Compositie: een folder
 * verwijderen neemt zijn subfolders en pagina's mee — geen wees-pagina's.
 * De studio waarschuwt vooraf met de aantallen; hier voeren we alleen uit.
 */
export async function deleteWikiItemAction(
  kind: "wiki-folder" | "wiki-page",
  slug: string,
  lang: string,
  wikiSlug: string
): Promise<ActionResult & { deleted?: number }> {
  const session = await getSession();
  if (!canEdit(session) || !writableStore) return { ok: false, error: "Not signed in" };
  try {
    let deleted = 0;
    if (kind === "wiki-folder") {
      const [folderRecs, pageRecs] = await Promise.all([
        writableStore.listItems("wiki-folder"),
        writableStore.listItems("wiki-page"),
      ]);
      const folders = folderRecs.flatMap((r) => {
        const f = WikiFolderSchema.safeParse(r.data);
        return f.success && f.data.wiki === wikiSlug ? [f.data] : [];
      });
      // Alle nakomeling-folders (BFS over parent-verwijzingen).
      const doomed = new Set<string>([slug]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const f of folders) {
          if (!doomed.has(f.slug) && doomed.has(f.parent || "__none__")) {
            doomed.add(f.slug);
            grew = true;
          }
        }
      }
      for (const r of pageRecs) {
        const p = WikiPageSchema.safeParse(r.data);
        if (p.success && p.data.wiki === wikiSlug && doomed.has(p.data.folder)) {
          await writableStore.deleteItem("wiki-page", p.data.slug, p.data.lang);
          deleted++;
        }
      }
      for (const f of folders) {
        if (doomed.has(f.slug) && f.slug !== slug) {
          await writableStore.deleteItem("wiki-folder", f.slug, f.lang);
          deleted++;
        }
      }
    }
    await writableStore.deleteItem(kind, slug, lang);
    deleted++;
    refresh(wikiSlug);
    return { ok: true, deleted };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
