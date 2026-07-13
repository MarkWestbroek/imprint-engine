import type { BoardSpec } from "./schemas";

/**
 * Derive a board-widget config from a board-spec (D4): a page can just name a
 * spec and get the interactive hotspot render, instead of pasting widget JSON.
 * Each point's detail is the connector's pinout SVG (D10) when it names one,
 * else its own markdown. Shape matches the site's `board` widget config.
 */
export type DerivedBoardConfig = {
  image: string;
  alt: string;
  mode: "hover" | "expanded";
  points: {
    x: number;
    y: number;
    label?: string;
    markdown?: string;
    svgRef?: string;
  }[];
};

export function boardSpecToBoardConfig(
  spec: BoardSpec,
  opts: { mode?: "hover" | "expanded" } = {}
): DerivedBoardConfig {
  const image = spec.assets.renderTop ?? spec.assets.overview ?? "";
  return {
    image,
    alt: `${spec.component} ${spec.version}`,
    mode: opts.mode ?? "hover",
    points: spec.points.map((p) => ({
      x: p.x,
      y: p.y,
      label: p.label ?? p.connector,
      markdown: p.markdown,
      svgRef: p.connector ? spec.assets.pinouts[p.connector] : undefined,
    })),
  };
}
