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

const ELEV = (35 * Math.PI) / 180; // camera 35° above the horizon (polar 55°)
const DEFAULT_ASPECT = 16 / 9;

/**
 * Fit pane and camera to the board (Mark: "uitvullen in die ruimte").
 * model-viewer's own % radius frames the bounding *sphere* — for a flat
 * board far bigger than it looks, hence the postage-stamp start. So we
 * measure the model, lay its long axis across the view, shape the pane to
 * the board's projected proportions (squarish board → squarish pane, long
 * board → wide pane), and compute the distance at which it just fits.
 * Two steps, because model-viewer re-derives its field of view when the
 * pane resizes: first shape the pane, then (fresh fov in hand) place the
 * camera.
 */
function projectedExtents(el: ModelViewerEl) {
  const { x: w, y: h, z: d } = el.getDimensions();
  if (!w && !d) return null;
  const azDeg = w >= d ? 20 : 70; // long axis left-to-right in view
  const az = (azDeg * Math.PI) / 180;
  const hExt = w * Math.abs(Math.cos(az)) + d * Math.abs(Math.sin(az));
  const vExt =
    (w * Math.abs(Math.sin(az)) + d * Math.abs(Math.cos(az))) * Math.sin(ELEV) +
    h * Math.cos(ELEV);
  // Extent along the view direction: the camera sits at board-scale distance,
  // so perspective is strong — the fit must hold at the *near* face, not the
  // centre, or the front edge looms out of frame.
  const dExt =
    (w * Math.abs(Math.sin(az)) + d * Math.abs(Math.cos(az))) * Math.cos(ELEV) +
    h * Math.sin(ELEV);
  return { azDeg, hExt, vExt, dExt };
}

function placeCamera(el: ModelViewerEl) {
  const ext = projectedExtents(el);
  const rect = el.getBoundingClientRect();
  if (!ext || !rect.width || !rect.height) return;
  const tanV = Math.tan(((el.getFieldOfView() || 30) * Math.PI) / 360);
  const tanH = tanV * (rect.width / rect.height);
  // Distance from the near face, plus half the depth to reach the centre.
  const r =
    (Math.max(ext.vExt / (2 * tanV), ext.hExt / (2 * tanH)) + ext.dExt / 2) * 1.04;
  el.minCameraOrbit = "auto auto 5%"; // default clamp forbids coming this close
  el.cameraOrbit = `${ext.azDeg}deg 55deg ${r}m`;
  el.jumpCameraToGoal();
}

export function Model3D({ src, poster, alt }: { src: string; poster?: string; alt: string }) {
  const [ready, setReady] = useState(false);
  const [aspect, setAspect] = useState(DEFAULT_ASPECT);

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
    const onLoad = () => {
      const ext = projectedExtents(el);
      if (!ext) return;
      // Step 1: shape the pane to the board. Step 2 (after the resize has
      // gone through model-viewer): place the camera with the fresh fov.
      setAspect(Math.min(2.4, Math.max(4 / 3, ext.hExt / ext.vExt)));
      setTimeout(() => placeCamera(el), 150);
    };
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
    // The wrapper owns the shape: aspect-ratio on <model-viewer> itself loses
    // from the element's internal host styling (the pane went ~5:1 wide).
    <div
      className="w-full overflow-hidden rounded-lg border border-line bg-surface"
      style={{ aspectRatio: String(aspect) }}
    >
      <model-viewer
        ref={mount}
        src={src}
        poster={poster}
        alt={alt}
        camera-controls
        bounds="tight"
        touch-action="pan-y"
        style={{ display: "block", width: "100%", height: "100%" }}
      />
    </div>
  );
}
