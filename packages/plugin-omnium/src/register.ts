/**
 * The shape of an Omnium `/full` record, and how to read its current values.
 * React- and fetch-free, so tests and scripts use it as is.
 *
 * A record is an entity with, per gegevenselement (GE) or relation, an array
 * of hubs under its json name (`edienst_namen`, `uitrol_resultaten`); each hub
 * holds its versions under `data`. Bitemporal bookkeeping: a hub or version
 * with `afvoer` was withdrawn; of the live versions the latest `opvoer` counts
 * (as Omnium's own `actueleData.js` does).
 */

export type Version = Record<string, unknown> & { versie?: number; opvoer?: string; afvoer?: string };
export type Hub = Record<string, unknown> & { data?: Version[]; opvoer?: string; afvoer?: string; weergavenaam?: string };
export type FullRecord = Record<string, unknown> & { id: number; opvoer?: string; afvoer?: string };

const time = (v: { opvoer?: string }) => (v.opvoer ? Date.parse(v.opvoer) || 0 : 0);

/** The current version of a hub: live (opvoer, no afvoer), the latest opvoer wins. */
export function currentVersion(hub: Hub): Version | undefined {
  let best: Version | undefined;
  for (const v of hub.data ?? []) {
    if (!v.opvoer || v.afvoer) continue;
    if (!best || time(v) >= time(best)) best = v;
  }
  return best;
}

type Moment = { datum?: string; opvoer?: string; afvoer?: string };

/** The live entry of an `aanvang`/`einde` list (latest opvoer, not withdrawn), as a time. */
function bound(list: unknown): number | undefined {
  if (!Array.isArray(list)) return undefined;
  let best: Moment | undefined;
  for (const m of list as Moment[]) {
    if (!m?.datum || !m.opvoer || m.afvoer) continue;
    if (!best || time(m) >= time(best)) best = m;
  }
  return best?.datum ? Date.parse(best.datum) : undefined;
}

/**
 * Material time: a hub of a materieel GE holds from its `aanvang` until its
 * `einde` (an uitrol's "bezig" ends where "geslaagd" begins). `/full` returns
 * every occurrence; this keeps those valid at `at`.
 */
export function validAt(hub: Hub, at: number): boolean {
  const from = bound(hub.aanvang);
  const until = bound(hub.einde);
  return (from === undefined || from <= at) && (until === undefined || at < until);
}

/** The moment `geldigOp` names (a date counts to its end), else now. */
export function momentOf(geldigOp?: string): number {
  if (!geldigOp) return Date.now();
  if (/^\d{4}-\d{2}-\d{2}$/.test(geldigOp)) return Date.parse(`${geldigOp}T23:59:59.999Z`);
  return Date.parse(geldigOp) || Date.now();
}

/** A record with only the hubs valid at `at` (material time); the rest of the record as is. */
export function asAt<T extends FullRecord>(record: T, at: number): T {
  const out: Record<string, unknown> = { ...record };
  for (const [k, v] of Object.entries(record)) {
    if (Array.isArray(v) && v.some((h) => h && typeof h === "object" && ("einde" in h || "aanvang" in h))) {
      out[k] = (v as Hub[]).filter((h) => validAt(h, at));
    }
  }
  return out as T;
}

/** The hubs of a GE or relation that are still there. */
export function currentHubs(record: Record<string, unknown> | undefined, key: string): Hub[] {
  const hubs = record?.[key];
  return Array.isArray(hubs) ? (hubs as Hub[]).filter((h) => h && !h.afvoer) : [];
}

/** An enkelvoudig GE: the current version of its (first) current hub. */
export function ge(record: Record<string, unknown> | undefined, key: string): Version | undefined {
  for (const hub of currentHubs(record, key)) {
    const v = currentVersion(hub);
    if (v) return v;
  }
  return undefined;
}

/** A meervoudig GE: the current version of each current hub. */
export function geRows(record: Record<string, unknown> | undefined, key: string): Version[] {
  return currentHubs(record, key)
    .map(currentVersion)
    .filter((v): v is Version => v !== undefined);
}

/** Bookkeeping keys: never shown as a value. */
export const TECHNICAL = new Set(["id", "rel_id", "domein_id", "versie", "opvoer", "afvoer", "data", "aanvang", "einde", "weergavenaam"]);

/** "EDienstVersie" → "edienstversie_id": the column an entity's hubs point back with. */
export function ownIdKey(typenaam: string): string {
  return `${typenaam.toLowerCase()}_id`;
}

/**
 * The id a relation hub points to. The target column is the relation's
 * secondary id (`edienst_id`; a self-relation `doel_artefact_id`); we take the
 * one `_id` column that is not the owner's own, preferring `doel_…`.
 */
export function targetId(hub: Hub, ownerKey: string): number | undefined {
  const v = currentVersion(hub) ?? {};
  const candidates = [...Object.entries(hub), ...Object.entries(v)].filter(
    ([k, val]) => k.endsWith("_id") && k !== ownerKey && k !== "rel_id" && k !== "domein_id" && typeof val === "number"
  );
  const doel = candidates.find(([k]) => k.startsWith("doel_"));
  return (doel ?? candidates[0])?.[1] as number | undefined;
}

export type Link = { id: number; weergavenaam?: string; velden: Version };

/** The current targets of a relation, with the relation's own fields (uitrol_resultaten: actie, doelUrl…). */
export function relation(record: Record<string, unknown> | undefined, key: string, ownerKey: string): Link[] {
  return currentHubs(record, key).flatMap((hub) => {
    const id = targetId(hub, ownerKey);
    if (id === undefined) return [];
    const velden = Object.fromEntries(Object.entries(currentVersion(hub) ?? {}).filter(([k]) => !TECHNICAL.has(k) && !k.endsWith("_id")));
    return [{ id, weergavenaam: typeof hub.weergavenaam === "string" ? hub.weergavenaam : undefined, velden }];
  });
}

/** A `$ref` value (a referentielijst item): a bare id, a numeric string, or `{ id }`. */
export function refId(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  if (value && typeof value === "object" && typeof (value as { id?: unknown }).id === "number") return (value as { id: number }).id;
  return undefined;
}

/** A value for display: dates and plain values as text, objects as compact JSON. */
export function display(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "ja" : "nee";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** "doelVersieRange" / "payload_hash" → "Doel versie range" / "Payload hash". */
export function humanize(key: string): string {
  const words = key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
