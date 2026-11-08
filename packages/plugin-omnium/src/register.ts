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

type Bound = { datum?: string; opvoer?: string; afvoer?: string; versie?: number };

/**
 * The live `datum` of an `aanvang`/`einde`: a list or a single object. A
 * corrected einde is a new occurrence, the old one gets an afvoer (FUNDAMENT,
 * 8-11-2026); of the live ones the latest opvoer wins, then the highest versie.
 */
function bound(list: unknown): string | undefined {
  const all = Array.isArray(list) ? list : list && typeof list === "object" ? [list] : [];
  let best: Bound | undefined;
  for (const m of all as Bound[]) {
    if (!m?.datum || m.afvoer) continue;
    if (!best || time(m) > time(best) || (time(m) === time(best) && (m.versie ?? 0) >= (best.versie ?? 0))) best = m;
  }
  return best?.datum;
}

/**
 * A moment in material time: an instant, and the calendar day it falls on in
 * the Netherlands. A `datum` without a time (day precision) is compared by
 * day, a datum with a time by instant.
 */
export type MaterialMoment = { at: number; day: string };

const DAY = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" });
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** The moment `geldigOp` names (a date: that whole day), else now. */
export function momentOf(geldigOp?: string): MaterialMoment {
  if (geldigOp && isDay(geldigOp)) return { day: geldigOp, at: Date.parse(`${geldigOp}T21:59:59.999Z`) };
  const at = (geldigOp && Date.parse(geldigOp)) || Date.now();
  return { at, day: DAY.format(at) };
}

/**
 * Material time: a hub of a materieel GE holds from its `aanvang` until its
 * `einde`. With day precision (a date) the einde day is the last day it holds
 * (a drawing redrawn on the 6th ends on the 5th and begins on the 6th); with
 * a time, the einde is the first instant it no longer holds (an uitrol's
 * "bezig" ends where "geslaagd" begins). `/full` returns every occurrence;
 * this keeps those valid at the moment.
 */
export function validAt(hub: Hub, m: MaterialMoment): boolean {
  const from = bound(hub.aanvang);
  const until = bound(hub.einde);
  const started = !from || (isDay(from) ? from <= m.day : Date.parse(from) <= m.at);
  const ended = until !== undefined && (isDay(until) ? m.day > until : m.at >= Date.parse(until));
  return started && !ended;
}

/** A record with only the hubs valid at the moment (material time); the rest of the record as is. */
export function asAt<T extends FullRecord>(record: T, m: MaterialMoment): T {
  const out: Record<string, unknown> = { ...record };
  for (const [k, v] of Object.entries(record)) {
    if (Array.isArray(v) && v.some((h) => h && typeof h === "object" && ("einde" in h || "aanvang" in h))) {
      out[k] = (v as Hub[]).filter((h) => validAt(h, m));
    }
  }
  return out as T;
}

/** The hubs of a GE or relation that are still there. */
export function currentHubs(record: Record<string, unknown> | undefined, key: string): Hub[] {
  const hubs = record?.[key];
  return Array.isArray(hubs) ? (hubs as Hub[]).filter((h) => h && !h.afvoer) : [];
}

/**
 * An enkelvoudig GE: the current version of its current hub. A new
 * occurrence (an opvoer on the element) is a new hub; the latest counts.
 */
export function ge(record: Record<string, unknown> | undefined, key: string): Version | undefined {
  let best: Version | undefined;
  for (const hub of currentHubs(record, key)) {
    const v = currentVersion(hub);
    if (v && (!best || time(v) >= time(best))) best = v;
  }
  return best;
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
