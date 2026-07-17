"use client";

import { useEffect, useState } from "react";

/**
 * 3D board view (MMB-request 3D-tab): a GLB in Google's <model-viewer>
 * (Apache-2.0, self-hosted via the npm bundle — no CDN). Lazy twice over:
 * this component only mounts when the 3D tab is first activated, and the
 * ~300 KB viewer bundle is dynamically imported on mount, so neither the
 * bundle nor the multi-MB GLB touches visitors who never click "3D".
 */

// <model-viewer> is a custom element; React 19 passes attributes straight
// through, TypeScript just needs to know the tag exists.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace React.JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        poster?: string;
        alt?: string;
        bounds?: string;
        "camera-controls"?: boolean;
        "camera-orbit"?: string;
        "touch-action"?: string;
        exposure?: string;
      };
    }
  }
}

export function Model3D({ src, poster, alt }: { src: string; poster?: string; alt: string }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    import("@google/model-viewer").then(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!ready) {
    // Poster placeholder while the viewer bundle loads (usually a blink).
    return poster ? (
      // eslint-disable-next-line @next/next/no-img-element -- stored render as poster
      <img src={poster} alt={alt} className="h-auto max-w-full rounded-lg" />
    ) : (
      <p className="text-sm text-muted">Loading 3D viewer…</p>
    );
  }

  return (
    <model-viewer
      src={src}
      poster={poster}
      alt={alt}
      camera-controls
      // Frame on the tight bounding box, not the bounding sphere — a long
      // flat board otherwise starts out postage-stamp small until you drag.
      bounds="tight"
      // The informative angle: three-quarter view from slightly above,
      // starting slightly inside the framed distance so the board fills.
      camera-orbit="30deg 55deg 92%"
      touch-action="pan-y"
      className="w-full rounded-lg border border-line bg-surface"
      // 16:9: boards are long and flat, widescreen wastes far less space.
      style={{ display: "block", width: "100%", aspectRatio: "16 / 9" }}
    />
  );
}
