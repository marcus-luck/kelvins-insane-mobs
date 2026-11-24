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


# --------------------------------------------------------------------------- Flappy Ghast
PINK = (255, 160, 205)
PINK_DARK = (232, 120, 176)
BLUE = (124, 196, 255)
BLUE_DARK = (84, 150, 230)


def body_face(img, ox, oy, rng, band=True):
    """16x16 body face: pink on top fading into a blue band at the bottom."""
    for y in range(16):
        for x in range(16):
            col = BLUE if (band and y >= 11) else PINK
            if band and y == 10:
                col = BLUE_DARK
            img.putpixel((ox + x, oy + y), jitter(col, rng, 7))


def make_flappy_ghast():
    rng = random.Random(42)
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    for ox in (0, 16, 32, 48):           # east, north(face), west, south
        body_face(img, ox, 16, rng)
    body_face(img, 16, 0, rng, band=False)  # top
    fill(img, 32, 0, 16, 16, BLUE, rng, 7)  # bottom
    # face on north (16,16): two eyes, blush, smile
    f = (16, 16)
    for ex in (4, 10):
        for dy in range(3):
            img.putpixel((f[0] + ex, f[1] + 5 + dy), (25, 20, 40, 255))
            img.putpixel((f[0] + ex + 1, f[1] + 5 + dy), (25, 20, 40, 255))
        img.putpixel((f[0] + ex, f[1] + 5), (255, 255, 255, 255))
    for bx in (2, 3, 12, 13):
        img.putpixel((f[0] + bx, f[1] + 8), jitter(PINK_DARK, rng, 4))
    for x in range(6, 10):
        img.putpixel((f[0] + x, f[1] + 9), (90, 30, 60, 255))
    img.putpixel((f[0] + 5, f[1] + 8), (90, 30, 60, 255))
    img.putpixel((f[0] + 10, f[1] + 8), (90, 30, 60, 255))
    # wings: top (48,0) blue with pink feather tips, underside (0,0) lighter, edge strip (48,32)
    for (ox, base) in ((48, BLUE), (0, (170, 215, 255))):
        for y in range(16):
            for x in range(16):
                col = PINK if x >= 12 else base
                if x < 12 and y % 4 == 0:
                    col = BLUE_DARK
                img.putpixel((ox + x, y), jitter(col, rng, 6))
    fill(img, 48, 32, 16, 2, BLUE_DARK, rng, 5)
    # tentacles: pink set (0,32) and blue set (24,32), each 24x24 box-uv area
    fill(img, 0, 32, 24, 24, PINK, rng, 8)
    fill(img, 24, 32, 24, 24, BLUE, rng, 8)
    img.save(RP / "textures" / "entity" / "flappy_ghast.png")


# --------------------------------------------------------------------------- Enderpig
BLACK = (24, 22, 28)
BLACK_2 = (36, 32, 42)
ENDER_PURPLE = (204, 92, 255)


def make_enderpig():
    rng = random.Random(99)
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    fill(img, 0, 0, 32, 16, BLACK, rng, 6)      # head 8x8x8
    fill(img, 32, 0, 10, 4, BLACK_2, rng, 6)    # snout 4x3x1
    fill(img, 0, 16, 52, 24, BLACK, rng, 6)     # body 10x8x16
    fill(img, 52, 16, 8, 30, BLACK, rng, 6)     # legs 2x28x2
    # snout front (33,1) 4x3: nostrils
    img.putpixel((33 + 1, 2), (8, 6, 10, 255))
    img.putpixel((33 + 2, 2), (8, 6, 10, 255))
    # eyes on head front (8,8): enderman-style glowing purple strips
    for x in (8 + 1, 8 + 2, 8 + 5, 8 + 6):
        img.putpixel((x, 8 + 3), ENDER_PURPLE + (255,))
    img.putpixel((8 + 1, 8 + 3), (240, 180, 255, 255))
    img.putpixel((8 + 6, 8 + 3), (240, 180, 255, 255))
    # a few purple speckles on the body
    for _ in range(14):
        img.putpixel((rng.randint(0, 51), rng.randint(16, 39)), jitter((90, 40, 120), rng, 10))
    img.save(RP / "textures" / "entity" / "enderpig.png")


# --------------------------------------------------------------------------- Poop block + puddle
POOP = (100, 62, 30)
POOP_DARK = (70, 42, 20)
POOP_LIGHT = (128, 84, 44)


def make_poop():
    rng = random.Random(5)
    out_dir = RP / "textures" / "blocks"
    out_dir.mkdir(parents=True, exist_ok=True)

    block = Image.new("RGBA", (16, 16))
    for y in range(16):
        for x in range(16):
            col = POOP_DARK if (y + (x // 4)) % 5 == 0 else POOP  # lumpy diagonal coils
            block.putpixel((x, y), jitter(col, rng, 10))
    for _ in range(10):
        block.putpixel((rng.randint(0, 15), rng.randint(0, 15)), jitter(POOP_LIGHT, rng, 6))
    block.save(out_dir / "poop.png")

    puddle = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y in range(16):
        for x in range(16):
            d = ((x - 7.5) ** 2 + (y - 7.5) ** 2 * 1.3) ** 0.5
            wobble = 1.2 * ((x * 7 + y * 13) % 3 - 1)
            if d + wobble < 7.2:
                col = POOP_DARK if d > 5.5 else POOP
                puddle.putpixel((x, y), jitter(col, rng, 8))
    for _ in range(5):
        puddle.putpixel((rng.randint(5, 10), rng.randint(5, 10)), jitter(POOP_LIGHT, rng, 6))
    puddle.save(out_dir / "poop_puddle.png")


# --------------------------------------------------------------------------- Ghast Blaster item
def make_blaster():
    rng = random.Random(11)
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    # diagonal wand from bottom-left to top-right: blue handle, pink body, glowing fire tip
    for i in range(12):
        x, y = 2 + i, 13 - i
        col = BLUE_DARK if i < 4 else (PINK if i % 2 else PINK_DARK)
        img.putpixel((x, y), jitter(col, rng, 6))
        img.putpixel((x + 1, y), jitter(BLUE if i < 4 else PINK_DARK, rng, 6))
    for dx, dy, col in [(0, 0, (255, 240, 120)), (1, 0, (255, 170, 40)), (-1, 0, (255, 120, 20)),
                        (0, 1, (255, 170, 40)), (0, -1, (255, 120, 20)), (1, 1, (255, 200, 60))]:
        img.putpixel((13 + dx, 2 + dy), col + (255,))
    out = RP / "textures" / "items"
    out.mkdir(parents=True, exist_ok=True)
    img.save(out / "ghast_blaster.png")


if __name__ == "__main__":
    make_poop()
    make_flappy_ghast()
    make_enderpig()
    make_blaster()
    tex = make_gazer()
    make_pack_icon(tex)
    print("art generated")
