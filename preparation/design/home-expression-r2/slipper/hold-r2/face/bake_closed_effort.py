from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np, hashlib, json, math
from collections import deque
D=Path(__file__).resolve().parent
ROOT=D.parents[5]
SRC=ROOT/'assets/batch0/art/home_r9_slipper.png'
a=np.array(Image.open(SRC).convert('RGBA')); H,W=a.shape[:2]
original=Image.fromarray(a); S=4
rect=[197,106,112,95]; x0,y0,cw,ch=rect
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
def component(mask):
 seen=np.zeros_like(mask); parts=[]
 for y,x in np.argwhere(mask):
  if seen[y,x]:continue
  q=deque([(int(y),int(x))]);seen[y,x]=True;p=[]
  while q:
   yy,xx=q.popleft();p.append((yy,xx))
   for dy,dx in [(0,1),(1,0),(0,-1),(-1,0)]:
    yn,xn=yy+dy,xx+dx
    if 0<=yn<mask.shape[0] and 0<=xn<mask.shape[1] and mask[yn,xn] and not seen[yn,xn]:seen[yn,xn]=True;q.append((yn,xn))
  parts.append(p)
 out=np.zeros_like(mask)
 for y,x in max(parts,key=len):out[y,x]=True
 return out
features=[('left',(198,141,241,189),(220,164)),('right',(272,110,306,153),(287.5,131.5)),('mouth',(245,146,295,198),(269.5,172))]
allmask=np.zeros((H,W),bool); masks={}
for name,box,c in features:
 l,t,r,b=box;v=a[t:b,l:r];raw=(v[:,:,0]<160)&(v[:,:,1]<110)&(v[:,:,2]<110)
 mask=np.zeros((H,W),np.uint8);mask[t:b,l:r]=component(raw)*255
 mask=np.array(Image.fromarray(mask).filter(ImageFilter.MaxFilter(5)))>0
 for y in range(t,b):
  xs=np.where(mask[y,l:r])[0]
  if len(xs):mask[y,l+xs[0]:l+xs[-1]+1]=True
 masks[name]=mask;allmask|=mask
fill=a[:,:,:3].astype(float)
ring=(np.array(Image.fromarray((allmask*255).astype('uint8')).filter(ImageFilter.MaxFilter(7)))>0)&~allmask
fill[allmask]=np.mean(fill[ring],axis=0)
for _ in range(2600):
 avg=(np.roll(fill,1,0)+np.roll(fill,-1,0)+np.roll(fill,1,1)+np.roll(fill,-1,1))*.25
 fill[allmask]=avg[allmask]
clean=Image.fromarray(np.dstack((fill.clip(0,255).astype('uint8'),a[:,:,3])))
clean.save(D/'registered-clean-face.png')
gen=Image.open(D/'generated-cute-effort.png').convert('RGB')
# Generated render has a baked checkerboard outside the shoe. Only masked black
# facial material is ever extracted. No generator background or shoe body enters.
extracts={
 'left':((805,604,991,750),(38,28)),
 'right':((1120,493,1264,635),(27,29)),
 'mouth':((997,636,1164,735),(25,11)),
}
planes={}
for name,(box,size) in extracts.items():
 im=gen.crop(box);v=np.array(im).astype(float)
 # Red plastic outside the sculpted black feature maps to zero opacity.
 dark=(v[:,:,0]<150)&(v[:,:,1]<135)&(v[:,:,2]<135)
 comp=component(dark)
 ys,xs=np.where(comp);b=(max(0,xs.min()-4),max(0,ys.min()-4),min(im.width,xs.max()+5),min(im.height,ys.max()+5))
 im=im.crop(b);v=np.array(im).astype(float)
 alpha=np.clip((210-v[:,:,0])/90,0,1)
 # Keep highlights within filled black-shape silhouette, not as transparent holes.
 cm=component((v[:,:,0]<155)&(v[:,:,1]<140)&(v[:,:,2]<140))
 sm=Image.fromarray((cm*255).astype('uint8')).filter(ImageFilter.MaxFilter(3))
 support=np.asarray(sm)>0
 for y in range(support.shape[0]):
  xs=np.where(support[y])[0]
  if len(xs):support[y,xs[0]:xs[-1]+1]=True
 alpha=np.maximum(alpha,support*.98)
 alpha=np.where(np.asarray(sm)>0,alpha,0)
 # Remove red fringe before antialiased resampling.
 v[:,:,0]=np.minimum(v[:,:,0],v[:,:,1]+12)
 out=Image.fromarray(np.dstack((v.clip(0,255).astype('uint8'),(alpha*255).astype('uint8'))))
 out=out.resize((size[0]*S,size[1]*S),Image.Resampling.LANCZOS)
 out.save(D/f'generated-{name}-material.png');planes[name]=out

