"""Render public-app/icon-{192,512}.png (same design as icon.svg). Stdlib only."""
import struct
import zlib
from pathlib import Path

BG, ACCENT, TILE, LIVE = (10, 13, 18), (90, 169, 255), (31, 38, 48), (229, 72, 77)
OUT = Path(__file__).resolve().parent.parent / "public-app"


def in_rrect(x, y, x0, y0, w, h, r):
    if not (x0 <= x < x0 + w and y0 <= y < y0 + h):
        return False
    cx = min(max(x, x0 + r), x0 + w - r)
    cy = min(max(y, y0 + r), y0 + h - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def color_at(x, y):
    # Coordinates in the 512 design space.
    if not in_rrect(x, y, 0, 0, 512, 512, 112):
        return None
    if (x - 415) ** 2 + (y - 97) ** 2 <= 14**2:
        return LIVE
    if (x - 157) ** 2 + (y - 157) ** 2 <= 16**2:
        return ACCENT
    if (x - 157) ** 2 + (y - 157) ** 2 <= 36**2:
        return BG
    if in_rrect(x, y, 72, 72, 170, 170, 28):
        return ACCENT
    for x0, y0 in ((270, 72), (72, 270), (270, 270)):
        if in_rrect(x, y, x0, y0, 170, 170, 28):
            return TILE
    return BG


def png(size):
    s = 512 / size
    rows = []
    for py in range(size):
        row = bytearray([0])
        for px in range(size):
            c = color_at((px + 0.5) * s, (py + 0.5) * s)
            row += bytes((*c, 255)) if c else bytes((0, 0, 0, 0))
        rows.append(bytes(row))

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", zlib.compress(b"".join(rows), 9)) + chunk(b"IEND", b""))


for size in (192, 512):
    (OUT / f"icon-{size}.png").write_bytes(png(size))
    print(f"wrote icon-{size}.png")
