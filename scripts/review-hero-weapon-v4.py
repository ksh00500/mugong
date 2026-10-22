"""Assemble actual renderer screenshots, without editing production artwork."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root=Path('docs/verification/hero-weapon-v4')
styles=['sword','dao','staff','fan','dart','gauntlet']
font=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',15)
for renderer in ['canvas','webgl']:
    if not (root/renderer/'9-gauntlet.png').exists(): continue
    for direction in [0,2,6]:
        # All ten identities, six styles and load/contact/follow poses together.
        image=Image.new('RGB',(2880,1250),'#ece2ce')
        draw=ImageDraw.Draw(image)
        for style_index,style in enumerate(styles):
            draw.text((style_index*480+5,5),f'{renderer}: {style} / D{direction} / ready-hit-follow',font=font,fill='#132b20')
            for appearance in range(10):
                source=Image.open(root/renderer/f'{appearance}-{style}.png').convert('RGB')
                for col,key in enumerate([1,3,5]):
                    image.paste(source.crop((key*160,direction*120+50,(key+1)*160,direction*120+170)),(style_index*480+col*160,50+appearance*120))
                draw.text((style_index*480+5,55+appearance*120),str(appearance),font=font,fill='#132b20')
        image.save(root/f'{renderer}-all-styles-D{direction}.png')
    # Animated strip of all six weapons, ten identities, east-facing attack.
    frames=[]
    for key in range(8):
        image=Image.new('RGB',(960,1250),'#ece2ce')
        draw=ImageDraw.Draw(image)
        for si,style in enumerate(styles):
            draw.text((si*160+5,5),style,font=font,fill='#132b20')
            for a in range(10):
                source=Image.open(root/renderer/f'{a}-{style}.png').convert('RGB')
                image.paste(source.crop((key*160,50,(key+1)*160,170)),(si*160,50+a*120))
        frames.append(image)
    frames[0].save(root/f'{renderer}-all-styles.gif',save_all=True,append_images=frames[1:],duration=[25,30,30,25,50,50,45,350],loop=0,disposal=2,optimize=False)