big=original.resize((W*S,H*S),Image.Resampling.LANCZOS)
cleanbig=clean.resize((W*S,H*S),Image.Resampling.LANCZOS)
maskbig=Image.fromarray((allmask*255).astype('uint8')).resize(big.size,Image.Resampling.LANCZOS)
allowed=np.array(Image.fromarray((allmask*255).astype('uint8')).filter(ImageFilter.MaxFilter(7)))>0
# Bounding pixels cover original black features plus the locally redrawn lids.
centres={name:center for name,_,center in features}

def rendered(strength,phase):
 comp=big.copy();comp.paste(cleanbig,(0,0),maskbig)
 if strength<.6:
  # One original textured surface closes geometrically in the source face plane.
  angle=np.deg2rad(-26);R=np.array([[np.cos(angle),-np.sin(angle)],[np.sin(angle),np.cos(angle)]])
  for name,box,center in features:
   mask=Image.fromarray((masks[name]*255).astype('uint8')).resize(big.size,Image.Resampling.LANCZOS)
   plane=big.copy();plane.putalpha(mask)
   sx=1-.1*strength;sy=max(.055,1-strength*.96)
   inv=R@np.diag([1/sx,1/sy])@R.T;cen=np.array(center)*S;bias=cen-inv@cen
   out=plane.transform(big.size,Image.Transform.AFFINE,(inv[0,0],inv[0,1],bias[0],inv[1,0],inv[1,1],bias[1]),Image.Resampling.BICUBIC)
   comp.alpha_composite(out)
 else:
  for name,plane0 in planes.items():
   plane=plane0 if strength>=1 else plane0.resize((plane0.width,round(plane0.height*(.6+(strength-.6)))),Image.Resampling.LANCZOS)
   cx,cy=centres[name]
   # Eyes are entirely constant. Only the 25px lip trembles locally. At the
   # sample's 97px slipper width this is under 0.30 physical screen pixels.
   dx=.95*math.sin(phase) if name=='mouth' else 0
   dy=1.05*math.sin(phase) if name=='mouth' else 0
   # Quarter-source-pixel bake ensures subpixel motion after mobile downscale.
   pos=(round((cx+dx)*S-plane.width/2),round((cy+dy)*S-plane.height/2))
   comp.alpha_composite(plane,pos)
 g=np.array(comp.resize((W,H),Image.Resampling.LANCZOS));g[~allowed]=a[~allowed]
 out=g[y0:y0+ch,x0:x0+cw].copy()
 out[:,:,3]=np.where(allowed[y0:y0+ch,x0:x0+cw],255,0)
 patch=Image.fromarray(out)
 composite=original.copy();composite.alpha_composite(patch,(x0,y0))
 return patch,composite

frames=[];composites=[];initial_times=[0,.035,.07,.105,.14]
for i,t in enumerate(initial_times):
 strength=i/4*.91
 if i==0:patch=Image.new('RGBA',(cw,ch));comp=original.copy()
 else:patch,comp=rendered(strength,0)
 name=f'close_{i:02d}.png';patch.save(D/name)
 frames.append({'file':name,'timeSeconds':t,'phase':'close','sha256':sha(D/name)})
 composites.append(comp)
loopfrom=.18; loopduration=1
for i in range(25):
 t=i/24;patch,comp=rendered(1,2*math.pi*3*t)
 name=f'hold_{i:02d}.png';patch.save(D/name)
 frames.append({'file':name,'timeSeconds':round(loopfrom+t,6),'phase':'closed-effort-loop','sha256':sha(D/name)})
 composites.append(comp)
