import { AssetRecordSchema, ContentTypeRegistry, coreContentTypeDefinitions, type WritableContentStore } from "@imprint/content-core";
import { openContentDatabase } from "@imprint/content-core/db";
import { annotationsContentTypes } from "@imprint/plugin-annotations/content-types";
import { blogContentTypes } from "@imprint/plugin-blog/content-types";
import { eventsContentTypes } from "@imprint/plugin-events/content-types";
import { glossaryContentTypes } from "@imprint/plugin-glossary/content-types";
import { groupsContentTypes } from "@imprint/plugin-groups/content-types";
import { wikiContentTypes } from "@imprint/plugin-wiki/content-types";
import { widgetRegistry } from "../src/widgets/registry";

/**
 * What the two Pleio imports share (React-free): the store with this site's
 * types, and the bookkeeping of Pleio's files. A file imported into the
 * library remembers where it came from in `source` (the Pleio download URL,
 * which carries the file's guid); from that the map guid → asset is rebuilt
 * on every run, so there is no state besides the library itself.
 */

export const registry = ContentTypeRegistry.of(coreContentTypeDefinitions, wikiContentTypes, glossaryContentTypes, groupsContentTypes, blogContentTypes, eventsContentTypes, annotationsContentTypes);

/** The store with this site's widgets and content types, so it validates as the admin does. */
export function openSiteStore(url: string) {
  return openContentDatabase(url, { widgets: widgetRegistry, contentTypes: registry });
}

const GUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A link to a file on the Pleio site, in any of its shapes: /file/download/<guid>/<name>,
 * /files/view/<guid>/<name>, /attachment/entity/<guid>, /attachment/<guid>. The name may hold
 * balanced parentheses ("foto (1).jpg" in a Markdown link).
 */
export function fileUrlRe(origin: string): RegExp {
  const host = escapeRe(origin.replace(/^https?:\/\/(www\.)?/, ""));
  return new RegExp(`https?:\\/\\/(?:www\\.)?${host}\\/(?:file\\/download|files\\/view|attachment\\/entity|attachment)\\/(${GUID})(?:[/?](?:[^\\s"'\\\\<>()\\[\\]]|\\([^\\s()]*\\))*)?`, "g");
}

export type FileRef = { guid: string; url: string };

/** The file links in a piece of content (any JSON value), one per guid: the first URL seen. */
export function fileRefs(data: unknown, origin: string): FileRef[] {
  const seen = new Map<string, string>();
  for (const m of JSON.stringify(data).matchAll(fileUrlRe(origin))) if (!seen.has(m[1]!)) seen.set(m[1]!, m[0]);
  return [...seen].map(([guid, url]) => ({ guid, url }));
}

/** Where to fetch a file: the view page of a file is not the file. */
export const downloadUrl = (url: string) => url.replace("/files/view/", "/file/download/");

/** guid → asset slug, from the library: the assets whose `source` is a file of this Pleio site. */
export async function assetMap(store: WritableContentStore, origin: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const re = new RegExp(`^${escapeRe(origin)}\\/.*?(${GUID})`);
  for (const r of await store.listItems("asset")) {
    const a = AssetRecordSchema.safeParse(r.data);
    const guid = a.success ? re.exec(a.data.source ?? "")?.[1] : undefined;
    if (a.success && guid) map.set(guid, a.data.slug);
  }
  return map;
}

/** The same content with every imported file's link replaced by `asset:<slug>`; links to other files stay. */
export function rewriteFiles<T>(data: T, map: Map<string, string>, origin: string): T {
  if (map.size === 0) return data;
  const json = JSON.stringify(data);
  const out = json.replace(fileUrlRe(origin), (url, guid: string) => (map.has(guid) ? `asset:${map.get(guid)}` : url));
  return out === json ? data : (JSON.parse(out) as T);
}
