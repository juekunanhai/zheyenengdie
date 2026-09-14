"""Local, repeatable extraction from 02_ASSETS; never changes the source pack.

Recipes are reviewed pixel regions, not inferred physics dimensions. Outputs remain
candidates until visual review. Missing source pixels are never silently invented.
"""
from pathlib import Path
from collections import deque
import hashlib
import json
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('/Users/admin/Downloads/zheyenengdie/art-source/这也能叠_正式美术素材包_v1')

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def clean(im, opening=3):
    alpha = im.getchannel('A')
    # Opening separates speckled cutout residue from the body. Restore the
    # original edge alpha only within the selected component's one-pixel rim.
    solid = alpha.point(lambda a: 255 if a >= 180 else 0)
    solid = solid.filter(ImageFilter.MinFilter(opening)).filter(ImageFilter.MaxFilter(opening))
    mask = np.asarray(solid).copy() > 0
    best = []
    h, w = mask.shape
    for y, x in zip(*np.where(mask)):
        if not mask[y, x]:
            continue
        q, group = deque([(y, x)]), []
        mask[y, x] = False
        while q:
            cy, cx = q.popleft()
            group.append((cy, cx))
            for ny, nx in ((cy-1,cx),(cy+1,cx),(cy,cx-1),(cy,cx+1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx]:
                    mask[ny, nx] = False
                    q.append((ny, nx))
        if len(group) > len(best):
            best = group
    selected = np.zeros((h, w), np.uint8)
    for y, x in best:
        selected[y, x] = 255
    rim = np.asarray(Image.fromarray(selected).filter(ImageFilter.MaxFilter(3))) > 0
    result = im.copy()
    result.putalpha(Image.fromarray(np.where(rim, np.asarray(alpha), 0).astype('uint8')))
    return result

def main():
    recipes = json.loads((ROOT/'art/recipes.json').read_text())
    rows = []
    for r in recipes:
        src = SOURCE/'02_ASSETS'/r['source']
        im = Image.open(src).convert('RGBA')
        roi = r.get('roi', [0, 0, *im.size])
        cut = im.crop(roi)
        for region in r.get('clear_regions', []):
            ImageDraw.Draw(cut).rectangle(region, fill=(0,0,0,0))
        if r.get('clean', True):
            cut = clean(cut, r.get('opening', 3))
        if r.get('remove_next_demo'):
            a = np.array(cut)
            # Detect only the grey dashed demo inside the intact blue panel.
            # Diffuse nearby source colour into that narrow mask, leaving the
            # panel gradient and bevel unchanged rather than filling a rectangle.
            roi_mask = np.zeros(a.shape[:2], bool)
            roi_mask[158:334, 38:207] = True
            demo = (a[:,:,0] > 60) & (a[:,:,0] > a[:,:,2]*.45) & roi_mask
            demo = np.asarray(Image.fromarray((demo*255).astype('uint8')).filter(ImageFilter.MaxFilter(5))) > 0
            rgb = a[:,:,:3].astype(float)
            rgb[demo] = np.median(rgb[roi_mask & ~demo],axis=0)
            for _ in range(160):
                mean = (np.roll(rgb,1,0)+np.roll(rgb,-1,0)+np.roll(rgb,1,1)+np.roll(rgb,-1,1))/4
                rgb[demo] = mean[demo]
            a[:,:,:3] = np.clip(rgb,0,255).astype('uint8')
            cut = Image.fromarray(a)
        box = cut.getbbox()
        if box is None:
            raise ValueError(r['id'])
        cut = cut.crop(box)
        padded = Image.new('RGBA', (cut.width+8, cut.height+8))
        padded.alpha_composite(cut, (4, 4))
        dst = ROOT/'art/candidates'/r['group']/(r['id']+'.png')
        dst.parent.mkdir(parents=True, exist_ok=True)
        padded.save(dst)
        row = dict(r, source_sha256=sha(src), output=str(dst.relative_to(ROOT)),
                   output_sha256=sha(dst), source_size=list(im.size),
                   source_roi=roi, trim_in_roi=list(box), output_size=list(padded.size),
                   status='candidate', visual_review='pending', runtime_review='not_run')
        if r['group'] == 'objects':
            silhouette = Image.new('RGBA', padded.size, (220,232,250,0))
            silhouette.putalpha(padded.getchannel('A'))
            nxt = ROOT/'art/candidates/next'/('next_'+r['id'].removeprefix('object_')+'.png')
            nxt.parent.mkdir(parents=True, exist_ok=True)
            silhouette.save(nxt)
            row['next_output'] = str(nxt.relative_to(ROOT))
            row['next_sha256'] = sha(nxt)
        rows.append(row)
    (ROOT/'art/CANDIDATE_MANIFEST.json').write_text(json.dumps({
        'revision':'2026-09-12-P1','source_root':str(SOURCE),
        'authority':'User-approved local repair candidates; does not replace source approval',
        'recipe_sha256':sha(ROOT/'art/recipes.json'), 'script_sha256':sha(Path(__file__)),
        'entries':rows}, ensure_ascii=False, indent=2)+'\n')
    for start in range(0,len(rows),12):
        part = rows[start:start+12]
        sheet = Image.new('RGB',(1200,300*((len(part)+3)//4)), '#c9ddeb')
        draw = ImageDraw.Draw(sheet)
        for i,r in enumerate(part):
            im = Image.open(ROOT/r['output'])
            im.thumbnail((276,250))
            x,y=(i%4)*300,(i//4)*300
            sheet.paste(im,(x+(300-im.width)//2,y+6),im)
            draw.text((x+8,y+260),r['id'],fill='#17374c')
            draw.text((x+8,y+278),r['quality'],fill='#94361e' if r['quality']=='source_incomplete' else '#17374c')
        sheet.save(ROOT/f'review/candidates-{start//12+1}.jpg',quality=94)
    print(json.dumps({'candidates':len(rows), 'next':sum('next_output' in r for r in rows)}))

if __name__ == '__main__':
    main()
