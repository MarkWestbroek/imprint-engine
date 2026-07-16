"use client";

import dynamic from "next/dynamic";
import type { MapConfig } from "./registry";

/**
 * Leaflet touches `window` at import time, so the actual map (map-inner) is
 * loaded client-side only; server-side this renders a placeholder of the
 * right height, so the layout doesn't jump.
 */
const MapInner = dynamic(() => import("./map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center rounded-lg border border-line bg-background text-sm text-muted">
      Loading map…
    </div>
  ),
});

export type MapIslandProps = Pick<MapConfig, "center" | "zoom" | "height" | "markers">;

export function MapIsland(props: MapIslandProps) {
  return (
    <div style={{ height: props.height }} className="[&>*]:h-full">
      <MapInner {...props} />
    </div>
  );
}
