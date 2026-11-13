import type { Vorm } from "./tekst";

/**
 * Where a learner stands: the best result per lesson, and the choice of
 * forms. Kept in the browser for everyone, and for a member also on the
 * server (the user store's member values), so it follows them to another
 * device. Pure: used in the browser, in the actions and in the tests.
 */
export type Score = { score: number; total: number; datum?: string };
export type Voortgang = Record<string, Score>;

/** What the server knows of whoever is looking. */
export type Stand = { ingelogd: false } | { ingelogd: true; naam: string; voortgang: Voortgang; vorm: Vorm | null };

/** The plugin's scope in the member values, and the key of a lesson's result there. */
export const SCOPE = "taal";
export const lesSleutel = (id: string): string => `les:${id}`;

const heel = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);

export function isScore(x: unknown): x is Score {
  if (!x || typeof x !== "object") return false;
  const s = x as Record<string, unknown>;
  if (!heel(s.total) || !heel(s.score) || s.total < 1 || s.total > 50 || s.score < 0 || s.score > s.total) return false;
  return s.datum === undefined || (typeof s.datum === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.datum));
}

export const isVorm = (x: unknown): x is Vorm => x === "m" || x === "v";

/** The better of two results: the larger share right, and of two equal ones the later. */
export function beste(a: Score | undefined, b: Score | undefined): Score | undefined {
  if (!a || !b) return a ?? b;
  const verschil = a.score / a.total - b.score / b.total;
  if (verschil !== 0) return verschil > 0 ? a : b;
  return (b.datum ?? "") > (a.datum ?? "") ? b : a;
}

/** What was kept in the browser, as far as it is a result. */
export function leesVoortgang(json: string | null): Voortgang {
  try {
    const alle = JSON.parse(json ?? "{}") as Record<string, unknown>;
    return Object.fromEntries(Object.entries(alle ?? {}).filter(([, s]) => isScore(s))) as Voortgang;
  } catch {
    return {};
  }
}

/** The browser's results and the server's as one: the best of each lesson, and what the server lacks. */
export function samenvoegen(lokaal: Voortgang, server: Voortgang): { samen: Voortgang; naarServer: Voortgang } {
  const samen: Voortgang = { ...server };
  const naarServer: Voortgang = {};
  for (const [id, score] of Object.entries(lokaal)) {
    const b = beste(server[id], score)!;
    samen[id] = b;
    if (b === score && b !== server[id]) naarServer[id] = score;
  }
  return { samen, naarServer };
}
