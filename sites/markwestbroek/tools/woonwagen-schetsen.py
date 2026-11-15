"""Schetsen van de woonwagen voor /woonwagen en /woonwagen/pl.

Een schematisch model van de wagen en per ingreep een render. Eén kleurregel:
oranje = wat er nu zit en aangepakt moet worden; blauw = hoe het wordt (nieuwe
delen, of de stand waarin het hoort); de rest grijs, glas donker.

Draaien (Blender 5.2, headless; vanuit de root van de repo):

    blender -b --factory-startup -P sites/markwestbroek/tools/woonwagen-schetsen.py

Het script schrijft de JPG's (schets-*.jpg) naar
sites/markwestbroek/public/woonwagen/ en overschrijft wat er staat. Een andere
uitvoermap kan als argument na "--":

    blender -b --factory-startup -P sites/markwestbroek/tools/woonwagen-schetsen.py -- <map>

Oriëntatie: voorop staan de dubbele deuren met de luifel en de dissel,
achterop de erker. Links en rechts gelden gezien vanaf de erker naar de deuren
(zoals de bestuurderskant in een auto links is). De linkerzijde is al
gerestaureerd; de rechterzijde, met de zijdeur, moet nog.

Assen: x = lengte (0 = voorkant, L = achterkant), y = breedte (+y = rechts),
z = omhoog. Maten van de rechterzijde komen uit Marks maatschets (1:40):
wand 190 hoog, 460 + deur 80 + 460 lang, ramen 242,5 / 133 / 133 breed en
105 hoog, deur 196 hoog. De rest (dakboog, linkerzijde, erker) is van foto's
geschat. Kleuren volgen de tokens van de site (globals.css).
"""
import bpy, math, sys, os
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

_args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = os.path.abspath(_args[0]) if _args else os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "woonwagen"))
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- maten
L, HW = 10.0, 1.5            # wandlengte (460 + 80 + 460), halve breedte
Z0 = 0.75                    # onderkant wand
Z1 = Z0 + 1.90               # bovenkant wand
ZS = Z0 + 0.85               # kleurgrens van de tweekleurige rechterzijde
RISE = 0.40                  # pijl van de dakboog
HOOD_F, HOOD_B = 0.65, 0.30  # dakoverstek voor (luifel) en achter
BW = 0.085                   # zichtbare breedte van een schroot (5 stuks = ca. 42 cm)
FR = 0.06                    # breedte kozijnhout
WIN_TOP = Z1 - 0.12
WIN_BOT = WIN_TOP - 1.05

def from_back(a, b):
    """Maatschets loopt van achter (erker) naar voor; zet om naar x vanaf de voorkant."""
    return (L - b, L - a)

# rechterzijde (+y): (x0, x1, z0, z1, stijlen als fractie van de breedte)
RIGHT_WINDOWS = {
    "w_wide": (*from_back(0.87, 0.87 + 2.425), WIN_BOT, WIN_TOP, (0.17, 0.80)),
    "w_mid":  (*from_back(5.84, 5.84 + 1.33), WIN_BOT, WIN_TOP, (0.65,)),
    "w_front": (*from_back(8.09, 8.09 + 1.33), WIN_BOT, WIN_TOP, (0.63,)),
}
RIGHT_DOOR = (*from_back(4.60, 5.40), Z0 - 0.05, Z0 - 0.05 + 1.96)
# voorstel: dubbele deur (2 x 70) en het raam ernaast smaller
PROP_DOOR = (RIGHT_DOOR[0] - 0.60, RIGHT_DOOR[1], RIGHT_DOOR[2], RIGHT_DOOR[3])
PROP_MID = (RIGHT_WINDOWS["w_mid"][0], PROP_DOOR[0] - 0.40, WIN_BOT, WIN_TOP, ())

# linkerzijde (-y), van foto's geschat
LEFT_WINDOWS = [(0.6, 1.85, WIN_BOT, WIN_TOP, (0.3,)), (3.5, 4.75, WIN_BOT, WIN_TOP, (0.3,)),
                (6.6, 9.1, WIN_BOT, WIN_TOP, (1 / 3, 2 / 3))]

SAG_AT = (7.1, 7.65)         # de twee ingezakte spanten, richting de achterkant
SAG = 0.25                   # overdreven getekend

# ---------------------------------------------------------------- kleuren
def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return (*[x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c], 1.0)

