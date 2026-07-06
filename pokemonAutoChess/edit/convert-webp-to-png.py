#!/usr/bin/env python3
"""Convert every .webp in a directory to a .png (preserving transparency).

Usage:
    python3 edit/convert-webp-to-png.py <in_dir> [out_dir] [--delete]

  <in_dir>   directory to scan (non-recursive) for *.webp
  [out_dir]  where to write the .png files (default: same as in_dir)
  --delete   remove each source .webp after a successful conversion

Used to turn relic source art into the .png files the relic HUD/wiki load.
Source webp live in app/public/src/assets/relics/webp/ ; pngs go to
app/public/src/assets/relics/ . After running, copy the pngs into
dist/client/assets/relics/ (or run `npm run assetpack`).
"""
import sys
from pathlib import Path

from PIL import Image


def main() -> int:
    flags = [a for a in sys.argv[1:] if a.startswith("--")]
    pos = [a for a in sys.argv[1:] if not a.startswith("--")]
    delete = "--delete" in flags
    if not pos:
        print(__doc__)
        return 1

    in_dir = Path(pos[0])
    out_dir = Path(pos[1]) if len(pos) > 1 else in_dir
    if not in_dir.is_dir():
        print(f"not a directory: {in_dir}")
        return 1
    out_dir.mkdir(parents=True, exist_ok=True)

    webps = sorted(in_dir.glob("*.webp"))
    if not webps:
        print(f"no .webp files in {in_dir}")
        return 0

    count = 0
    for src in webps:
        dst = out_dir / (src.stem + ".png")
        with Image.open(src) as im:
            im = im.convert("RGBA")
            im.save(dst, "PNG")
        count += 1
        if delete:
            src.unlink()

    print(f"converted {count} webp -> png into {out_dir}" + (" (sources deleted)" if delete else ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
