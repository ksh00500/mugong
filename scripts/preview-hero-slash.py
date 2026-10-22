"""Make a review GIF from actual Phaser screenshots; never modify game artwork."""
from pathlib import Path
import json
import sys
from PIL import Image, ImageDraw, ImageFont

root = Path(sys.argv[1] if len(sys.argv) > 1 else 'docs/verification/hero-slash-v3')
direction = int(sys.argv[2]) if len(sys.argv) > 2 else 0
suffix = '' if direction == 0 else f'-D{direction}'
times = json.loads((root / f'preview-0{suffix}/times.json').read_text())
stroke_start, stroke_end = (.055, .125) if root.name == 'hero-slash-v1' else (.04, .14)
font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 23)
frames = []
for i, elapsed in enumerate(times):
    image = Image.new('RGB', (1280, 515), '#d9cfba')
    phase = '준비' if elapsed < stroke_start else '베기' if elapsed < stroke_end else '회수' if elapsed < .28 else '대기'
    name = ['오른쪽', '오른쪽 아래', '아래쪽', '왼쪽 아래', '왼쪽', '왼쪽 위', '위쪽', '오른쪽 위'][direction]
    ImageDraw.Draw(image).text((30, 8), f'플레이어 10종 · {name} · {phase} · 실제 렌더 프레임', font=font, fill='#132b20')
    for batch in (0, 1):
        source = Image.open(root / f'preview-{batch}{suffix}/{i:02}.png').convert('RGB')
        image.paste(source.crop((0, 345, 1280, 575)), (0, 50 + batch * 230))
    frames.append(image)
durations = [max(10, round((b-a)*100)*10) for a,b in zip(times, times[1:])] + [400]
frames[0].save(root / f'player-cut-preview{suffix}.gif', save_all=True, append_images=frames[1:],
               duration=durations, loop=0, optimize=False, disposal=2)
frames[6].save(root / f'player-cut-contact{suffix}.png')
