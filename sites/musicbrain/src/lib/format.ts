/** Display a version with a single leading "v" (versions may or may not carry one). */
export function displayVersion(version: string): string {
  return "v" + version.replace(/^v/i, "");
}