REAL = {
    "board_R_hi": "#e6dfc8", "board_R_lo": "#d8c47e", "frame_R": "#3d2a1e", "door_R": "#d9822b",
    "board_L": "#e4e0d6", "frame_L": "#c8641e", "front": "#e4e0d6", "back": "#e4e0d6",
    "door_F": "#9a6a2c", "erker": "#3d2a1e", "glass": "#2c3540", "skeleton": "#c9a46a",
    "floor": "#4a3428", "chassis": "#a8402c", "wheel": "#202124", "kist": "#8a5a2c",
    "roof": "#3e3f3d", "bow": "#a07a4a", "hood": "#3d2a1e",
}
GREY, GREY_D, GREY_L = "#7d8087", "#55585e", "#a3a6ad"
ORANGE, BLUE = "#f08a3c", "#45b5d6"
BG = "#1b1c1f"

# ---------------------------------------------------------------- bouwen
objs = []  # (object, tag, extra)

def reg(o, tag, **kw):
    objs.append((o, tag, kw))
    return o

def box(tag, x0, x1, y0, y1, z0, z1, **kw):
    bpy.ops.mesh.primitive_cube_add(size=1, location=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    o = bpy.context.active_object
    o.scale = (abs(x1 - x0), abs(y1 - y0), abs(z1 - z0))
    return reg(o, tag, **kw)

def curve(tag, pts, depth):
    cu = bpy.data.curves.new(tag, "CURVE"); cu.dimensions = "3D"
    sp = cu.splines.new("POLY"); sp.points.add(len(pts) - 1)
    for p, c in zip(sp.points, pts):
        p.co = (*c, 1)
    cu.bevel_depth = depth; cu.use_fill_caps = True
    o = bpy.data.objects.new(tag, cu); bpy.context.collection.objects.link(o)
    return reg(o, tag)

def arc_z(y, rise=RISE, half=HW + 0.1):
    return Z1 + rise * (1 - (y / half) ** 2)

def free_ranges(lo, hi, blocked):
    out, cur = [], lo
    for a, b in sorted(blocked):
        if b <= cur or a >= hi:
            continue
        if a > cur:
            out.append((cur, a))
        cur = max(cur, b)
    if cur < hi:
        out.append((cur, hi))
    return out

def side(sign, openings, prefix):
    """Schroten, kozijnen en glas van een lange zijde. openings: (x0,x1,z0,z1,stijlen,soort)."""
    face = sign * HW
    by0, by1 = sorted((face, face - sign * 0.022))
    for i in range(int(L / BW)):
        x0, x1 = i * BW + 0.005, (i + 1) * BW - 0.005
        xc = (x0 + x1) / 2
        blocked = [(o[2] - FR, o[3] + FR) for o in openings if o[0] - FR < xc < o[1] + FR]
        for z0, z1 in free_ranges(Z0, Z1, blocked):
            for a, b, low in ((z0, min(z1, ZS), True), (max(z0, ZS), z1, False)):
                if b - a > 0.005:
                    box(f"board_{prefix}", x0, x1, by0, by1, a, b, x=xc, low=low)
    fy0, fy1 = sorted((face + sign * 0.03, face - sign * 0.03))
    for (a, b, c, d, mull, kind) in openings:
        ftag = f"frame_{prefix}"
        box(ftag, a - FR, b + FR, fy0, fy1, d, d + FR, part=kind)
        box(ftag, a - FR, a, fy0, fy1, c, d, part=kind)
        box(ftag, b, b + FR, fy0, fy1, c, d, part=kind)
        if kind.startswith("door"):
            leaves = 2 if kind == "door_double" else 1
            w = (b - a) / leaves
            for k in range(leaves):
                l0, l1 = a + k * w + 0.01, a + (k + 1) * w - 0.01
                box(f"door_{prefix}", l0, l1, face - 0.012, face + 0.012, c, d, part=kind)
                box("glass", l0 + 0.1, l1 - 0.1, face - sign * 0.0, face + sign * 0.016, c + 0.95, d - 0.15, part=kind)
        else:
            box(ftag, a - FR, b + FR, fy0, fy1, c - FR, c, part=kind)
            for t in mull:
                m = a + (b - a) * t
                box(ftag, m - 0.03, m + 0.03, fy0, fy1, c, d, part=kind)
            box("glass", a, b, face - 0.005, face + 0.005, c, d, part=kind)

def skeleton(sign, openings):
    """Stijl- en regelwerk achter de schroten (alleen de rechterzijde wordt getoond)."""
    y0, y1 = sorted((sign * (HW - 0.03), sign * (HW - 0.09)))
    for (a, b, c, d, _m, _k) in openings:
        box("skeleton", a - FR - 0.06, a - FR, y0, y1, Z0, Z1)
        box("skeleton", b + FR, b + FR + 0.06, y0, y1, Z0, Z1)
        box("skeleton", a - FR - 0.06, b + FR + 0.06, y0, y1, d + FR, d + FR + 0.06)
        if c > Z0 + 0.1:
            box("skeleton", a - FR - 0.06, b + FR + 0.06, y0, y1, c - FR - 0.06, c - FR)
    x = 0.0
    while x <= L - 0.06 + 1e-6:
        xc = x + 0.03
        blocked = [(o[2] - FR - 0.06, o[3] + FR + 0.06) for o in openings if o[0] - FR - 0.06 < xc < o[1] + FR + 0.06]
        for z0, z1 in free_ranges(Z0, Z1, blocked):
            box("skeleton", x, x + 0.06, y0, y1, z0, z1)
        x += 0.6
    box("skeleton", 0, L, y0, y1, Z0, Z0 + 0.08)
    box("skeleton", 0, L, y0, y1, Z1 - 0.08, Z1)

def end_wall(xw, tag, hole):
    xs = (xw - 0.022, xw) if xw == 0 else (xw, xw + 0.022)
    for i in range(int(2 * HW / BW)):
        y0, y1 = -HW + i * BW + 0.005, -HW + (i + 1) * BW - 0.005
        yc = (y0 + y1) / 2
        top = arc_z(yc)
        if hole and hole[0] < yc < hole[1]:
            for z0, z1 in free_ranges(Z0, top, [(hole[2], hole[3])]):
                box(tag, *xs, y0, y1, z0, z1)
        else:
            box(tag, *xs, y0, y1, Z0, top)

def build(variant):
    for o, _t, _k in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    objs.clear()

    right = [(*v[:4], v[4], k) for k, v in RIGHT_WINDOWS.items()]
    if variant == "voorstel":
        right = [o for o in right if o[5] != "w_mid"]
        right.append((*PROP_MID[:4], (), "w_mid_new"))
        right.append((*PROP_DOOR, (), "door_double"))
    else:
        right.append((*RIGHT_DOOR, (), "door_single"))
    side(+1, right, "R")
    skeleton(+1, right)
    side(-1, [(*w[:4], w[4], f"w{i}") for i, w in enumerate(LEFT_WINDOWS)], "L")

    # voorkant: dubbele gesneden deuren
    end_wall(0.0, "front", (-0.72, 0.72, Z0, Z0 + 1.80))
    for (a, b) in ((-0.70, -0.01), (0.01, 0.70)):
        box("door_F", -0.05, 0.0, a, b, Z0 + 0.02, Z0 + 1.78)
        box("glass", -0.06, -0.05, a + 0.1, b - 0.1, Z0 + 0.85, Z0 + 1.65)
    # achterkant: erker met groot raam
    end_wall(L, "back", (-1.15, 1.15, Z0 + 0.55, Z1 - 0.05))
    E = 0.35
    box("erker", L, L + E, -1.2, 1.2, Z0 + 0.45, Z0 + 0.55)
    box("erker", L, L + E, -1.2, 1.2, Z1 - 0.05, Z1 + 0.05)
    for y in (-1.2, -0.42, 0.38, 1.15):
        box("erker", L + E - 0.06, L + E, y, y + 0.05, Z0 + 0.55, Z1 - 0.05)
    box("glass", L + E - 0.04, L + E - 0.02, -1.15, 1.15, Z0 + 0.55, Z1 - 0.05)
    for y in (-1.2, 1.15):
        box("erker", L, L + E, y, y + 0.05, Z0 + 0.55, Z1 - 0.05)

    # onderbouw
    box("floor", -0.05, L + 0.05, -HW - 0.03, HW + 0.03, Z0 - 0.15, Z0)
    for y in (-1.0, 1.0):
        box("chassis", -0.3, L - 0.3, y - 0.06, y + 0.06, 0.45, 0.6)
    box("kist", 3.9, 6.4, -1.1, 1.1, 0.12, 0.45)
    box("chassis", -2.0, -1.5, -0.05, 0.05, 0.47, 0.57)
    for y in (-1.0, 1.0):
        bpy.ops.mesh.primitive_cube_add(size=1)
        o = bpy.context.active_object
        o.scale = (1.66, 0.1, 0.1); o.location = (-0.95, y * 0.5, 0.52)
        o.rotation_euler = (0, 0, math.atan2(y * 1.0, 1.3))
        reg(o, "chassis")
    for xa in (2.2, 7.3):
        for y in (-1.05, 1.05):
            bpy.ops.mesh.primitive_cylinder_add(radius=0.36, depth=0.24, location=(xa, y, 0.36), rotation=(math.pi / 2, 0, 0))
            reg(bpy.context.active_object, "wheel")

    # dakspanten
    ys = [-HW + i * (2 * HW) / 24 for i in range(25)]
    xb = 0.25
    while xb < L:
        sag = any(abs(xb - s) < 0.27 for s in SAG_AT)
        d = SAG if sag else 0.0
        curve("bow_sag" if sag else "bow", [(xb, y, arc_z(y) - 0.06 - d * (1 - (y / HW) ** 2)) for y in ys], 0.04)
        if sag:
            curve("bow_ghost", [(xb, y, arc_z(y) - 0.06) for y in ys], 0.04)
        xb += 0.55

    # dakhuid in drie stukken (in de dakschets gaat het middelste stuk eraf)
    def skin(x0, x1, tag):
        me = bpy.data.meshes.new(tag)
        nx, ny = 20, 24
        verts = [(x0 + (x1 - x0) * i / nx, -(HW + 0.1) + (2 * HW + 0.2) * j / ny, 0) for i in range(nx + 1) for j in range(ny + 1)]
        verts = [(x, y, arc_z(y) + 0.01) for (x, y, _z) in verts]
        faces = [(i * (ny + 1) + j, i * (ny + 1) + j + 1, (i + 1) * (ny + 1) + j + 1, (i + 1) * (ny + 1) + j)
                 for i in range(nx) for j in range(ny)]
        me.from_pydata(verts, [], faces)
        o = bpy.data.objects.new(tag, me); bpy.context.collection.objects.link(o)
        o.modifiers.new("s", "SOLIDIFY").thickness = 0.05
        return reg(o, tag)
    skin(-HOOD_F, 5.9, "roof_a")
    skin(5.9, 8.5, "roof_b")
    skin(8.5, L + HOOD_B, "roof_c")
    yy = [-(HW + 0.1) + i * (2 * HW + 0.2) / 30 for i in range(31)]
    curve("hood", [(-HOOD_F, y, arc_z(y) - 0.05) for y in yy], 0.06)
    curve("hood", [(L + HOOD_B, y, arc_z(y) - 0.05) for y in yy], 0.05)

# ---------------------------------------------------------------- scene
sc = bpy.context.scene
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
sc.render.engine = "BLENDER_WORKBENCH"
sh = sc.display.shading
sh.light, sh.color_type = "STUDIO", "OBJECT"
sh.show_cavity, sh.cavity_type = True, "BOTH"
sh.show_object_outline, sh.object_outline_color = True, (0.05, 0.05, 0.06)
sc.display.render_aa = "16"
sc.render.resolution_x, sc.render.resolution_y = 1600, 1000
sc.render.image_settings.file_format = "JPEG"
sc.render.image_settings.quality = 88
sc.view_settings.view_transform = "Standard"
if sc.world is None:
    sc.world = bpy.data.worlds.new("w")
sc.world.color = srgb(BG)[:3]
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
bpy.context.collection.objects.link(cam)
sc.camera = cam

def visible_points():
    bpy.context.view_layer.update()
    pts = []
    for o, _t, _k in objs:
        if not o.hide_render:
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    return pts

def aim(direction_from, fill=0.94):
    """Perspectief: kijk vanuit die richting naar het midden van wat zichtbaar is, zo dicht als past."""
    cam.data.type, cam.data.lens = "PERSP", 35
    pts = visible_points()
    t = Vector([(min(p[i] for p in pts) + max(p[i] for p in pts)) / 2 for i in range(3)])
    d = -Vector(direction_from).normalized()
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    lo, hi = 1.0, 80.0
    for _ in range(40):
        mid = (lo + hi) / 2
        cam.location = t - d * mid
        bpy.context.view_layer.update()
        ok = all(0.5 - fill / 2 <= v.x <= 0.5 + fill / 2 and 0.5 - fill / 2 <= v.y <= 0.5 + fill / 2
                 for v in (world_to_camera_view(sc, cam, p) for p in pts))
        hi, lo = (mid, lo) if ok else (hi, mid)
    cam.location = t - d * hi

def elevation_right(fill=0.92):
    """Orthografisch aanzicht van de rechterzijde."""
    cam.data.type = "ORTHO"
    pts = visible_points()
    xs, zs = [p.x for p in pts], [p.z for p in pts]
    aspect = sc.render.resolution_x / sc.render.resolution_y
    cam.data.ortho_scale = max(max(xs) - min(xs), (max(zs) - min(zs)) * aspect) / fill
    cam.location = ((min(xs) + max(xs)) / 2, 40, (min(zs) + max(zs)) / 2)
    cam.rotation_euler = Vector((0, -1, 0)).to_track_quat("-Z", "Y").to_euler()

def paint(fn):
    for o, tag, kw in objs:
        c = fn(tag, kw)
        o.hide_render = c is None
        if c is not None:
            o.color = srgb(c)

def render(name):
    sc.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)

