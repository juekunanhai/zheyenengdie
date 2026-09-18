"""Bake the approved local toy-glove addition; never writes production inputs."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter
import numpy as np, json, hashlib
from collections import deque
def largest_component(mask):
 h,w=mask.shape;seen=np.zeros_like(mask);largest=[]
 for y,x in zip(*np.where(mask)):
  if seen[y,x]:continue
  queue=deque([(y,x)]);seen[y,x]=1;points=[]
  while queue:
   a,b=queue.popleft();points.append((a,b))
   for c,d in [(a-1,b),(a+1,b),(a,b-1),(a,b+1)]:
    if 0<=c<h and 0<=d<w and mask[c,d] and not seen[c,d]:seen[c,d]=1;queue.append((c,d))
  if len(points)>len(largest):largest=points
 out=np.zeros_like(mask)
 for y,x in largest:out[y,x]=True
 # Flood only exterior transparency; enclosed pure-white glove highlights stay opaque.
 exterior=np.zeros_like(mask);queue=deque([(0,0)]);exterior[0,0]=1
 while queue:
  a,b=queue.popleft()
  for c,d in [(a-1,b),(a+1,b),(a,b-1),(a,b+1)]:
   if 0<=c<h and 0<=d<w and not out[c,d] and not exterior[c,d]:exterior[c,d]=1;queue.append((c,d))
 return ~exterior
P=Path(__file__).resolve().parent
base=Image.open(P.parent/'reference-pair.png').convert('RGBA')
rgb=np.array(Image.open(P/'generated-pair.png').convert('RGB').resize(base.size,Image.Resampling.LANCZOS)).astype(float)
CROP=(350,250,630,590); W,H=280,340; FPS=24
yy,xx=np.mgrid[CROP[1]:CROP[3],CROP[0]:CROP[2]]; q=np.stack([xx,yy],axis=-1).reshape(-1,2)
source={}; chains={
 'far':np.array([[408,304],[422,326],[419,349],[422,379]],float),
 'near':np.array([[430,278],[463,346],[441,430],[435,464]],float)}
polygons={
 'far':[(389,301),(412,288),(439,325),(450,355),(450,411),(425,423),(389,396),(390,344)],
 'near':[(423,253),(447,281),(481,318),(485,384),(458,434),(478,464),(478,508),(419,511),(391,477),(394,450),(433,415),(449,358),(443,318),(421,287)]}
for name,poly in polygons.items():
 mask=Image.new('L',base.size);ImageDraw.Draw(mask).polygon(poly,fill=255)
 red=(rgb[:,:,0]>rgb[:,:,1]*1.5)&(rgb[:,:,0]>rgb[:,:,2]*1.4)
 cream=(rgb[:,:,0]-rgb[:,:,2]>5)&(rgb[:,:,0]-rgb[:,:,2]<110)&(rgb[:,:,1]-rgb[:,:,2]>2)&(rgb[:,:,2]>95)&(rgb[:,:,0]>145)
 # Remove the other arm's edge and small residuals, preserving just this limb.
 a=largest_component((red|cream)&(np.array(mask)>0)).astype('uint8')*255
 a=Image.fromarray(a.astype('uint8')).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(.4))
 source[name]=np.dstack([rgb,np.array(a)])
 Image.fromarray(np.uint8(source[name])).save(P/f'source-{name}.png')
POSES={
 'hidden':{'far':[[412,294],[411,295],[398,283],[393,278]],'near':[[424,285],[413,282],[402,272],[397,266]]},
 'peek':{'far':[[416,303],[444,322],[450,347],[449,364]],'near':[[438,290],[469,319],[480,350],[481,369]]},
 'touch':{'far':[[416,303],[451,349],[446,417],[438,444]],'near':[[438,290],[504,379],[506,477],[491,505]]},
 'grip':{'far':[[416,303],[449,349],[444,417],[436,443]],'near':[[438,290],[502,379],[504,477],[489,504]]}}
KEYS=[(0,'hidden',0),(.08,'hidden',0),(.34,'peek',0),(.73,'touch',0),(.92,'grip',1),(1.12,'grip',1),(1.31,'touch',0),(1.64,'peek',0),(1.9,'hidden',0),(2.,'hidden',0)]
def smooth(x):return x*x*(3-2*x)
def state(t,name):
 i=next((i for i in range(len(KEYS)-1) if KEYS[i+1][0]>=t),len(KEYS)-2)
 a,b=KEYS[i],KEYS[i+1];v=smooth(np.clip((t-a[0])/(b[0]-a[0]),0,1))
 return np.array(POSES[a[1]][name])*(1-v)+np.array(POSES[b[1]][name])*v,a[2]*(1-v)+b[2]*v
def normal(ch,i):
 v=ch[min(i+1,len(ch)-1)]-ch[max(i-1,0)];v=v/max(.01,np.linalg.norm(v));return np.array([-v[1],v[0]])
def kernel(a,b):
 r=((a[:,None]-b[None])**2).sum(axis=2);return r*np.log(r+1e-12)
def warp(name,ch,grip):
 c=chains[name];scale=.68 if name=='near' else .72;src=[];dst=[]
 for i,w in [(0,8),(1,12),(2,12)]:
  for k in [-1,0,1]:src.append(c[i]+normal(c,i)*w*k);dst.append(ch[i]+normal(ch,i)*w*k*scale)
 # The hand is one surface. Keep palm width fixed; only distal finger points curl.
 for dx,dy in [(-24,-15),(22,-15),(-26,18),(24,22),(0,0),(0,34),(-12,25),(12,25)]:
  src.append(c[-1]+[dx,dy]);dst.append(ch[-1]+np.array([dx,dy])*scale+np.array([-1 if dx>0 else 1,-2])*grip*(dy>15))
 s=np.array(src)/700;d=np.array(dst)/700;n=len(d);p=np.c_[np.ones(n),d]
 coef=np.linalg.solve(np.block([[kernel(d,d)+np.eye(n)*1e-8,p],[p.T,np.zeros((3,3))]]),np.vstack([s,np.zeros((3,2))]))
 z=q/700;xy=(np.c_[kernel(z,d),np.ones(len(z)),z]@coef*700).reshape(H,W,2)
 x,y=xy[:,:,0],xy[:,:,1];x0=np.floor(x).astype(int);y0=np.floor(y).astype(int);fx=x-x0;fy=y-y0
 valid=(x>=0)&(x<679)&(y>=0)&(y<719);x0=np.clip(x0,0,678);y0=np.clip(y0,0,718);im=source[name]
 out=im[y0,x0]*(1-fx[:,:,None])*(1-fy[:,:,None])+im[y0,x0+1]*fx[:,:,None]*(1-fy[:,:,None])+im[y0+1,x0]*(1-fx[:,:,None])*fy[:,:,None]+im[y0+1,x0+1]*fx[:,:,None]*fy[:,:,None]
 out[:,:,3]*=valid
 return out
b=np.array(base.crop(CROP));shoe=(b[:,:,3]>0)&(yy<344)
frames=[];entries=[];(P/'frames').mkdir(exist_ok=True)
for i in range(49):
 t=i/FPS;im=Image.new('RGBA',(W,H));info={}
 for name in ['far','near']:
  ch,g=state(t,name);a=warp(name,ch,g);a[:,:,3]*=1-shoe
  if t<=.08 or t>=1.9:a[:,:,3]=0
  im.alpha_composite(Image.fromarray(np.uint8(np.clip(a,0,255))));info[name]={'rootReferencePx':ch[0].tolist(),'palmReferencePx':ch[-1].tolist()}
 contact=np.clip((t-.65)/.08,0,1)*np.clip((1.39-t)/.08,0,1)
 yellow=(b[:,:,0]>170)&(b[:,:,1]>95)&(b[:,:,2]<110)&(b[:,:,3]>0)
 shade=np.array(im.getchannel('A').filter(ImageFilter.GaussianBlur(3))).astype(float)
 shadow=np.zeros((H,W,4),dtype='uint8');shadow[:,:,:3]=[113,62,18];shadow[:,:,3]=np.uint8(np.roll(shade,3,axis=0)*yellow*.14*contact)
 behind=Image.fromarray(shadow);behind.alpha_composite(im);im=behind
 name=f'frames/frame_{i:03}.png';im.save(P/name);frames.append(im);entries.append({'index':i,'timeSeconds':round(t,5),'file':name,**info})
 print(i,flush=True)
select=[0,6,12,18,23,27,33,39,45]
sheet=Image.new('RGBA',(680*3,750*3),(183,222,244,255));d=ImageDraw.Draw(sheet)
for j,i in enumerate(select):
 comp=base.copy();comp.alpha_composite(frames[i],CROP[:2]);sheet.alpha_composite(comp,((j%3)*680,(j//3)*750));d.text(((j%3)*680+8,(j//3)*750+720),f'{i} / {i/FPS:.2f} seconds',fill='black')
 if i in [12,23,33]:
  comp.save(P/f'pair-frame-{i:03}.png');comp.resize((170,180),Image.Resampling.LANCZOS).save(P/f'phone-detail-{i:03}.png')
sheet.resize((1020,1125)).save(P/'contact-sheet.png')
gif=[]
for frame in frames:
 comp=Image.new('RGBA',base.size,(183,222,244,255));comp.alpha_composite(base);comp.alpha_composite(frame,CROP[:2]);gif.append(comp.resize((340,360)).convert('RGB'))
gif[0].save(P/'preview.gif',save_all=True,append_images=gif[1:],duration=42,loop=0,disposal=2)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
manifest={'status':'independent-motion-sample-not-production','revision':'slipper-pair-hands-r1','fps':FPS,'durationSeconds':2,'frameCount':49,'frameSize':[W,H],'rectStage':[405,475,140,170],'referenceRectPx':list(CROP),'referenceScale':2,'contactSeconds':.73,'gripSeconds':[.92,1.12],'gripHold':[.92,1.12],'motion':'Single generated pixel surface per limb; offline inverse TPS bends red arms and curls glove tips. No opacity mixing. Original shoe occludes roots. Composite over original pair without moving bodies. Small hand contact shadow is clipped to original duck material.','sourceSha256':sha(P/'generated-pair.png'),'prompt':'prompt.txt','frames':entries}
(P/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
checks={'frameCount':49,'equalDimensions':all(x.size==(W,H) for x in frames),'firstAndLastTransparent':frames[0].getbbox() is None and frames[-1].getbbox() is None,'originalReferenceSha256':sha(P.parent/'reference-pair.png'),'frameSha256':{e['file']:sha(P/e['file']) for e in entries}}
checks['originalShoeOcclusionTouchedPixels']=sum(int(np.count_nonzero(np.array(x)[:,:,3][shoe])) for x in frames)
checks['status']='technical_checks_passed_visual_review_separate'
assert checks['originalShoeOcclusionTouchedPixels']==0
(P/'checks.json').write_text(json.dumps(checks,indent=2)+'\n')
