"""Read-only PNG inspection. Does not modify generated images."""
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
for path in sorted((root / 'assets' / 'hero').glob('*.png')):
    im = Image.open(path).convert('RGBA')
    alpha = im.getchannel('A')
    hist = alpha.histogram()
    red = sum(1 for r,g,b,a in im.getdata() if r > 220 and g < 70 and b < 70 and a > 100)
    print(json.dumps({'file':path.name,'size':im.size,'alpha_range':alpha.getextrema(),'transparent_pixels':hist[0],'opaque_pixels':hist[255],'visible_bright_red_pixels':red}))