def real(tag, kw):
    if tag == "bow_ghost":
        return None
    if tag == "board_R":
        return REAL["board_R_lo"] if kw["low"] else REAL["board_R_hi"]
    if tag.startswith("roof"):
        return REAL["roof"]
    if tag in ("bow", "bow_sag"):
        return REAL["bow"]
    return REAL.get(tag, GREY)

def grey(tag):
    if tag == "glass":
        return REAL["glass"]
    return GREY_D if tag.startswith("roof") or tag in ("floor", "wheel", "kist") else GREY

FRONT_RIGHT = (-6.0, 9.5, 4.5)

# ---------------------------------------------------------------- renders
build("nu")

paint(real); aim(FRONT_RIGHT); render("schets-overzicht.jpg")

def zijwand(tag, kw):
    if tag == "bow_ghost":
        return None
    if tag == "board_R":
        return BLUE if kw["x"] < 2.0 else None
    if tag == "skeleton":
        return ORANGE
    return grey(tag)
paint(zijwand); aim((1.0, 10.0, 3.0)); render("schets-zijwand.jpg")

def kozijnen(tag, kw):
    if tag == "bow_ghost":
        return None
    if tag == "frame_R":
        return ORANGE
    if tag == "glass":
        return REAL["glass"]
    return grey(tag)
