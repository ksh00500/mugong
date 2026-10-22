"""Create pixel-identical WebP delivery copies; preserve the source PNGs."""
import json
from pathlib import Path
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    "forest-v1.png", "hero-atlas-v2.png", "hero-nw-v1.png",
    "enemy-atlas-v1.png", "portrait-v1.png", "ui/effects-v1.png",
    "ui/lobby-v2.png", "ui/materials-v1.png", "ui/navigation-v1.png",
    "ui/symbols-v1.png", "ui/effects-v2.png", "ui/materials-v2.png",
]
report = []
for name in FILES:
    source = ROOT / "public/art" / name
    target = source.with_suffix(".webp")
    with Image.open(source) as image:
        image.save(target, "WEBP", lossless=True, method=6, exact=True)
        with Image.open(target) as result:
            difference = ImageChops.difference(image.convert("RGBA"), result.convert("RGBA"))
            if any(channel.getbbox() for channel in difference.split()):
                raise RuntimeError(f"Pixels differ: {name}")
        report.append({
            "source": f"/art/{name}",
            "delivery": f"/art/{target.relative_to(ROOT / 'public/art').as_posix()}",
            "width": image.width, "height": image.height,
            "sourceBytes": source.stat().st_size, "deliveryBytes": target.stat().st_size,
            "pixelsIdentical": True,
        })
    print(f"{name}: {source.stat().st_size} -> {target.stat().st_size}", flush=True)
proof = ROOT / "docs/verification/text-loading-v3"
proof.mkdir(parents=True, exist_ok=True)
(proof / "asset-sizes.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
