"""Deterministic local cleanup for Batch 2 runtime candidates.

Keeps the largest alpha component of each object (removing disconnected neighbour
fragments) and derives a single-colour transparent outline for NEXT. Source-inputs
are never modified. This is asset preparation, not visual acceptance.
"""
from __future__ import annotations

import json
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "assets/batch1/art"
NAMES = ["television", "bathtub", "piano", "tire", "bowling_ball", "oil_drum",
         "spring_pad", "cat_bed", "giraffe", "ufo", "rocket", "vending_machine"]


def read_png(path: Path) -> tuple[int, int, list[list[list[int]]]]:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"not png: {path}")
    pos = 8
    idat = bytearray()
    width = height = color_type = bit_depth = None
    while pos < len(data):
        size = struct.unpack(">I", data[pos:pos + 4])[0]
        kind = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + size]
        pos += size + 12
        if kind == b"IHDR":
            width, height, bit_depth, color_type, _, _, _ = struct.unpack(">IIBBBBB", chunk)
        elif kind == b"IDAT":
            idat.extend(chunk)
        elif kind == b"IEND":
            break
    if (bit_depth, color_type) != (8, 6):
        raise ValueError(f"expected 8-bit RGBA png: {path} {(bit_depth, color_type)}")
    raw = zlib.decompress(idat)
    stride = width * 4
    rows: list[list[list[int]]] = []
    offset = 0
    previous = [0] * stride
    for _ in range(height):
        filter_type = raw[offset]
        offset += 1
        row = list(raw[offset:offset + stride])
        offset += stride
        for index in range(stride):
            left = row[index - 4] if index >= 4 else 0
            up = previous[index]
            upper_left = previous[index - 4] if index >= 4 else 0
            if filter_type == 1:
                row[index] = (row[index] + left) & 255
            elif filter_type == 2:
                row[index] = (row[index] + up) & 255
            elif filter_type == 3:
                row[index] = (row[index] + ((left + up) // 2)) & 255
            elif filter_type == 4:
                estimate = left + up - upper_left
                pa, pb, pc = abs(estimate - left), abs(estimate - up), abs(estimate - upper_left)
                predictor = left if pa <= pb and pa <= pc else up if pb <= pc else upper_left
                row[index] = (row[index] + predictor) & 255
            elif filter_type != 0:
                raise ValueError(f"unsupported PNG filter {filter_type}")
        rows.append([row[x:x + 4] for x in range(0, stride, 4)])
        previous = row
    return width, height, rows


def write_png(path: Path, width: int, height: int, pixels: list[list[list[int]]]) -> None:
    raw = bytearray()
    for row in pixels:
        raw.append(0)
        for pixel in row:
            raw.extend(bytes(max(0, min(255, value)) for value in pixel))

    def chunk(kind: bytes, payload: bytes) -> bytes:
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload) & 0xffffffff)

    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b""))


def largest_component(width: int, height: int, pixels: list[list[list[int]]]) -> set[tuple[int, int]]:
    visible = {(x, y) for y in range(height) for x in range(width) if pixels[y][x][3] > 10}
    largest: set[tuple[int, int]] = set()
    while visible:
        seed = visible.pop()
        stack = [seed]
        component = {seed}
        while stack:
            x, y = stack.pop()
            for neighbour in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if neighbour in visible:
                    visible.remove(neighbour)
                    stack.append(neighbour)
                    component.add(neighbour)
        if len(component) > len(largest):
            largest = component
    return largest


def clean_object(path: Path) -> tuple[int, int]:
    width, height, pixels = read_png(path)
    component = largest_component(width, height, pixels)
    for y in range(height):
        for x in range(width):
            if (x, y) not in component:
                pixels[y][x][3] = 0
    write_png(path, width, height, pixels)
    return width, height


def outline_from_object(source: Path, target: Path) -> tuple[int, int]:
    width, height, pixels = read_png(source)
    visible = {(x, y) for y in range(height) for x in range(width) if pixels[y][x][3] > 10}
    outline: list[list[list[int]]] = []
    for y in range(height):
        row: list[list[int]] = []
        for x in range(width):
            edge = (x, y) in visible and any((nx, ny) not in visible for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))
            row.append([54, 92, 150, 235 if edge else 0])
        outline.append(row)
    write_png(target, width, height, outline)
    return width, height


def update_meta(path: Path, width: int, height: int) -> None:
    meta = json.loads(path.read_text())
    sprite = meta["subMetas"]["f9941"]["userData"]
    sprite["width"] = sprite["rawWidth"] = width
    sprite["height"] = sprite["rawHeight"] = height
    sprite["vertices"]["rawPosition"] = [-width / 2, -height / 2, 0, width / 2, -height / 2, 0,
                                           -width / 2, height / 2, 0, width / 2, height / 2, 0]
    sprite["vertices"]["minPos"] = [-width / 2, -height / 2, 0]
    sprite["vertices"]["maxPos"] = [width / 2, height / 2, 0]
    sprite["vertices"]["uv"] = [0, height, width, height, 0, 0, width, 0]
    path.write_text(json.dumps(meta, indent=2) + "\n")


def main() -> None:
    cleaned = []
    for name in NAMES:
        object_path = ART / f"object_{name}.png"
        width, height = clean_object(object_path)
        update_meta(object_path.with_suffix(".png.meta"), width, height)
        next_path = ART / f"next_{name}.png"
        outline_from_object(object_path, next_path)
        update_meta(next_path.with_suffix(".png.meta"), width, height)
        cleaned.append({"kind": name, "width": width, "height": height, "next": "alpha-outline"})
    manifest = json.loads((ART / "objects-r2-manifest.json").read_text())
    for row in manifest["objects"]:
        item = next(value for value in cleaned if value["kind"] == row["kind"])
        row["width"], row["height"] = item["width"], item["height"]
        row["processing"] = "largest-alpha-component" if row["type"] == "object" else "single-colour-alpha-outline"
    (ART / "objects-r2-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({"status": "prepared", "objects": len(cleaned), "next": "alpha-outline",
                      "sourceUnchanged": True}, indent=2))


if __name__ == "__main__":
    main()
