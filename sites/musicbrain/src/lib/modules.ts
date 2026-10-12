/**
 * A firmware module: a component of kind "software" whose slug starts with
 * "sw-" (publish_software.py names them so). The editors and the FPGA voice
 * are software too, but no module; they stay on /boards.
 */
export const isModule = (slug: string, kind: string | undefined) => kind === "software" && slug.startsWith("sw-");

/** The order of the families on /modules (MODULES, 12 October 2026); others follow alphabetically. */
export const MODULE_FAMILIES = [
  "Oscillators & voices",
  "Instruments",
  "Filters & shapers",
  "Delay & reverb",
  "Modulation effects & EQ",
  "Modulation & control",
  "Rhythm & sequencing",
  "Utilities",
];

const TAG_LABELS: Record<string, string> = { "mutable-instruments": "Mutable Instruments" };

/** "physical-model" → "Physical model"; a few names keep their own spelling. */
export const tagLabel = (tag: string) => TAG_LABELS[tag] ?? (tag.charAt(0).toUpperCase() + tag.slice(1)).replace(/-/g, " ");

/** /modules with a filter on: a family, or one tag. */
export const modulesHref = (filter: { family?: string; tag?: string }) => {
  const q = new URLSearchParams();
  if (filter.family) q.set("family", filter.family);
  if (filter.tag) q.set("tag", filter.tag);
  return `/modules${q.size ? `?${q}` : ""}`;
};
