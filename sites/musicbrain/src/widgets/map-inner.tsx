"use client";

import "leaflet/dist/leaflet.css";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import type { MapIslandProps } from "./map-island";

/**
 * The actual Leaflet map (client-only; loaded via next/dynamic ssr:false).
 * CircleMarkers instead of icon markers: pure SVG, so no marker-image asset
 * headaches under the bundler, and they take the accent colour.
 */
export default function MapInner({ center, zoom, markers }: MapIslandProps) {
  const fallback = center ?? markers[0] ?? { lat: 52.37, lng: 4.9 }; // A'dam
  const bounds =
    markers.length > 1
      ? ([
          [Math.min(...markers.map((m) => m.lat)), Math.min(...markers.map((m) => m.lng))],
          [Math.max(...markers.map((m) => m.lat)), Math.max(...markers.map((m) => m.lng))],
        ] as [[number, number], [number, number]])
      : undefined;

  return (
    <MapContainer
      {...(bounds
        ? { bounds, boundsOptions: { padding: [30, 30] } }
        : { center: [fallback.lat, fallback.lng] as [number, number], zoom })}
      scrollWheelZoom={false}
      className="z-0 h-full w-full rounded-lg border border-line"
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {markers.map((m, i) => (
        <CircleMarker
          key={i}
          center={[m.lat, m.lng]}
          radius={9}
          // Leaflet writes these as SVG attributes, which can't resolve CSS
          // vars — so these literals mirror --accent/--accent-strong.
          pathOptions={{ color: "#2ab5a8", fillColor: "#4fd1c5", fillOpacity: 0.8, weight: 2 }}
        >
          {(m.label || m.markdown) && (
            <Popup>
              {m.label && <strong className="mb-1 block">{m.label}</strong>}
              {m.markdown && (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.markdown}</ReactMarkdown>
              )}
            </Popup>
          )}
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
