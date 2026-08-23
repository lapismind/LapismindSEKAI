# -*- coding: utf-8 -*-
from PIL import Image, ImageDraw
import os, math
d = r'D:/cloudflareGame/blog/public/cursors'
files = sorted([f for f in os.listdir(d) if f.startswith('preview-') and f.endswith('.png')])
cols = 4
cell_w, cell_h = 72, 92
rows = math.ceil(len(files)/cols)
sheet = Image.new('RGB', (cols*cell_w, rows*cell_h), 'white')
draw = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(os.path.join(d, f)).convert('RGBA')
    x = (i % cols)*cell_w + 12
    y = (i // cols)*cell_h + 6
    sheet.paste(im, (x, y), im)
    label = f.replace('preview-', '').replace('.png', '')
    draw.text((x - 6, y + 52), label, fill='black')
sheet.save(os.path.join(d, 'preview-sheet.png'))
print('saved', len(files), 'previews')
