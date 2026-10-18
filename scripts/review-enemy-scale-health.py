"""Compare actual renderer screenshots; never modify production artwork."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

root = Path('docs/verification/enemy-scale-health-v3')
font = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 15)
for renderer in ['canvas', 'webgl']:
    for region in range(10):
        paths = [root / f'{renderer}-R{region}-{p}.png' for p in ['walk1', 'windup', 'strike']]
        if not all(p.exists() for p in paths):
            continue
        count = json.loads((root / f'{renderer}-R{region}.json').read_text())['enemies']
        # East / south / north, walking / preparing / striking, all enemies.
        board = Image.new('RGB', (1620, count * 220 + 35), '#d9d0b9')
        draw = ImageDraw.Draw(board)
        for phase, path in enumerate(paths):
            source = Image.open(path)
            for column, direction in enumerate([0, 2, 6]):
                x = phase * 540 + column * 180
                draw.text((x + 4, 5), f'{renderer} R{region} {path.stem.split("-")[-1]} D{direction}', fill='#20382d', font=font)
                for row in range(count):
                    box = (direction * 180, row * 220, (direction + 1) * 180, (row + 1) * 220)
                    board.paste(source.crop(box), (x, 35 + row * 220))
        board.save(root / f'{renderer}-R{region}-comparison.png')

records = []
for renderer in ['canvas', 'webgl']:
    for region in range(10):
        path = root / f'{renderer}-R{region}.json'
        if path.exists():
            result = json.loads(path.read_text())
            records.extend(result['records'])
summary = {
    'regions': 10,
    'samples': len(records),
    'minimumHealthGap': min((r['gap'] for r in records if r.get('gap') is not None), default=None),
    'unitMaximumTargetError': max((abs(r['unit'] - r['target']) for r in records), default=None),
    'independentScalpSamples': sum('measuredScalp' in r for r in records),
    'method': 'Scalp source pixels for bald monks; existing authored estimates for other enemies. Screen comparisons reviewed separately.',
}
(root / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary))
