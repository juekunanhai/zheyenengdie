"""Extract registered generated eye material patches; never replace approved sprite geometry."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import json, uuid, hashlib, shutil
ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[3]
ART=PROJECT/'assets/batch0/art'
SOURCES={
 'hero':('home_r9_hero.png','exec-28a686bd-dcd1-4991-b795-a0820601b4f2.png'),
 'slipper':('home_r9_slipper.png','exec-9baa9c02-2ee9-47eb-8f32-07e147b09c1a.png')}
GEN=Path('/Users/admin/.codex/generated_images/01a0a323-ea60-7791-9920-28c97bd2db6a')
images={}
for k,(orig,generated) in SOURCES.items():
 for src,dst in [(ART/orig,ROOT/('original-'+orig)),(GEN/generated,ROOT/('generated-'+k+'.png'))]:
  if not dst.exists():shutil.copy2(src,dst)
 a=Image.open(ROOT/('original-'+orig)).convert('RGBA')
 b=Image.open(ROOT/('generated-'+k+'.png')).convert('RGB').resize(a.size,Image.Resampling.LANCZOS)
 images[k]=(a,b)
# Each polygon covers both full old eye and new eye. Only material border feathers.
CONFIG=[
 ('duck','hero',(340,68,162,101),[
  ([(357,76),(379,73),(391,84),(389,110),(378,125),(351,116),(346,102)],(-5,0)),
  ([(441,94),(466,94),(485,108),(494,127),(487,150),(468,162),(442,158),(427,142),(429,117)],(-3,-1))]),
 ('crate','hero',(285,1095,143,162),[
  ([(329,1104),(364,1101),(394,1117),(411,1148),(419,1184),(407,1225),(384,1244),(351,1250),(316,1233),(297,1199),(296,1163),(307,1127)],(0,0))]),
 ('toilet','hero',(429,438,220,113),[
  ([(463,479),(489,477),(507,491),(508,525),(493,547),(465,548),(445,535),(438,516),(443,492)],(0,0)),
  ([(591,445),(615,443),(635,459),(638,488),(625,509),(601,516),(580,504),(571,482),(577,460)],(0,0))]),
 ('slipper','slipper',(197,106,110,86),[
  ([(215,142),(232,141),(245,154),(246,176),(233,190),(213,188),(201,174),(199,155)],(7,1)),
  ([(280,110),(292,108),(303,121),(304,140),(297,152),(279,149),(271,136),(271,120)],(5,-3))])
]
manifest=[];preview={k:a.copy() for k,(a,b) in images.items()}
for name,key,rect,areas in CONFIG:
 a,b=images[key];patch=Image.new('RGBA',a.size,(0,0,0,0))
 for poly,(dx,dy) in areas:
  mask=Image.new('L',a.size);ImageDraw.Draw(mask).polygon(poly,fill=255)
  # A full opaque material inset occludes all original sclera. Only outer ~5 px blend.
  mask=mask.filter(ImageFilter.MaxFilter(13 if key=='hero' else 7)).filter(ImageFilter.GaussianBlur(2.4 if key=='hero' else 1.5))
  mv=np.asarray(mask).copy();mv[mv>205]=255
  # Permit only original solid material: no synthesized contour/background.
  interior=a.getchannel('A').point(lambda v:255 if v>=250 else 0).filter(ImageFilter.MinFilter(5))
  mv[np.asarray(interior)==0]=0
  shifted=Image.new('RGB',b.size);shifted.paste(b,(dx,dy))
  if key=='slipper' and dx==5:
   # Generation moved the mouth; only retain its eye, reconstruct the tiny red strip below.
   orig=np.asarray(a)[:,:,:3].astype(float);arr=np.asarray(shifted).copy()
   yy,xx=np.indices((a.height,a.width))
   sample=(xx>=263)&(xx<=305)&(yy>=105)&(yy<=151)&(orig[:,:,0]>175)&(orig[:,:,1]<90)&(orig[:,:,2]<100)
   features=np.stack([np.ones_like(xx),xx-285,yy-130],axis=-1)
   coef=np.linalg.lstsq(features[sample],orig[sample],rcond=None)[0]
   fill=(xx>=264)&(xx<=292)&(yy>=138)&(yy<=164)
   arr[fill]=np.clip(features[fill]@coef,0,255).astype('uint8')
   shifted=Image.fromarray(arr)
   mouth=(xx>=245)&(xx<=291)&(yy>=149)&(orig[:,:,0]<160)
   mouth=Image.fromarray((mouth*255).astype('uint8')).filter(ImageFilter.MaxFilter(3))
   mv[np.asarray(mouth)>0]=0
  if name=='duck':
   rgb=np.asarray(shifted).astype('int16');mv[(rgb[:,:,0]-rgb[:,:,2])<25]=0
  layer=shifted.convert('RGBA');layer.putalpha(Image.fromarray(mv))
  patch=Image.alpha_composite(patch,layer)
 x,y,right,bottom=patch.getbbox();w,h=right-x,bottom-y;patch=patch.crop((x,y,right,bottom))
 filename=f'home_face_{name}_'+('look' if name=='toilet' else 'blink')+'_r1.png'
 patch.save(ART/filename)
 preview[key].alpha_composite(patch,(x,y))
 uid=str(uuid.uuid5(uuid.NAMESPACE_URL,'zheyenengdie/home-expression-r1/'+filename))
 meta=json.loads((ART/'home_r9_slipper.png.meta').read_text())
 old=meta['uuid'];meta=json.loads(json.dumps(meta).replace(old,uid).replace('home_r9_slipper',filename[:-4]))
 sf=meta['subMetas']['f9941']['userData']
 sf.update(width=w,height=h,rawWidth=w,rawHeight=h)
 sf['vertices']={'rawPosition':[-w/2,-h/2,0,w/2,-h/2,0,-w/2,h/2,0,w/2,h/2,0],'indexes':[0,1,2,2,1,3],'uv':[0,h,w,h,0,0,w,0],'nuv':[0,0,1,0,0,1,1,1],'minPos':[-w/2,-h/2,0],'maxPos':[w/2,h/2,0]}
 (ART/(filename+'.meta')).write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
 manifest.append({'name':name,'asset':str((ART/filename).relative_to(PROJECT)), 'uuid':uid,'spriteFrameUuid':uid+'@f9941','targetSource':SOURCES[key][0],'sourceSize':list(a.size),'rect':{'left':x,'top':y,'width':w,'height':h},'alpha':'feathered outside fully replaced eyes; clipped to solid original material interior (source alpha >=250)','sha256':hashlib.sha256((ART/filename).read_bytes()).hexdigest()})
for key,im in preview.items():im.save(ROOT/('composite-'+key+'.png'))
(ROOT/'manifest.json').write_text(json.dumps({'generator':'built-in image_gen','sourcePolicy':'approved original remains default; generated full sprite is never imported','assets':manifest},indent=2,ensure_ascii=False)+'\n')
# Review all finished overlays against light and dark backgrounds and the unmodified original.
canvas=Image.new('RGB',(1800,1540),'#dddddd');d=ImageDraw.Draw(canvas)
for i,key in enumerate(('hero','slipper')):
 a=images[key][0];p=preview[key];scale=.65 if key=='hero' else 2
 y=20 if key=='hero' else 1000
 for j,im in enumerate((a,p)):
  size=(round(im.width*scale),round(im.height*scale));view=im.resize(size,Image.Resampling.LANCZOS)
  tile=Image.new('RGBA',size,'#eaf6ff' if j==0 else '#182c42');tile.alpha_composite(view)
  x=j*720;canvas.paste(tile.convert('RGB'),(x,y));d.text((x,y-16),key+(' original' if j==0 else ' expressive overlay'),fill='black')
canvas.crop((0,0,1440,1535)).save(ROOT/'finished-review.png')
print(json.dumps(manifest,indent=2))
