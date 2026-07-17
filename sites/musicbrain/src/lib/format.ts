/** Display a version with a single leading "v" (versions may or may not carry one). */
export function displayVersion(version: string): string {
  return "v" + version.replace(/^v/i, "");
}

/**
 * Heading label for a component kind: "board" → "Board", "software" →
 * "Software". Kinds are an open string list (MMB-FR component-kind), so we
 * just capitalize — no enum to migrate when a new kind appears.
 */
export function kindLabel(kind?: string): string {
  const k = (kind ?? "board").trim() || "board";
  return k.charAt(0).toUpperCase() + k.slice(1);
}