manifest={'revision':'cute-closed-eyes-persistent-mouth-effort-r2','source':str(SRC.relative_to(ROOT)),'sourceSize':[W,H],'sourceSha256':sha(SRC),'rect':rect,'rectConvention':'left, top, width, height in source slipper pixels','frames':frames,'loopFrom':loopfrom,'durationSeconds':loopfrom+loopduration,'loopDurationSeconds':loopduration,'fps':24,'mouthFrequencyHz':3,'mouthMaxDisplacementSourcePixels':[1,1],'mouthMaxDisplacementAt97pxSlipper':[.285,.285],'eyesRemainClosedInLoop':True,'loopFirstAndLastIdentical':True,'runtime':'Begin once after both hands contact. Advance unwrapped elapsed clock; after 0.18 seconds loop only closed-effort frames. Never restart from frame0 on actor loop. Draw exactly one frame, no crossfade. No full slipper or whole-face jitter.','prompt':'prompt.txt','generatedReference':'generated-cute-effort.png','script':'bake_closed_effort.py','productionIntegrated':False}
(D/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
# Check immutable eyes on every loop frame outside a bounded mouth area.
ims=[np.array(Image.open(D/f'hold_{i:02d}.png')) for i in range(25)]
eyemask=np.ones((ch,cw),bool);eyemask[150-y0:194-y0,246-x0:292-x0]=False
same_eyes=all(np.array_equal(im[eyemask],ims[0][eyemask]) for im in ims)
protected=0
for comp in composites:
 protected=max(protected,int(np.any(np.array(comp)[~allowed]!=a[~allowed],axis=1).sum()))
checks={'status':'passed','frameCount':len(frames),'loopFrameCount':25,'sourceUnchanged':sha(SRC)==manifest['sourceSha256'],'protectedPixelsChanged':protected,'loopFirstLastPixelIdentical':np.array_equal(ims[0],ims[-1]),'eyesIdenticalEveryLoopFrame':same_eyes,'loopFramesAllHaveVisiblePatch':all(np.any(im[:,:,3]) for im in ims),'onlyMouthChangesDuringLoop':same_eyes,'mouthDistinctLoopFrames':len({im.tobytes() for im in ims}),'sourceAlphaContourUntouched':all(np.array_equal(np.array(im)[:,:,3][a[:,:,3]<240],a[:,:,3][a[:,:,3]<240]) for im in composites),'reviewLimit':'Protection/loop checks do not establish cuteness; inspect mobile size and normal speed.'}
assert protected==0 and checks['loopFirstLastPixelIdentical'] and same_eyes and checks['sourceAlphaContourUntouched']
(D/'checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2)+'\n')
show=[0,2,4,5,7,9,11,13]
sheet=Image.new('RGB',(4*340,2*284),(192,225,243));draw=ImageDraw.Draw(sheet)
for j,i in enumerate(show):
 x=(j%4)*340;y=(j//4)*284;sheet.paste(composites[i],(x,y),composites[i]);draw.text((x+8,y+261),frames[i]['file'],fill=(24,52,69))
sheet.save(D/'contact-sheet.png')
phone=Image.new('RGB',(4*150,2*130),(192,225,243));draw=ImageDraw.Draw(phone)
for j,i in enumerate(show):
 x=(j%4)*150;y=(j//4)*130;im=composites[i].resize((97,73),Image.Resampling.LANCZOS);phone.paste(im,(x+26,y+15),im);draw.text((x+22,y+97),frames[i]['file'],fill=(24,52,69))
phone.save(D/'phone-contact-sheet.png')
movie=[]
for i in range(24):
 im=composites[5+i].resize((97,73),Image.Resampling.LANCZOS);bg=Image.new('RGB',(160,120),(192,225,243));bg.paste(im,(31,20),im);movie.append(bg)
movie[0].save(D/'phone-loop.gif',save_all=True,append_images=movie[1:],duration=[42,42,41]*8,loop=0)
composites[5].save(D/'closed-composite.png')
print(json.dumps(checks,ensure_ascii=False))
