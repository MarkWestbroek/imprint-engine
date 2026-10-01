"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type * as THREE from "three";

/**
 * The hardware unit assembling itself (assembly widget). A three.js scene
 * that loads the KiCad GLB of every part — the same files behind the "3D"
 * tab — and flies them from an exploded start to their seated position on a
 * shared timeline; the front panel is extruded from its SVG drawing, holes
 * and all. Lazy like Model3D: three and its loaders are imported on mount,
 * so the bundle never touches a page without an assembly on it.
 *
 * Coordinates: unit millimetres as in MusicBrainAssembly.FCMacro (x right,
 * y depth towards the back, z up), mapped onto three's y-up world with the
 * panel front at z = 0 and the unit centred on the origin. The GLBs are in
 * metres with the board in the XZ plane (KiCad's export); each is scaled to
 * mm and turned so its thin axis points along the configured normal.
 */
export type AssemblyPart = {
  id: string;
  label: string;
  src: string;
  at: [number, number, number];
  normal: "x" | "y" | "z";
  spin: number;
  flip: boolean;
  from: [number, number, number];
  start: number;
  duration: number;
};

export type AssemblyPanel = {
  svg: string;
  thickness: number;
  from: [number, number, number];
  start: number;
  duration: number;
};

export type AssemblySceneProps = {
  parts: AssemblyPart[];
  panel: AssemblyPanel | null;
  rails: boolean;
  width: number;
  height: number;
  seconds: number;
  autoplay: boolean;
  loop: boolean;
  audio?: string;
  caption?: string;
};

/** One thing that moves: a group, where it sits, where it comes from, when. */
type Mover = {
  object: THREE.Object3D;
  home: THREE.Vector3;
  offset: THREE.Vector3;
  start: number;
  duration: number;
  label: string;
};

/** SVG classes in frontpanel-v1.svg that are openings in the plate. */
const HOLE_CLASSES = new Set(["hole", "pot", "enc", "btn", "din", "usb", "mnt", "disp"]);

const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Three's addons live under examples/jsm; load them together with the core. */
async function loadThree() {
  const [three, gltf, svg, orbit] = await Promise.all([
    import("three"),
    import("three/examples/jsm/loaders/GLTFLoader.js"),
    import("three/examples/jsm/loaders/SVGLoader.js"),
    import("three/examples/jsm/controls/OrbitControls.js"),
  ]);
  return { T: three, GLTFLoader: gltf.GLTFLoader, SVGLoader: svg.SVGLoader, OrbitControls: orbit.OrbitControls };
}

