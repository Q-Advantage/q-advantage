"""Generate Coldproof favicon raster assets from the canonical icon geometry."""

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
APP = ROOT / "app"
MASTER_SIZE = 2048
SCALE = MASTER_SIZE / 512


def scaled(value: float) -> int:
    return round(value * SCALE)


def cubic(start, control_a, control_b, end, steps=40):
    points = []
    for index in range(steps + 1):
        t = index / steps
        inverse = 1 - t
        x = (
            inverse**3 * start[0]
            + 3 * inverse**2 * t * control_a[0]
            + 3 * inverse * t**2 * control_b[0]
            + t**3 * end[0]
        )
        y = (
            inverse**3 * start[1]
            + 3 * inverse**2 * t * control_a[1]
            + 3 * inverse * t**2 * control_b[1]
            + t**3 * end[1]
        )
        points.append((scaled(x), scaled(y)))
    return points


def build_master() -> Image.Image:
    image = Image.new("RGBA", (MASTER_SIZE, MASTER_SIZE), (0, 0, 0, 0))

    gradient = Image.new("RGBA", image.size)
    pixels = gradient.load()
    start = (38, 63, 103)
    end = (31, 53, 87)
    for y in range(MASTER_SIZE):
        for x in range(MASTER_SIZE):
            mix = (x + y) / (2 * (MASTER_SIZE - 1))
            color = tuple(round(a + (b - a) * mix) for a, b in zip(start, end))
            pixels[x, y] = (*color, 255)

    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (scaled(16), scaled(16), scaled(496), scaled(496)),
        radius=scaled(104),
        fill=255,
    )
    image.alpha_composite(Image.composite(gradient, Image.new("RGBA", image.size), mask))

    draw = ImageDraw.Draw(image)
    width = scaled(76)
    white = (255, 255, 255, 255)
    segments = [
        ((371, 183), (340, 183), (323, 158), (258, 158)),
        ((258, 158), (187, 158), (143, 198), (143, 260)),
        ((143, 260), (143, 322), (187, 362), (258, 362)),
        ((258, 362), (323, 362), (340, 337), (371, 337)),
    ]
    points = []
    for index, segment in enumerate(segments):
        curve = cubic(*segment)
        points.extend(curve if index == 0 else curve[1:])
    draw.line(points, fill=white, width=width, joint="curve")

    draw.rounded_rectangle(
        (scaled(333), scaled(145), scaled(409), scaled(221)),
        radius=scaled(13),
        fill=white,
    )
    draw.rounded_rectangle(
        (scaled(333), scaled(299), scaled(409), scaled(375)),
        radius=scaled(13),
        fill=white,
    )

    return image


def resize(master: Image.Image, size: int) -> Image.Image:
    return master.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    master = build_master()
    exports = {
        "favicon-16x16.png": 16,
        "favicon-32x32.png": 32,
        "favicon-48x48.png": 48,
        "apple-touch-icon.png": 180,
        "android-chrome-192x192.png": 192,
        "android-chrome-512x512.png": 512,
    }
    for filename, size in exports.items():
        resize(master, size).save(PUBLIC / filename, optimize=True)

    resize(master, 256).save(
        APP / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )


if __name__ == "__main__":
    main()
