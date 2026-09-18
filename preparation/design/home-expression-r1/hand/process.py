"""Derive compact RGBA toy-arm poses and inspect on the unchanged hero."""
from pathlib import Path
from PIL import Image, ImageFilter, ImageDraw
import numpy as np
import json, uuid, hashlib, shutil
ROOT=Path(__file__).resolve().parents[4]
OUT=Path(__file__).resolve().parent
RAW=Path('/Users/admin/.codex/generated_images/01a0a324-4ccc-7162-ab9c-7ddc3e82a79e')
FILES={'open':'exec-47b29605-d09b-4c93-87d6-8f016987047e.png', 'grip':'exec-a9ae4415-e332-48a0-90da-177f17f9ec31.png'}
CROP=(145,165,1115,1085)
SCALE=.30
SHOULDER=(978,298)
HERO_SHOULDER=(424,801)
hero=Image.open(ROOT/'assets/batch0/art/home_r9_hero.png').convert('RGBA')
meta_template=json.loads((ROOT/'assets/batch0/art/home_r9_slipper.png.meta').read_text())
result={}
for pose,file in FILES.items():
    raw=OUT/f'generated_{pose}.png'
    if not raw.exists(): shutil.copy2(RAW/file,raw)
    source=Image.open(raw).convert('RGB'); rgb=np.array(source).astype(float)
    if pose=='open':
        matte=(rgb[:,:,0]-rgb[:,:,2]>5)&(rgb[:,:,0]>150)&(rgb[:,:,1]>145)
    else:
        matte=(rgb[:,:,0]>rgb[:,:,1]*.78)&(rgb[:,:,2]>rgb[:,:,1]*.68)&(rgb[:,:,0]>100)
    mask=Image.fromarray(matte.astype('uint8')*255).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    fill=mask.copy(); ImageDraw.floodfill(fill,(0,0),128)
    filled=np.array(fill); filled[filled==0]=255;filled[filled==128]=0
    # Remove 1px edge matte, then antialias at final display resolution.
    mask=Image.fromarray(filled).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(.55))
    rgba=Image.merge('RGBA',(*source.split(),mask)).crop(CROP)
    size=(round((CROP[2]-CROP[0])*SCALE),round((CROP[3]-CROP[1])*SCALE))
    rgba=rgba.resize(size,Image.Resampling.LANCZOS)
    # Remove any green channel spill at semi-transparent edges of the grip matte.
    pixels=np.array(rgba)
    edge=pixels[:,:,3]<245
    pixels[:,:,1][edge]=np.minimum(pixels[:,:,1][edge],pixels[:,:,0][edge])
    rgba=Image.fromarray(pixels)
    name=f'home_arm_{pose}_r1'
    path=ROOT/'assets/batch0/art'/f'{name}.png';rgba.save(path)
    ident=str(uuid.uuid5(uuid.NAMESPACE_URL,f'zheyenengdie/home-expression-r1/{name}'))
    meta=json.loads(json.dumps(meta_template).replace(meta_template['uuid'],ident).replace('home_r9_slipper',name))
    s=meta['subMetas']['f9941']['userData'];w,h=rgba.size
    s.update(width=w,height=h,rawWidth=w,rawHeight=h)
    s['vertices'].update(rawPosition=[-w/2,-h/2,0,w/2,-h/2,0,-w/2,h/2,0,w/2,h/2,0],uv=[0,h,w,h,0,0,w,0],minPos=[-w/2,-h/2,0],maxPos=[w/2,h/2,0])
    Path(str(path)+'.meta').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
    local=((SHOULDER[0]-CROP[0])*SCALE,(SHOULDER[1]-CROP[1])*SCALE)
    xy=(round(HERO_SHOULDER[0]-local[0]),round(HERO_SHOULDER[1]-local[1]))
    comp=hero.copy();comp.alpha_composite(rgba,xy);comp.save(OUT/f'hero_{pose}_composite.png')
    result[pose]={'asset':str(path.relative_to(ROOT)),'uuid':ident,'size':list(size),'shoulderLocalTopLeftPx':list(local),'heroTopLeftPx':list(xy),'heroShoulderPx':list(HERO_SHOULDER),'sourceImage':raw.name,'sourceSha256':hashlib.sha256(raw.read_bytes()).hexdigest(),'assetSha256':hashlib.sha256(path.read_bytes()).hexdigest()}
result['coordinateSystem']='All coordinates use source image pixels with top-left origin, +x right, +y down. Original hero is 1024x1536.'
result['sharedSourceCropPx']=CROP
result['sourceScale']=SCALE
result['shoulderSourcePx']=SHOULDER
result['sourceHeroSha256']=hashlib.sha256((ROOT/'assets/batch0/art/home_r9_hero.png').read_bytes()).hexdigest()
(OUT/'manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False,indent=2))
