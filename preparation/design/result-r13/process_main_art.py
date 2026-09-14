"""Local cleanup of generated R13 pixels only; never extracts production pixels from R12."""
from pathlib import Path
import json, hashlib
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT=Path(__file__).resolve().parent
GEN=Path('/Users/admin/.codex/generated_images/01a09348-61a0-72f3-a68f-2428fcc2dafc')
ASSET=ROOT/'assets'
EVIDENCE=ROOT/'evidence'

def outside(mask):
    """Flood border-connected zeros without deleting white interior details."""
    pad=Image.new('L',(mask.width+2,mask.height+2),0)
    pad.paste(mask,(1,1))
    ImageDraw.floodfill(pad,(0,0),128)
    return np.asarray(pad.crop((1,1,mask.width+1,mask.height+1)))==128

def neutral_alpha(im):
    arr=np.asarray(im.convert('RGB')).astype(np.int16)
    neutral=(arr.max(2)-arr.min(2)<23)&(arr.max(2)<238)
    mask=Image.fromarray(np.where(neutral,0,255).astype('uint8')).copy()
    alpha=Image.fromarray(np.where(outside(mask),0,255).astype('uint8'))
    out=im.convert('RGBA');out.putalpha(alpha)
    return out

def color_silhouette(im,kind):
    a=np.asarray(im.convert('RGB')).astype(np.int16)
    r,g,b=a[:,:,0],a[:,:,1],a[:,:,2]
    if kind=='yellow': foreground=(r>180)&(g>100)&(b<180)
    else: foreground=(b-r>45)&(b>125)&(g<b-5)
    mask=Image.fromarray((foreground*255).astype('uint8')).copy()
    # Keep only the body containing the lower centre; discard nearby confetti.
    candidates=np.argwhere(foreground[int(im.height*.72)])
    seed_x=int(candidates[np.abs(candidates[:,0]-im.width/2).argmin(),0])
    ImageDraw.floodfill(mask,(seed_x,int(im.height*.72)),128)
    mask=Image.fromarray(np.where(np.asarray(mask)==128,255,0).astype('uint8')).copy()
    hull=Image.fromarray(np.where(outside(mask),0,255).astype('uint8')).filter(ImageFilter.MaxFilter(3))
    out=im.convert('RGBA');out.putalpha(hull)
    box=hull.getbbox();return out.crop(box),box

def contact_sheet(im,name):
    for label,color in [('navy','#152b47'),('cream','#fff1d1')]:
        canvas=Image.new('RGBA',im.size,color);canvas.alpha_composite(im)
        canvas.convert('RGB').save(EVIDENCE/f'{name}-{label}.png')

