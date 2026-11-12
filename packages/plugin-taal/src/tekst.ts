/**
 * Comparing what a learner typed or said with the answers of an exercise.
 * Pure (no store, no React): used in the browser and in the tests.
 */

/** Lenient: case, diacritics, punctuation and double spaces do not count. */
export const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.,!?¿¡‘’'"“”„…]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Levenshtein distance. */
export function afstand(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length]!;
}

/** Speech recognition makes small mistakes ("pinne" for "pinnen"): 85% alike is right. */
export function lijktOp(gehoord: string, goed: string): boolean {
  const a = norm(gehoord);
  const b = norm(goed);
  return a === b || 1 - afstand(a, b) / Math.max(b.length, 1) >= 0.85;
}

/** A typed answer is right when it equals one of the answers, leniently. */
export const typGoed = (invoer: string, antwoorden: string[]): boolean => antwoorden.some((a) => norm(a) === norm(invoer));

/** What was heard is right when one of the recogniser's alternatives resembles one of the answers. */
export const zegGoed = (alternatieven: string[], antwoorden: string[]): boolean =>
  alternatieven.some((alt) => antwoorden.some((a) => lijktOp(alt, a)));

/** The words of a sentence, for the ordering exercise. */
export const woorden = (zin: string): string[] => zin.split(/\s+/).filter(Boolean);

/** BCP 47 tags for speech synthesis and recognition in the browser. */
export const LOCALES: Record<string, string> = { nl: "nl-NL", pl: "pl-PL", it: "it-IT", de: "de-DE", en: "en-GB" };
export const localeOf = (taal: string): string => LOCALES[taal] ?? taal;
