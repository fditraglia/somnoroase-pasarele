# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow", "numpy"]
# ///
"""Turn the generated source art in art-src/ into game-ready sprites in src/assets/.

The image generator cannot output transparency, so sprites are drawn on flat
magenta (#FF00FF) and keyed here. The key is a soft matte with despill (the
magenta share is subtracted from edge pixels), which avoids the purple fringe
that a hard `-transparent magenta` leaves.

Run:  uv run scripts/process_art.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

SRC = Path("art-src")
OUT = Path("src/assets")


def key_magenta(img: Image.Image, lo: float = 70, hi: float = 190) -> Image.Image:
    """Soft chroma key: alpha from 'magenta-ness' = min(R, B) - G, then despill."""
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = np.minimum(r, b) - g
    alpha = 1.0 - np.clip((m - lo) / (hi - lo), 0.0, 1.0)
    # despill: pixel = alpha * fg + (1 - alpha) * magenta  =>  solve for fg
    safe = np.maximum(alpha, 1e-3)[..., None]
    key = np.array([255.0, 0.0, 255.0], dtype=np.float32)
    fg = (a - (1.0 - alpha)[..., None] * key) / safe
    fg = np.clip(fg, 0, 255)
    out = np.dstack([fg, alpha * 255.0]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def crop_centered(img: Image.Image, cx: int, cy: int, half: int) -> Image.Image:
    """Square crop of side 2*half centered on (cx, cy), padded with transparency."""
    canvas = Image.new("RGBA", (2 * half, 2 * half), (0, 0, 0, 0))
    canvas.paste(img, (half - cx, half - cy))
    return canvas


def trim_box(img: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    """Crop to the alpha bounding box found inside `box`."""
    region = img.crop(box)
    bbox = region.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
    return region.crop(bbox)


def save(img: Image.Image, name: str, size: tuple[int, int] | None = None) -> None:
    if size:
        img = img.resize(size, Image.LANCZOS)
    path = OUT / name
    if name.endswith(".webp"):
        img.save(path, quality=86, method=6)
    else:
        img.save(path, optimize=True)
    print(f"{name:22s} {img.size}  {path.stat().st_size / 1024:.0f} KB")


def birds() -> None:
    sheet = key_magenta(Image.open(SRC / "bird.png"))
    # (name, body-center x, y, body radius) measured on the 1254px sheet. Every
    # pose is cropped around its BODY center and scaled so the body radius is
    # the same in all four, so the physics circle lines up whatever the pose.
    poses = [
        ("bird-sleepy", 322, 338, 152),
        ("bird-fly", 985, 322, 132),
        ("bird-asleep", 320, 952, 166),
        ("bird-grumpy", 958, 962, 142),
    ]
    for name, cx, cy, rad in poses:
        half = round(rad * 2.2)  # texture half-size = 2.2 body radii
        save(crop_centered(sheet, cx, cy, half), f"{name}.png", (256, 256))


def nest() -> None:
    img = key_magenta(Image.open(SRC / "nest.png"))
    box = img.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
    img = img.crop(box)
    w, h = img.size
    save(img, "nest.png", (420, round(420 * h / w)))

    # Front layer: the rim in front of the hollow, drawn over a settled bird so
    # the bird looks inside the bowl. The hollow is the dark oval in the upper
    # half; everything below its center line and outside the oval is "front".
    a = np.asarray(img).copy()
    yy, xx = np.mgrid[0:h, 0:w]
    ex, ey = w * 0.505, h * 0.315      # hollow center
    ea, eb = w * 0.375, h * 0.215      # hollow semi-axes
    inside = ((xx - ex) / ea) ** 2 + ((yy - ey) / eb) ** 2
    # soft edge so the cut does not read as a hard line
    edge = np.clip((inside - 0.90) / 0.14, 0, 1)
    below = np.clip((yy - (ey - h * 0.02)) / (h * 0.04), 0, 1)
    a[..., 3] = (a[..., 3] * edge * below).astype(np.uint8)
    save(Image.fromarray(a, "RGBA"), "nest-front.png", (420, round(420 * h / w)))


def props() -> None:
    sheet = key_magenta(Image.open(SRC / "props.png"))
    save(trim_box(sheet, (0, 0, 627, 700)), "crate.png", (160, 160))
    save(trim_box(sheet, (627, 0, 1254, 700)), "card.png", (240, 240))
    plank = trim_box(sheet, (0, 700, 627, 1254))
    save(plank, "plank.png", (400, round(400 * plank.height / plank.width)))
    lantern = trim_box(sheet, (627, 650, 1254, 1254))
    save(lantern, "lantern.png", (140, round(140 * lantern.height / lantern.width)))


def tree() -> None:
    # A repaint of the original hand-placed tree (art-src/tree-original.png) with
    # the same branch geometry, so the nest and perch points still line up.
    # Toned down a little so the bark sits in the dusk light.
    from PIL import ImageEnhance
    img = key_magenta(Image.open(SRC / "tree.png")).resize((1800, 1009), Image.LANCZOS)
    rgb = ImageEnhance.Color(img.convert("RGB")).enhance(0.82)
    rgb = ImageEnhance.Brightness(rgb).enhance(0.86)
    out = Image.merge("RGBA", (*rgb.split(), img.getchannel("A")))
    save(out, "tree.webp")


def background() -> None:
    img = Image.open(SRC / "bg.png").convert("RGB")
    save(img, "bg.webp")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    birds()
    nest()
    props()
    tree()
    background()