def main():
    raw=Image.open(GEN/'exec-b9ee8c6c-f5cb-4195-af55-278791b85368.png')
    full_source=GEN/'exec-b88adc14-7900-4393-bee6-0be19dc51059.png'
    full=neutral_alpha(Image.open(full_source))
    full.save(ROOT/'full-card-r13.png')
    contact_sheet(full,'full-card')
    # Bounds are in our generated image, not the historical original UI.
    components={}
    for name,bounds,kind in [('result_retry',(108,1034,1040,1280),'yellow'),('result_close',(1017,9,1181,161),'blue')]:
        im,local=color_silhouette(raw.crop(bounds),kind)
        if name=='result_retry':
            # A hanging yellow confetti fragment touches the button at its very top.
            # Restrict alpha to the visible button capsule; retain generated RGB pixels.
            alpha=Image.new('L',im.size,0)
            ImageDraw.Draw(alpha).rounded_rectangle((0,6,im.width-1,im.height-2),radius=(im.height-8)//2,fill=255)
            im.putalpha(Image.fromarray(np.minimum(np.asarray(im.getchannel('A')),np.asarray(alpha))))
        if name=='result_close':
            # The full-card background joins the blue button. Trace this generated
            # button silhouette, excluding the blue panel behind its lower left.
            tile=raw.crop((1029,23,1170,153)).convert('RGBA')
            alpha=Image.new('L',tile.size,0)
            ImageDraw.Draw(alpha).rounded_rectangle((0,0,140,129),radius=42,fill=255)
            tile.putalpha(alpha.filter(ImageFilter.GaussianBlur(.4)))
            im=tile;local=(1029,23,1170,153)
        im.save(ASSET/f'{name}.png');contact_sheet(im,name)
        components[name]={'generated_crop':bounds,'trim':local,'size':im.size,'alpha':'colored silhouette with enclosed content, 1px dilation'}
    (ROOT/'LOCAL_PROCESSING.json').write_text(json.dumps({'component_source':str(GEN/'exec-b9ee8c6c-f5cb-4195-af55-278791b85368.png'),'component_source_sha256':hashlib.sha256((GEN/'exec-b9ee8c6c-f5cb-4195-af55-278791b85368.png').read_bytes()).hexdigest(),'full_source':str(full_source),'full_alpha':'remove only border-connected neutral grey checker pixels: channel spread <23, max <238','metrics_alpha':'connected white body, fill enclosed text holes, soften .7px; no background speckles retained','components':components},ensure_ascii=False,indent=2)+'\n')
    metrics=Image.open(GEN/'exec-77548215-3674-4115-99f1-0e6a0bae9653.png').convert('RGBA')
    light=np.asarray(metrics)[:,:,:3].min(2)>222
    lightmask=Image.fromarray((light*255).astype('uint8')).copy()
    ImageDraw.floodfill(lightmask,(500,500),128)
    lightmask=Image.fromarray(np.where(np.asarray(lightmask)==128,255,0).astype('uint8')).copy()
    solid=Image.fromarray(np.where(outside(lightmask),0,255).astype('uint8'))
    metrics.putalpha(solid.filter(ImageFilter.GaussianBlur(.7)))
    metrics=metrics.crop(metrics.getbbox());metrics.save(ASSET/'result_metrics.png')
    contact_sheet(metrics,'result_metrics')
    glyphs=Image.open(GEN/'exec-ef5d5c99-e422-4cf7-9865-65486c5be0ef.png').convert('RGB')
    a=np.asarray(glyphs).astype(np.int16)
    colored=(a.max(2)-a.min(2)>45)
    mask=Image.fromarray((colored*255).astype('uint8')).copy()
    parts=[]
    while True:
        available=np.argwhere(np.asarray(mask)==255)
        if not len(available): break
        y,x=map(int,available[0]);ImageDraw.floodfill(mask,(x,y),128)
        component=np.asarray(mask)==128
        ys,xs=np.where(component)
        if len(xs)>1000: parts.append((int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1),component.copy()))
        arr=np.asarray(mask).copy();arr[component]=0;mask=Image.fromarray(arr).copy()
    parts.sort(key=lambda p:(p[1]>380,p[0]))
    assert len(parts)==12, len(parts)
    atlas=Image.new('RGBA',glyphs.size)
    manifest={}
    for char,part in zip('0123456789.m',parts):
        x0,y0,x1,y1,component=part
        core=Image.fromarray((component*255).astype('uint8')).copy()
        core=Image.fromarray(np.where(outside(core),0,255).astype('uint8'))
        core=core.filter(ImageFilter.MinFilter(11)).filter(ImageFilter.MaxFilter(11)).filter(ImageFilter.GaussianBlur(2))
        core=core.point(lambda x:255 if x>127 else 0)
        stroke=core.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(.5))
        tile=Image.new('RGBA',glyphs.size,'white');tile.paste(glyphs,(0,0),core);tile.putalpha(stroke)
        bbox=stroke.getbbox();tile=tile.crop(bbox)
        name='dot' if char=='.' else char
        tile.save(ASSET/f'height_{name}.png');atlas.alpha_composite(tile,bbox[:2])
        manifest[char]={'file':f'assets/height_{name}.png','atlas_bounds':bbox,'native_size':tile.size}
    atlas.save(ASSET/'height_glyph_atlas.png');contact_sheet(atlas,'height_glyph_atlas')
    (ROOT/'HEIGHT_GLYPHS.json').write_text(json.dumps({'status':'visual_candidate_not_integrated','source':str(GEN/'exec-ef5d5c99-e422-4cf7-9865-65486c5be0ef.png'),'processing':'Separate connected colored glyph silhouettes; preserve enclosed faces; 11px morphological opening removes colored checker fringe; 2px smoothing; rebuild 4px white outer rim; RGBA output. No original UI pixels used.','glyphs':manifest},indent=2)+'\n')

if __name__=='__main__': main()
