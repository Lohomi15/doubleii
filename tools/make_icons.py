#!/usr/bin/env python3
"""Generate simple placeholder icons for doubleii (indigo square + two white 'eyes').

Pure stdlib, no Pillow needed. Replace these with real artwork later.
Run: python3 tools/make_icons.py
"""
import os
import struct
import zlib

BG = (79, 70, 229)      # indigo-600
EYE = (255, 255, 255)    # white
SIZES = (16, 48, 128)
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "icons")


def _chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def make_png(size: int) -> bytes:
    cx1, cx2, cy = 0.36 * size, 0.64 * size, 0.5 * size
    r = max(1.0, 0.13 * size)
    rows = bytearray()
    for y in range(size):
        rows.append(0)  # filter type 0 (none)
        for x in range(size):
            in_eye = (
                (x + 0.5 - cx1) ** 2 + (y + 0.5 - cy) ** 2 <= r * r
                or (x + 0.5 - cx2) ** 2 + (y + 0.5 - cy) ** 2 <= r * r
            )
            rows.extend(EYE if in_eye else BG)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)  # 8-bit RGB
    return (
        b"\x89PNG\r\n\x1a\n"
        + _chunk(b"IHDR", ihdr)
        + _chunk(b"IDAT", zlib.compress(bytes(rows), 9))
        + _chunk(b"IEND", b"")
    )


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    for s in SIZES:
        path = os.path.join(OUT_DIR, f"icon-{s}.png")
        with open(path, "wb") as fh:
            fh.write(make_png(s))
        print(f"wrote {os.path.relpath(path)}")


if __name__ == "__main__":
    main()