paint(kozijnen); aim(FRONT_RIGHT); render("schets-kozijnen.jpg")

def dak(tag, kw):
    if tag in ("roof_b",):
        return None
    if tag in ("roof_a", "roof_c"):
        return GREY_D
    if tag == "bow_sag":
        return ORANGE
    if tag == "bow_ghost":
        return BLUE
    return grey(tag)
paint(dak); aim((-3.0, 6.0, 8.0)); render("schets-dak.jpg")

def gevels(tag, kw):
    if tag == "bow_ghost":
        return None
    if tag in ("front", "back", "door_F", "erker", "hood"):
        return ORANGE
    if tag == "glass":
        return REAL["glass"]
    return grey(tag)
paint(gevels)
aim((-7.0, 5.0, 3.0)); render("schets-voorgevel.jpg")
aim((7.0, 5.0, 3.0)); render("schets-achtergevel.jpg")

# rechterzijde in aanzicht: nu, en het voorstel (dubbele deur, kleiner raam)
CHANGES = ("door_single", "door_double", "w_mid", "w_mid_new")
def aanzicht(highlight):
    def f(tag, kw):
        if tag == "bow_ghost" or tag.startswith("roof") or tag in ("bow", "bow_sag", "hood", "skeleton"):
            return None if tag != "roof_a" and tag != "roof_b" and tag != "roof_c" else GREY_D
        if kw.get("part") in CHANGES and tag in ("frame_R", "door_R", "glass"):
            return highlight
        if tag == "board_R":
            return GREY_L
        return grey(tag)
    return f
paint(aanzicht(ORANGE)); elevation_right(); render("schets-rechterzijde-nu.jpg")
build("voorstel")
paint(aanzicht(BLUE)); elevation_right(); render("schets-rechterzijde-voorstel.jpg")
print("Schetsen geschreven naar", OUT)