export function AssemblyScene(props: AssemblySceneProps) {
  const { parts, panel, rails, width, height, seconds, autoplay, loop, audio, caption } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [status, setStatus] = useState<string>("Loading…");
  const [playing, setPlaying] = useState(autoplay);
  const [t, setT] = useState(0);
  const [activeLabel, setActiveLabel] = useState<string>("");
  // The animation loop reads these without re-subscribing on every change.
  const playingRef = useRef(playing);
  const tRef = useRef(0);
  const resetViewRef = useRef<() => void>(() => {});
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  const seek = useCallback(
    (value: number) => {
      tRef.current = value;
      setT(value);
      const a = audioRef.current;
      if (a && Number.isFinite(a.duration)) a.currentTime = Math.min(a.duration, value * seconds);
    },
    [seconds]
  );

  const togglePlay = useCallback(() => {
    const next = !playingRef.current;
    setPlaying(next);
    const a = audioRef.current;
    if (a) {
      // Sound only ever starts from this click: browsers block it otherwise,
      // and a page should not start singing on its own anyway.
      if (next) a.play().catch(() => {});
      else a.pause();
    }
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let alive = true;
    let raf = 0;
    let dispose = () => {};

    (async () => {
      const kit = await loadThree();
      if (!alive) return;
      const { T, OrbitControls } = kit;

      const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      host.appendChild(renderer.domElement);

      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(32, 16 / 9, 1, 6000);
      // Front-right-above, far enough for the seated unit to fit with margin;
      // the exploded parts fly in from outside the frame.
      const homeCamera = new T.Vector3(width * 1.25, height * 1.1, width * 2.0);
      const homeTarget = new T.Vector3(0, 0, -height * 0.25);
      camera.position.copy(homeCamera);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(homeTarget);
      controls.enableDamping = true;
      controls.autoRotateSpeed = 0.5;
      controls.minDistance = 120;
      controls.maxDistance = 2500;
      resetViewRef.current = () => {
        camera.position.copy(homeCamera);
        controls.target.copy(homeTarget);
        controls.update();
      };
      if (process.env.NODE_ENV !== "production") {
        // Dev only: lets a browser test (or a curious developer) place the
        // camera to check seating from the side or top.
        (window as unknown as { __assembly?: unknown }).__assembly = { camera, controls, seek: (v: number) => (tRef.current = v) };
      }

      scene.add(new T.HemisphereLight(0xffffff, 0x3a4350, 1.1));
      const key = new T.DirectionalLight(0xffffff, 1.7);
      key.position.set(250, 380, 420);
      scene.add(key);
      const fill = new T.DirectionalLight(0xbfd4ff, 0.6);
      fill.position.set(-300, 120, -260);
      scene.add(fill);

      // Unit mm → world: x centred, z up becomes y, depth goes to -z.
      const toWorld = (p: [number, number, number]) =>
        new T.Vector3(p[0] - width / 2, p[2] - height / 2, -p[1]);
      const toOffset = (p: [number, number, number]) => new T.Vector3(p[0], p[2], -p[1]);

      const movers: Mover[] = [];
      const total = parts.length + (panel ? 1 : 0);
      let done = 0;
      const tick = () => {
        done++;
        if (alive) setStatus(done < total ? `Loading ${done}/${total}…` : "");
      };

      // Boards: one GLB per URL, cloned for repeats (four jack8 fronts).
      const loader = new kit.GLTFLoader();
      const cache = new Map<string, Promise<THREE.Group>>();
      const loadModel = (src: string) => {
        let p = cache.get(src);
        if (!p) {
          p = loader.loadAsync(src).then((g) => g.scene);
          cache.set(src, p);
        }
        return p.then((g) => g.clone(true));
      };

      await Promise.all(
        parts.map(async (part) => {
          try {
            const model = await loadModel(part.src);
            model.scale.setScalar(1000); // metres → mm
            const box = new T.Box3().setFromObject(model);
            const size = box.getSize(new T.Vector3());
            // The thin axis of the box is the board's normal.
            const axes = [size.x, size.y, size.z];
            const thin = axes.indexOf(Math.min(...axes));
            const native = new T.Vector3(thin === 0 ? 1 : 0, thin === 1 ? 1 : 0, thin === 2 ? 1 : 0);
            const target =
              part.normal === "x" ? new T.Vector3(1, 0, 0)
              : part.normal === "z" ? new T.Vector3(0, 1, 0)
              : new T.Vector3(0, 0, 1);
            const q = new T.Quaternion().setFromUnitVectors(native, target);
            if (part.spin) q.premultiply(new T.Quaternion().setFromAxisAngle(target, (part.spin * Math.PI) / 180));
            if (part.flip) {
              const inPlane = part.normal === "z" ? new T.Vector3(0, 0, 1) : new T.Vector3(0, 1, 0);
              q.premultiply(new T.Quaternion().setFromAxisAngle(inPlane, Math.PI));
            }
            model.quaternion.copy(q);
            const group = new T.Group();
            group.add(model);
            // Seat the box centre on `at`.
            const centred = new T.Box3().setFromObject(group).getCenter(new T.Vector3());
            model.position.sub(centred);
            scene.add(group);
            movers.push({
              object: group,
              home: toWorld(part.at),
              offset: toOffset(part.from),
              start: part.start,
              duration: part.duration,
              label: part.label,
            });
          } catch (err) {
            console.warn(`assembly: could not load ${part.src}`, err);
          }
          tick();
        })
      );

      if (panel) {
        try {
          const text = await (await fetch(panel.svg)).text();
          const data = new kit.SVGLoader().parse(text);
          let plate: THREE.Shape | null = null;
          const holes: THREE.Shape[] = [];
          for (const path of data.paths) {
            const node = path.userData?.node as Element | undefined;
            const cls = node?.getAttribute("class") ?? "";
            const shapes = kit.SVGLoader.createShapes(path);
            if (cls === "panel" && shapes[0]) plate = shapes[0];
            else if (HOLE_CLASSES.has(cls)) holes.push(...shapes);
          }
          if (plate) {
            for (const h of holes) plate.holes.push(h);
            const geo = new T.ExtrudeGeometry(plate, { depth: panel.thickness, bevelEnabled: false });
            // SVG is y-down in mm with the plate at the origin; flip to y-up,
            // centre, and put the front face at z = 0 with the body behind it.
            geo.computeBoundingBox();
            // Copy the centre first: scale() refreshes boundingBox in place.
            const cx = (geo.boundingBox!.min.x + geo.boundingBox!.max.x) / 2;
            const cy = (geo.boundingBox!.min.y + geo.boundingBox!.max.y) / 2;
            geo.scale(1, -1, 1);
            geo.translate(-cx, cy, -panel.thickness);
            const mat = new T.MeshStandardMaterial({ color: 0xe8e5dd, metalness: 0.4, roughness: 0.42, side: T.DoubleSide });
            const mesh = new T.Mesh(geo, mat);
            const group = new T.Group();
            group.add(mesh);
            scene.add(group);
            movers.push({
              object: group,
              home: new T.Vector3(0, 0, 0),
              offset: toOffset(panel.from),
              start: panel.start,
              duration: panel.duration,
              label: "Front panel",
            });
          }
        } catch (err) {
          console.warn("assembly: could not build the panel", err);
        }
        tick();
      }

      if (rails) {
        const mat = new T.MeshStandardMaterial({ color: 0x6b7076, metalness: 0.7, roughness: 0.35 });
        for (const sign of [1, -1]) {
          const rail = new T.Mesh(new T.BoxGeometry(width + 10, 7, 10), mat);
          const group = new T.Group();
          group.add(rail);
          scene.add(group);
          movers.push({
            object: group,
            home: new T.Vector3(0, sign * (height / 2 - 3.5), -(panel?.thickness ?? 2) - 5),
            offset: new T.Vector3(0, sign * 60, 0),
            start: 0.94,
            duration: 0.06,
            label: "Eurorack rails",
          });
        }
      }

      const fit = () => {
        const w = host.clientWidth || 640;
        const h = Math.round(w * 9 / 16);
        renderer.setSize(w, h, false);
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = `${h}px`;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      fit();
      const ro = new ResizeObserver(fit);
      ro.observe(host);

      let last = performance.now();
      let lastLabel = "";
      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        const dt = (now - last) / 1000;
        last = now;
        if (playingRef.current) {
          let next = tRef.current + dt / seconds;
          if (next >= 1) {
            if (loop) {
              next = 0;
              const a = audioRef.current;
              if (a) a.currentTime = 0;
            } else {
              next = 1;
              setPlaying(false);
            }
          }
          tRef.current = next;
          setT(next);
        }
        const tt = tRef.current;
        let label = "";
        let labelStart = -1;
        for (const m of movers) {
          const p = clamp01((tt - m.start) / m.duration);
          const e = easeOutCubic(p);
          m.object.position.copy(m.home).addScaledVector(m.offset, 1 - e);
          if (tt >= m.start && p < 1 && m.start > labelStart) {
            label = m.label;
            labelStart = m.start;
          }
        }
        if (label !== lastLabel) {
          lastLabel = label;
          setActiveLabel(label);
        }
        controls.autoRotate = playingRef.current;
        controls.update();
        renderer.render(scene, camera);
      };
      raf = requestAnimationFrame(frame);

      dispose = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        controls.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })().catch((err) => {
      console.warn("assembly: scene failed", err);
      if (alive) setStatus("3D view unavailable in this browser.");
    });

    return () => {
      alive = false;
      dispose();
    };
    // The scene is built once per configuration; props are stable content.
  }, [parts, panel, rails, width, height, seconds, loop]);

  return (
    <figure className="m-0">
      <div className="relative overflow-hidden rounded-xl border border-line bg-surface">
        <div ref={hostRef} className="w-full" style={{ aspectRatio: "16 / 9" }} />
        {status && (
          <p className="pointer-events-none absolute left-3 top-3 rounded bg-background/80 px-2 py-1 font-mono text-xs text-muted">
            {status}
          </p>
        )}
        {activeLabel && !status && (
          <p className="pointer-events-none absolute left-3 top-3 rounded bg-background/80 px-2 py-1 font-mono text-xs text-accent">
            {activeLabel}
          </p>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={togglePlay}
          className="rounded-md border border-line px-3 py-1 font-semibold hover:border-accent"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "Pause" : "Play"}
        </button>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(t * 1000)}
          onChange={(e) => seek(Number(e.target.value) / 1000)}
          className="min-w-[8rem] flex-1 accent-[var(--accent)]"
          aria-label="Timeline"
        />
        <span className="font-mono text-xs text-muted">
          {(t * seconds).toFixed(0)}s / {seconds}s
        </span>
        <button
          type="button"
          onClick={() => resetViewRef.current()}
          className="text-xs text-muted underline underline-offset-4 hover:text-foreground"
        >
          Reset view
        </button>
        {audio && <audio ref={audioRef} src={audio} preload="none" loop={loop} />}
      </div>
      {caption && <figcaption className="mt-1 text-sm text-muted">{caption}</figcaption>}
    </figure>
  );
}
