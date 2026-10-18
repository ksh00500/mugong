"""Small WebP delivery copies, preserving source art, dimensions and exact alpha."""
import json
from pathlib import Path
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'public/art'
FILES = ['forest-v1', 'hero-atlas-v2', 'hero-nw-v1', 'enemy-atlas-v1',
         'portrait-v1', 'ui/effects-v2', 'ui/lobby-v2', 'ui/materials-v2',
         'ui/navigation-v1', 'ui/symbols-v1', 'ui/hud-frame-v1', 'ui/hud-atlas-v3']
report = []
for name in FILES:
    source = ART / (name + '.png')
    target = ART / 'delivery-v1' / (name + '.webp')
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        image.save(target, 'WEBP', quality=90, method=6, exact=True)
        with Image.open(target) as decoded:
            assert decoded.size == image.size
            assert not ImageChops.difference(image.convert('RGBA').getchannel('A'),
                                            decoded.convert('RGBA').getchannel('A')).getbbox()
        original = source.with_suffix('.webp')
        report.append({'file': name, 'previousBytes': original.stat().st_size if original.exists() else source.stat().st_size,
                       'deliveryBytes': target.stat().st_size,
                       'dimensions': image.size, 'alphaIdentical': True, 'quality': 90})
proof = ROOT / 'docs/verification/glance-v2'
proof.mkdir(parents=True, exist_ok=True)
(proof / 'delivery-sizes.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps({'previousBytes':sum(r['previousBytes'] for r in report),
                  'deliveryBytes':sum(r['deliveryBytes'] for r in report)}, indent=2))
