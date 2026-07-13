import type { ComponentItinerary, Release } from "./schemas";

/**
 * Compute the ProductComponentItinerary (UML, derived): for each component,
 * the span from the first release it appears in to the last. Pure function —
 * the itinerary is never stored, it's read off the releases on demand.
 *
 * `end` is null when the component is still in the product's most recent
 * release (i.e. still on board); otherwise it's the date of the last release
 * that included it.
 */
export function computeItinerary(releases: Release[]): ComponentItinerary[] {
  const sorted = [...releases].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return [];
  const latestDate = sorted[sorted.length - 1].date;

  const seen = new Map<
    string,
    { dates: string[]; versions: string[]; releases: string[] }
  >();
  for (const release of sorted) {
    for (const rc of release.components) {
      const entry =
        seen.get(rc.component) ?? { dates: [], versions: [], releases: [] };
      entry.dates.push(release.date);
      entry.versions.push(rc.version);
      entry.releases.push(release.version);
      seen.set(rc.component, entry);
    }
  }

  return [...seen.entries()]
    .map(([component, e]) => {
      const lastDate = e.dates[e.dates.length - 1];
      return {
        component,
        start: e.dates[0],
        end: lastDate === latestDate ? null : lastDate,
        firstRelease: e.releases[0],
        lastRelease: e.releases[e.releases.length - 1],
        versions: e.versions,
      };
    })
    .sort((a, b) => a.component.localeCompare(b.component));
}
