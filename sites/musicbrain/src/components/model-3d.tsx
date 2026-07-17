"use client";

import { useCallback, useEffect, useState } from "react";

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
        "touch-action"?: string;
        exposure?: string;
      };
    }
  }
}

/** The slice of ModelViewerElement this component talks to. */
type ModelViewerEl = HTMLElement & {
  loaded: boolean;
  getDimensions(): { x: number; y: number; z: number };
  getFieldOfView(): number;
  minCameraOrbit: string;
  cameraOrbit: string;
  jumpCameraToGoal(): void;
};

/**
 * Start the camera so the board fills the frame (Mark: "uitvullen in die
 * ruimte"). model-viewer's own % radius frames the bounding *sphere*, which
 * for a long flat board is far bigger than the board looks — hence the
 * postage-stamp start. So: measure the model, put its long axis across the
 * (wide) viewport, and compute the distance at which it just fits.
 */
function frameBoard(el: ModelViewerEl) {
  const { x: w, y: h, z: d } = el.getDimensions();
  const rect = el.getBoundingClientRect();
  if (!w || !rect.width) return;
  const azDeg = w >= d ? 20 : 70; // long axis left-to-right in view
  const az = (azDeg * Math.PI) / 180;
  const elev = (35 * Math.PI) / 180; // camera 35° above the horizon (polar 55°)
  const hExt = w * Math.abs(Math.cos(az)) + d * Math.abs(Math.sin(az));
  const vExt =
    (w * Math.abs(Math.sin(az)) + d * Math.abs(Math.cos(az))) * Math.sin(elev) +
    h * Math.cos(elev);
  const tanV = Math.tan(((el.getFieldOfView() || 30) * Math.PI) / 360);
  const tanH = tanV * (rect.width / rect.height);
  const r = Math.max(vExt / (2 * tanV), hExt / (2 * tanH)) * 1.06; // little air
  el.minCameraOrbit = "auto auto 5%"; // default clamp forbids coming this close
  el.cameraOrbit = `${azDeg}deg 55deg ${r}m`;
  el.jumpCameraToGoal();
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

  const mount = useCallback((node: HTMLElement | null) => {
    if (!node) return;
    const el = node as ModelViewerEl;
    const onLoad = () => frameBoard(el);
    if (el.loaded) onLoad();
    el.addEventListener("load", onLoad);
    return () => el.removeEventListener("load", onLoad);
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
      ref={mount}
      src={src}
      poster={poster}
      alt={alt}
      camera-controls
      bounds="tight"
      touch-action="pan-y"
      className="w-full rounded-lg border border-line bg-surface"
      // 16:9: boards are long and flat, widescreen wastes far less space.
      style={{ display: "block", width: "100%", aspectRatio: "16 / 9" }}
    />
  );
}
