import type { LayoutRow, PageLayout } from "@imprint/content-core";

/**
 * Layout helpers shared by the renderer and the admin composer. Keep this
 * file free of React and server imports.
 *
 * The layout model is rows → cells (with a relative width `span`) → widgets.
 * Older content used a named template + region-tagged widgets; LEGACY maps
 * those onto the rows model so it keeps rendering and opens fine in the
 * composer (which then saves rows).
 */

const LEGACY: Record<string, { name: string; span: number }[]> = {
  single: [{ name: "main", span: 1 }],
  "sidebar-left": [
    { name: "sidebar", span: 1 },
    { name: "main", span: 2 },
  ],
  "sidebar-right": [
    { name: "main", span: 2 },
    { name: "sidebar", span: 1 },
  ],
  "three-column": [
    { name: "left", span: 1 },
    { name: "main", span: 2 },
    { name: "right", span: 1 },
  ],
};

/** Any PageLayout (new or legacy) → rows the renderer/composer understand. */
export function layoutRows(layout: PageLayout): LayoutRow[] {
  if (layout.rows && layout.rows.length > 0) return layout.rows;
  const regions = LEGACY[layout.template ?? "single"] ?? LEGACY.single;
  const widgets = layout.widgets ?? [];
  return [
    {
      cells: regions.map((region) => ({
        span: region.span,
        widgets: widgets
          .filter((w) => (w.region ?? "main") === region.name)
          .map(({ type, config }) => ({ type, config })),
      })),
    },
  ];
}

/** Starting points for a fresh layout in the composer (all cells empty). */
export const LAYOUT_PRESETS = [
  { label: "One column", rows: [{ cells: [{ span: 1, widgets: [] }] }] },
  {
    label: "Sidebar left",
    rows: [
      {
        cells: [
          { span: 1, widgets: [] },
          { span: 2, widgets: [] },
        ],
      },
    ],
  },
  {
    label: "Sidebar right",
    rows: [
      {
        cells: [
          { span: 2, widgets: [] },
          { span: 1, widgets: [] },
        ],
      },
    ],
  },
  {
    label: "Three columns",
    rows: [
      {
        cells: [
          { span: 1, widgets: [] },
          { span: 1, widgets: [] },
          { span: 1, widgets: [] },
        ],
      },
    ],
  },
];
