# -*- coding: utf-8 -*-
"""
Render the MusicBrain hardware assembly (the `assembly` widget's choreography)
to an mp4 with Blender — route A of the Cortex assembly video.

Same source of truth as the website: the widget config of a page (default:
sites/musicbrain/content/pages/cortex.json, or a live page via --base/--page),
the board-specs' own KiCad GLB models (fetched from the site's API and cached),
and the panel SVG. Coordinates are the macro's millimetres (x right, y depth
towards the back, z up); the scene is built in metres, Blender Z-up, with the
panel front at y = 0 and the unit centred on the origin.

    blender -b -P scripts/assembly-render/render_assembly.py -- \
        [--config sites/musicbrain/content/pages/cortex.json] \
        [--base https://musicbrain.nl] [--page cortex] \
        [--out out/assembly] [--quality preview|final] [--fps 30] \
        [--hold 6] [--audio path/to/take.wav]

Produces <out>.mp4 (plus <out>.blend for a look in the GUI). With --audio the
take is mixed under the video by ffmpeg (fade-out over the last two seconds).
"""
import argparse
import hashlib
import json
import math
import os
import re
import subprocess
import sys
import urllib.request
import xml.etree.ElementTree as ET

import bpy
from mathutils import Matrix, Vector

MM = 0.001

