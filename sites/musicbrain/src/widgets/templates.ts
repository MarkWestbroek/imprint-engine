/**
 * Layout templates: which regions exist and how they're arranged (grid
 * classes consumed by the PageRenderer). Shared with the admin composer,
 * so keep this file free of React and server imports.
 */
export const TEMPLATES: Record<string, { grid: string; regions: string[] }> = {
  single: { grid: "grid-cols-1", regions: ["main"] },
  "sidebar-left": { grid: "lg:grid-cols-[18rem_1fr]", regions: ["sidebar", "main"] },
  "sidebar-right": { grid: "lg:grid-cols-[1fr_18rem]", regions: ["main", "sidebar"] },
  "three-column": {
    grid: "lg:grid-cols-[16rem_1fr_16rem]",
    regions: ["left", "main", "right"],
  },
};
