"""Generates the mod's textures and pack icons.

Run from the repo root:  npm run art   (or: python -I art/generate.py)
Textures are pixel-art painted in code so they can be regenerated and tweaked.
They can also be opened and hand-edited in Blockbench / any pixel editor afterwards.
"""
import random
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RP = ROOT / "packs" / "RP"
BP = ROOT / "packs" / "BP"


def jitter(rgb, rng, amount=12):
    return tuple(max(0, min(255, c + rng.randint(-amount, amount))) for c in rgb) + (255,)


def fill(img, x0, y0, w, h, rgb, rng, amount=12):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            img.putpixel((x, y), jitter(rgb, rng, amount))


# --------------------------------------------------------------------------- Gazer
FLESH = (112, 28, 42)
FLESH_DARK = (74, 16, 30)
VEIN = (160, 40, 60)
SCLERA = (240, 232, 205)
SCLERA_VEIN = (196, 58, 58)
IRIS_OUT = (214, 120, 20)
IRIS_IN = (250, 196, 40)
PUPIL = (12, 6, 10)
TENTACLE = (78, 30, 86)
TENTACLE_TIP = (150, 70, 150)
BONE = (226, 214, 180)


def paint_eye_face(img, ox, oy, rng):
    """10x10 eye front face with lids, veined sclera, slit pupil."""
    for y in range(10):
        for x in range(10):
            img.putpixel((ox + x, oy + y), jitter(SCLERA, rng, 6))
    # eyelids (top and bottom rows) + corners
    for x in range(10):
        img.putpixel((ox + x, oy), jitter(FLESH_DARK, rng, 8))
        img.putpixel((ox + x, oy + 9), jitter(FLESH_DARK, rng, 8))
    for y in (1, 8):
        for x in (0, 9):
            img.putpixel((ox + x, oy + y), jitter(FLESH_DARK, rng, 8))
    # bloodshot veins creeping in from the edges
    for sx, sy, dx, dy in [(0, 3, 1, 0), (9, 5, -1, 0), (1, 6, 1, 0), (8, 2, -1, 0)]:
        x, y = sx, sy
        for _ in range(3):
            img.putpixel((ox + x, oy + y), jitter(SCLERA_VEIN, rng, 10))
            x += dx
            y += rng.choice((-1, 0, 0, 1))
            y = max(1, min(8, y))
    # iris (6x6 rounded) and vertical slit pupil
    for y in range(2, 8):
        for x in range(2, 8):
            if (x in (2, 7)) and (y in (2, 7)):
                continue
            ring = x in (2, 7) or y in (2, 7)
            img.putpixel((ox + x, oy + y), jitter(IRIS_OUT if ring else IRIS_IN, rng, 10))
    for y in range(2, 8):
        img.putpixel((ox + 4, oy + y), PUPIL + (255,))
        img.putpixel((ox + 5, oy + y), PUPIL + (255,))
    img.putpixel((ox + 6, oy + 3), (255, 255, 255, 255))  # glint


def make_gazer():
    rng = random.Random(1337)
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))

    # body box (uv 0,0, 10x10x10) -> 40x20 region, flesh everywhere first
    fill(img, 10, 0, 20, 10, FLESH, rng)  # top + bottom
    fill(img, 0, 10, 40, 10, FLESH, rng)  # four sides
    # veins on flesh
    for _ in range(60):
        x, y = rng.randint(0, 39), rng.randint(0, 19)
        if img.getpixel((x, y))[3]:
            img.putpixel((x, y), jitter(VEIN if rng.random() < 0.6 else FLESH_DARK, rng, 8))
    # front face = (u+d, v+d) = (10, 10)
    paint_eye_face(img, 10, 10, rng)

    # tentacles (uv 40,0, 2x7x2) -> 8x9 region; tips glow purple
    for (u, v, h) in ((40, 0, 7), (40, 12, 9)):
        fill(img, u + 2, v, 4, 2, TENTACLE, rng)          # top/bottom
        for y in range(h):
            t = y / (h - 1)
            col = tuple(int(a + (b - a) * t) for a, b in zip(TENTACLE, TENTACLE_TIP))
            for x in range(8):
                img.putpixel((u + x, v + 2 + y), jitter(col, rng, 8))
        fill(img, u + 4, v, 2, 2, TENTACLE_TIP, rng)       # bottom cap

    # spikes (uv 48,0, 1x3x1) -> 4x4 region
    fill(img, 48, 0, 4, 4, BONE, rng, 8)

    out = RP / "textures" / "entity" / "gazer.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out)
    return img


def make_pack_icon(gazer_tex):
    """128x128 icon: the Gazer's eye, scaled up, on a dark vignette."""
    icon = Image.new("RGBA", (128, 128), (20, 8, 14, 255))
    rng = random.Random(7)
    for y in range(0, 128, 8):
        for x in range(0, 128, 8):
            d = ((x - 60) ** 2 + (y - 60) ** 2) ** 0.5
            shade = max(0, 70 - int(d * 0.8))
            block = Image.new("RGBA", (8, 8), jitter((40 + shade, 10 + shade // 4, 20 + shade // 3), rng, 6))
            icon.paste(block, (x, y))
    eye = gazer_tex.crop((10, 10, 20, 20)).resize((100, 100), Image.NEAREST)
    icon.alpha_composite(eye, (14, 14))
    for p in (RP / "pack_icon.png", BP / "pack_icon.png"):
        icon.save(p)


if __name__ == "__main__":
    tex = make_gazer()
    make_pack_icon(tex)
    print("art generated")