# ───────────────────────────── arguments ─────────────────────────────


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default="sites/musicbrain/content/pages/cortex.json", help="page JSON with an assembly widget")
    ap.add_argument("--base", default="https://musicbrain.nl", help="site for board-spec models and the panel SVG")
    ap.add_argument("--page", default=None, help="read the page from <base>/api/content/pages/<slug> instead of --config")
    ap.add_argument("--out", default="out/assembly", help="output path without extension")
    ap.add_argument("--quality", default="preview", choices=["preview", "final"])
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--hold", type=float, default=None, help="seconds the finished unit stays (default: widget's hold)")
    ap.add_argument("--audio", default=None, help="music under the video (wav/mp3/flac)")
    ap.add_argument("--cache", default=".cache/assembly-render")
    ap.add_argument("--stills", default=None, help="comma-separated seconds; render only those frames as PNGs (quick check)")
    return ap.parse_args(argv)


# ───────────────────────────── fetching ─────────────────────────────


def fetch(url, cache_dir, binary=True):
    os.makedirs(cache_dir, exist_ok=True)
    name = hashlib.sha1(url.encode()).hexdigest()[:16] + "-" + os.path.basename(url.split("?")[0])
    path = os.path.join(cache_dir, name)
    if not os.path.exists(path):
        print(f"  fetch {url}")
        with urllib.request.urlopen(url, timeout=60) as r, open(path, "wb") as f:
            f.write(r.read())
    if binary:
        return path
    with open(path, "rb") as f:
        return f.read().decode("utf-8")


def load_config(args):
    if args.page:
        page = json.loads(fetch(f"{args.base}/api/content/pages/{args.page}", args.cache, binary=False))
    else:
        with open(args.config, encoding="utf-8") as f:
            page = json.load(f)
    for row in page["layout"]["rows"]:
        for cell in row["cells"]:
            for w in cell["widgets"]:
                if w["type"] == "assembly":
                    return w["config"]
    sys.exit("no assembly widget on that page")


def model_url(base, spec, cache):
    data = json.loads(fetch(f"{base}/api/content/board-specs/{spec}", cache, binary=False))
    src = (data.get("assets") or {}).get("model3d")
    if not src:
        return None
    return src if src.startswith("http") else base + src


# ───────────────────────────── geometry ─────────────────────────────


def to_world(at, W, H):
    """Unit mm (x right, y depth back, z up) → Blender metres (x, y back, z up), unit centred."""
    return Vector(((at[0] - W / 2) * MM, at[1] * MM, (at[2] - H / 2) * MM))


def to_offset(d):
    return Vector((d[0] * MM, d[1] * MM, d[2] * MM))


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    root = bpy.data.objects.new(os.path.basename(path), None)
    bpy.context.scene.collection.objects.link(root)
    meshes = [o for o in new if o.type == "MESH"]
    for o in new:
        if o.parent is None or o.parent not in new:
            o.parent = root
    # KiCad exports soldermask and silkscreen as semi-transparent layers over
    # the FR4; stacked blending comes out olive in Eevee. Opaque, as on the
    # web, keeps the green on top.
    for o in meshes:
        for slot in o.material_slots:
            m = slot.material
            if not m or not m.use_nodes:
                continue
            bsdf = m.node_tree.nodes.get("Principled BSDF")
            if bsdf and "Alpha" in bsdf.inputs:
                bsdf.inputs["Alpha"].default_value = 1.0
            if hasattr(m, "surface_render_method"):
                m.surface_render_method = "DITHERED"
            elif hasattr(m, "blend_method"):
                m.blend_method = "OPAQUE"
    return root, meshes


def world_bbox(objs):
    pts = []
    for o in objs:
        for c in o.bound_box:
            pts.append(o.matrix_world @ Vector(c))
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def place_board(root, meshes, part, W, H):
    """Orient like the widget: KiCad's board normal (glTF +Y = Blender +Z after
    import) goes to the configured normal; spin around it, flip across the
    in-plane vertical axis; then seat the PCB plane itself on `at`."""
    normal = part.get("normal", "y")
    # Blender axes of the three.js world (three x,y,z → Blender x,-z,y).
    target = {"x": Vector((1, 0, 0)), "y": Vector((0, -1, 0)), "z": Vector((0, 0, 1))}[normal]
    in_plane = Vector((0, -1, 0)) if normal == "z" else Vector((0, 0, 1))
    rot = Vector((0, 0, 1)).rotation_difference(target).to_matrix().to_4x4()
    spin = math.radians(part.get("spin", 0) or 0)
    if spin:
        rot = Matrix.Rotation(spin, 4, target) @ rot
    if part.get("flip"):
        rot = Matrix.Rotation(math.pi, 4, in_plane) @ rot
    root.matrix_world = rot
    bpy.context.view_layer.update()
    lo, hi = world_bbox(meshes)
    centre = (lo + hi) / 2
    # The PCB: the mesh with the largest footprint in the board plane.
    axis = {"x": 0, "y": 1, "z": 2}[normal]
    best, best_area = None, -1
    for m in meshes:
        l, h = world_bbox([m])
        size = h - l
        area = 1.0
        for i in range(3):
            if i != axis:
                area *= size[i]
        if area > best_area:
            best_area, best = area, (l + h) / 2
    if best is not None:
        centre[axis] = best[axis]
    root.matrix_world = Matrix.Translation(-centre) @ rot
    bpy.context.view_layer.update()
    home = to_world(part["at"], W, H)
    return home


# ───────────────────────────── panel ─────────────────────────────

HOLE_CLASSES = {"hole", "pot", "enc", "btn", "din", "usb", "mnt", "disp", "audio"}


def circle_points(cx, cy, r, n=40):
    return [(cx + r * math.cos(2 * math.pi * i / n), cy + r * math.sin(2 * math.pi * i / n)) for i in range(n)]


def rounded_rect_points(x, y, w, h, rx, n=6):
    rx = min(rx, w / 2, h / 2)
    pts = []
    corners = [(x + w - rx, y + rx, -90), (x + w - rx, y + h - rx, 0), (x + rx, y + h - rx, 90), (x + rx, y + rx, 180)]
    for cx, cy, start in corners:
        for i in range(n + 1):
            a = math.radians(start + 90 * i / n)
            pts.append((cx + rx * math.cos(a), cy + rx * math.sin(a)))
    return pts


def material(name, color, metallic=0.0, roughness=0.5, emission=None):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = 1.5
    return m


def srgb(hexstr):
    h = hexstr.lstrip("#")
    return tuple(((int(h[i : i + 2], 16) / 255) ** 2.2) for i in (0, 2, 4))


def build_panel(svg_text, panel_cfg, W, H):
    """Plate with holes from the SVG (class panel = plate, HOLE_CLASSES = holes),
    plus the accessories the widget draws for disp/din/usb/btn/enc/pot/audio.
    Returns the panel root object (front face at y = 0, body towards +y)."""
    ns = {"svg": "http://www.w3.org/2000/svg"}
    tree = ET.fromstring(svg_text)
    th = panel_cfg.get("thickness", 2) * MM
    elements = list(tree.iter("{http://www.w3.org/2000/svg}rect")) + list(tree.iter("{http://www.w3.org/2000/svg}circle"))
    plate = next((e for e in elements if e.get("class") == "panel"), None)
    if plate is None:
        sys.exit("panel SVG has no element with class 'panel'")
    px, py, pw, ph = (float(plate.get(k)) for k in ("x", "y", "width", "height"))
    pcx, pcy = px + pw / 2, py + ph / 2

    def sx(x):
        return (x - pcx) * MM

    def sz(y):
        return -(y - pcy) * MM  # SVG y down → Blender z up

    curve = bpy.data.curves.new("panel", type="CURVE")
    curve.dimensions = "2D"
    curve.fill_mode = "BOTH"
    curve.extrude = th / 2

    def add_spline(points):
        sp = curve.splines.new("POLY")
        sp.points.add(len(points) - 1)
        for p, (x, y) in zip(sp.points, points):
            p.co = (sx(x), sz(y), 0, 1)
        sp.use_cyclic_u = True

    add_spline(rounded_rect_points(px, py, pw, ph, float(plate.get("rx", 0) or 0)))
    fixtures = []
    for e in elements:
        cls = e.get("class", "")
        if cls not in HOLE_CLASSES:
            continue
        if e.tag.endswith("circle"):
            cx, cy, r = (float(e.get(k)) for k in ("cx", "cy", "r"))
            add_spline(circle_points(cx, cy, r))
            fixtures.append((cls, cx, cy, 2 * r, 2 * r))
        else:
            x, y, w, h = (float(e.get(k)) for k in ("x", "y", "width", "height"))
            add_spline(rounded_rect_points(x, y, w, h, float(e.get("rx", 0) or 0)))
            fixtures.append((cls, x + w / 2, y + h / 2, w, h))

    plate_obj = bpy.data.objects.new("panel", curve)
    bpy.context.scene.collection.objects.link(plate_obj)
    plate_obj.data.materials.append(material("panel", srgb("#e8e5dd"), metallic=0.4, roughness=0.42))
    # Curve lies in XY (z = extrude axis); stand it up: front face at y = 0, body to +y.
    plate_obj.matrix_world = Matrix.Translation((0, th / 2, 0)) @ Matrix.Rotation(math.radians(90), 4, "X")
    root = bpy.data.objects.new("panel-root", None)
    bpy.context.scene.collection.objects.link(root)
    plate_obj.parent = root

    if panel_cfg.get("accessories", True):
        dark = material("dark", srgb("#23262b"), 0.3, 0.6)
        black = material("black", srgb("#0b0c0e"), 0.0, 0.9)
        metal = material("metal", srgb("#b9bdc3"), 0.85, 0.3)
        red = material("red", srgb("#8a2d26"), 0.0, 0.5)
        glass = material("glass", srgb("#0f3a4a"), 0.0, 0.2, emission=srgb("#1d6f86"))

        def plug(cx, cy, r, front, length, mat):
            # Cylinder along depth (y): front face at y = -front (proud) … +length behind.
            bpy.ops.mesh.primitive_cylinder_add(radius=r * MM, depth=length * MM, vertices=48)
            o = bpy.context.active_object
            o.rotation_euler = (math.radians(90), 0, 0)
            o.location = (sx(cx), (-front + length / 2) * MM, sz(cy))
            o.data.materials.append(mat)
            o.parent = root
            return o

        def slab(cx, cy, w, h, front, length, mat):
            bpy.ops.mesh.primitive_cube_add(size=1)
            o = bpy.context.active_object
            o.scale = (w * MM, length * MM, h * MM)
            o.location = (sx(cx), (-front + length / 2) * MM, sz(cy))
            o.data.materials.append(mat)
            o.parent = root
            return o

        thmm = panel_cfg.get("thickness", 2)
        for cls, cx, cy, w, h in fixtures:
            if cls == "disp":
                slab(cx, cy, w + 2, h + 2, -thmm, 6, black)
                slab(cx, cy, w - 3, h - 3, -thmm + 0.6, 0.4, glass)
            elif cls == "din":
                plug(cx, cy, w / 2 - 0.3, 0.6, 14, dark)
                plug(cx, cy, w * 0.33, 0.7, 1.2, black)
            elif cls == "usb":
                slab(cx, cy, w, h, 0.2, 10, metal)
                slab(cx, cy, 8.9, 3.2, 0.4, 1.0, black)
            elif cls == "btn":
                plug(cx, cy, w / 2 - 0.4, 2, 5, red)
            elif cls == "enc":
                plug(cx, cy, 7, 12, 13, dark)
            elif cls == "pot":
                plug(cx, cy, 5.5, 11, 12, dark)
            elif cls == "audio":
                plug(cx, cy, w / 2 + 0.6, 1.6, 1.6, metal)
                plug(cx, cy, w / 2 - 0.6, 1.8, 14, dark)
                plug(cx, cy, w / 2 - 2.2, 1.9, 1, black)
    return root


def build_rails(W, H, th_mm):
    mat = material("rail", srgb("#6b7076"), 0.7, 0.35)
    rails = []
    for sign in (1, -1):
        bpy.ops.mesh.primitive_cube_add(size=1)
        o = bpy.context.active_object
        o.scale = ((W + 10) * MM, 10 * MM, 7 * MM)
        o.data.materials.append(mat)
        home = Vector((0, (th_mm + 5) * MM, sign * (H / 2 - 3.5) * MM))
        rails.append((o, home, Vector((0, 0, sign * 60 * MM))))
    return rails


# ───────────────────────────── animation ─────────────────────────────


def fcurves_of(obj):
    """F-curves of an object's action — Blender 5 keeps them per slot (layered actions)."""
    ad = obj.animation_data
    if not ad or not ad.action:
        return []
    if hasattr(ad.action, "fcurves"):
        return ad.action.fcurves
    from bpy_extras import anim_utils
    bag = anim_utils.action_get_channelbag_for_slot(ad.action, ad.action_slot)
    return bag.fcurves if bag else []


def ease_keys(obj, home, offset, start_s, dur_s, fps):
    f0, f1 = round(start_s * fps), round((start_s + dur_s) * fps)
    obj.location = home + offset
    obj.keyframe_insert("location", frame=0)
    obj.keyframe_insert("location", frame=f0)
    obj.location = home
    obj.keyframe_insert("location", frame=max(f1, f0 + 1))
    for fc in fcurves_of(obj):
        for kp in fc.keyframe_points:
            kp.interpolation = "CUBIC"
            kp.easing = "EASE_OUT"


# ───────────────────────────── scene ─────────────────────────────


def setup_scene(args, W, H, total_s):
    scene = bpy.context.scene
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    scene.render.fps = args.fps
    scene.frame_start = 0
    scene.frame_end = round(total_s * args.fps)
    final = args.quality == "final"
    scene.render.resolution_x, scene.render.resolution_y = (1920, 1080) if final else (1280, 720)
    scene.render.resolution_percentage = 100
    for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    if hasattr(scene, "eevee"):
        scene.eevee.taa_render_samples = 64 if final else 16
    scene.render.film_transparent = False
    world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (*srgb("#141a22"), 1)
    bg.inputs["Strength"].default_value = 0.6

    # Lights: key, fill, rim — the widget's hemisphere + two directionals, roughly.
    def sun(name, rot, energy, color=(1, 1, 1)):
        bpy.ops.object.light_add(type="SUN", rotation=rot)
        L = bpy.context.active_object
        L.name = name
        L.data.energy = energy
        L.data.color = color
        L.data.angle = math.radians(8)
        return L

    sun("key", (math.radians(55), math.radians(-20), math.radians(35)), 1.6)
    sun("fill", (math.radians(70), math.radians(30), math.radians(-120)), 0.5, (0.78, 0.85, 1.0))
    sun("rim", (math.radians(-60), 0, math.radians(160)), 0.7)
    # Plain view transform: the site shows the KiCad colours as they are.
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"

    # Camera on a slowly turning pivot, front-right-above like the widget's home view.
    bpy.ops.object.empty_add(location=(0, 30 * MM, 0))
    pivot = bpy.context.active_object
    pivot.name = "camera-pivot"
    bpy.ops.object.camera_add()
    cam = bpy.context.active_object
    cam.data.lens = 45
    cam.data.clip_end = 100
    # Far enough that the exploded panel (140 mm in front) stays in frame.
    cam.location = (W * 1.3 * MM, -W * 2.7 * MM, H * 1.25 * MM)
    cam.parent = pivot
    # Point at the pivot.
    track = cam.constraints.new("TRACK_TO")
    track.target = pivot
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"
    scene.camera = cam
    pivot.rotation_euler = (0, 0, math.radians(18))
    pivot.keyframe_insert("rotation_euler", frame=0)
    pivot.rotation_euler = (0, 0, math.radians(18 - 40))
    pivot.keyframe_insert("rotation_euler", frame=scene.frame_end)
    for fc in fcurves_of(pivot):
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"
    return scene


def main():
    args = parse_args()
    cfg = load_config(args)
    W, H = cfg.get("width", 200), cfg.get("height", 128.5)
    seconds = cfg.get("seconds", 24)
    hold = args.hold if args.hold is not None else cfg.get("hold", 8)
    total = seconds + hold
    print(f"assembly: {len(cfg.get('parts', []))} parts, {W}×{H} mm, {seconds}s + {hold}s hold, {args.quality}")

    scene = setup_scene(args, W, H, total)

    for part in cfg.get("parts", []):
        url = model_url(args.base, part["spec"], args.cache)
        if not url:
            print(f"  ! no 3D model for {part['spec']}, skipped")
            continue
        path = fetch(url, args.cache)
        root, meshes = import_glb(path)
        root.name = part.get("label") or part["spec"]
        home = place_board(root, meshes, part, W, H)
        # Keep the orientation, animate the root's location via a parent group.
        group = bpy.data.objects.new(root.name + "-mover", None)
        scene.collection.objects.link(group)
        root.parent = group
        ease_keys(group, home, to_offset(part.get("from", [0, -120, 0])), part.get("start", 0) * seconds, part.get("duration", 0.1) * seconds, args.fps)

    panel = cfg.get("panel")
    th_mm = (panel or {}).get("thickness", 2)
    if panel:
        svg_url = panel["svg"] if panel["svg"].startswith("http") else args.base + panel["svg"]
        svg_text = fetch(svg_url, args.cache, binary=False)
        proot = build_panel(svg_text, panel, W, H)
        ease_keys(proot, Vector((0, 0, 0)), to_offset(panel.get("from", [0, -140, 0])), panel.get("start", 0.86) * seconds, panel.get("duration", 0.1) * seconds, args.fps)

    if cfg.get("rails", True):
        for o, home, off in build_rails(W, H, th_mm):
            ease_keys(o, home, off, 0.94 * seconds, 0.06 * seconds, args.fps)

    os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.out + ".blend"))

    if args.stills:
        scene.render.image_settings.file_format = "PNG"
        for t in (float(s) for s in args.stills.split(",")):
            scene.frame_set(round(t * args.fps))
            scene.render.filepath = os.path.abspath(f"{args.out}-{t:g}s.png")
            bpy.ops.render.render(write_still=True)
            print(f"still → {scene.render.filepath}")
        return

    video = os.path.abspath(args.out + ("-video.mp4" if args.audio else ".mp4"))
    scene.render.image_settings.file_format = "FFMPEG"
    scene.render.ffmpeg.format = "MPEG4"
    scene.render.ffmpeg.codec = "H264"
    scene.render.ffmpeg.constant_rate_factor = "HIGH" if args.quality == "final" else "MEDIUM"
    scene.render.ffmpeg.gopsize = args.fps
    scene.render.filepath = video
    print(f"rendering {scene.frame_end + 1} frames → {video}")
    bpy.ops.render.render(animation=True)

    if args.audio:
        out = os.path.abspath(args.out + ".mp4")
        fade_at = max(0.0, total - 2.0)
        cmd = ["ffmpeg", "-y", "-i", video, "-i", os.path.abspath(args.audio), "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
               "-af", f"afade=t=in:st=0:d=1,afade=t=out:st={fade_at:.2f}:d=2", "-shortest", "-movflags", "+faststart", out]
        print("mixing audio:", " ".join(cmd))
        subprocess.run(cmd, check=True)
        print(f"done → {out}")
    else:
        print(f"done → {video} (no audio; add --audio <take> to mix music under it)")


if __name__ == "__main__":
    main()
