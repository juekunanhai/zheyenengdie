"""R2 prototype only. Register generated eyelid texture over an unscaled original eyeball."""
from pathlib import Path
from PIL import Image,ImageFilter,ImageDraw
import numpy as np,json,hashlib
ROOT=Path(__file__).resolve().parent
ORIGINAL=Image.open(ROOT/'original-hero.png').convert('RGBA')
GENERATED=Image.open(ROOT/'generated-closed-lids.png').convert('RGBA').resize(ORIGINAL.size,Image.Resampling.LANCZOS)
A=np.array(ORIGINAL);G=np.array(GENERATED);H,W=A.shape[:2]
CLOSURE=[0,1/6,2/6,3/6,4/6,5/6,1]
# Source-pixel ROIs include the actual original eye, not the eyebrow or neighboring beak/mouth.
EYES={
 'duck':[(348,74,393,126,'dark'),(425,91,490,162,'dark')],
 'crate':[(284,1089,432,1263,'white')],
}
RECTS={'duck':(334,61,173,114),'crate':(284,1089,148,174)}

def component(mask):
 seen=np.zeros(mask.shape,bool);best=[]
 for yy,xx in np.argwhere(mask):
  if seen[yy,xx]:continue
  stack=[(yy,xx)];seen[yy,xx]=True;points=[]
  while stack:
   y,x=stack.pop();points.append((y,x))
   for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
    ny,nx=y+dy,x+dx
    if 0<=ny<mask.shape[0] and 0<=nx<mask.shape[1] and mask[ny,nx] and not seen[ny,nx]:
     seen[ny,nx]=True;stack.append((ny,nx))
  if len(points)>len(best):best=points
 out=np.zeros(mask.shape,'uint8')
 for y,x in best:out[y,x]=255
 return out

def eye_data(roi):
 x0,y0,x1,y1,kind=roi;rgb=A[y0:y1,x0:x1,:3].astype(float)
 dark=(rgb[:,:,0]<170)&(rgb[:,:,1]<140)&(rgb[:,:,2]<135)
 if kind=='white':dark|=(rgb[:,:,0]>135)&(rgb[:,:,1]>135)&(rgb[:,:,2]>135)
 eye=component(dark)
 # Fill original highlight holes then expand over its original outline, staying inside the face.
 for x in range(eye.shape[1]):
  yy=np.flatnonzero(eye[:,x])
  if len(yy):eye[yy[0]:yy[-1]+1,x]=255
 core=np.array(Image.fromarray(eye).filter(ImageFilter.MaxFilter(3)))
 eye=np.array(Image.fromarray(eye).filter(ImageFilter.MaxFilter(19 if kind=='white' else 7)))
 coords=[]
 for x in range(eye.shape[1]):
  yy=np.flatnonzero(eye[:,x]);gx=x+x0
  if not len(yy):continue
  top,bottom=yy[0]+y0,yy[-1]+y0
  # Actual generated crease position is sampled from the lower half of the original eye region.
  lo=round(top+(bottom-top)*.38);hi=min(y1,round(top+(bottom-top)*.91)+1)
  color=G[lo:hi,gx,:3].astype(float)
  if not len(color):continue
  luminance=color@np.array([.2126,.7152,.0722])
  seam=lo+int(np.argmin(luminance))
  cy=np.flatnonzero(core[:,x])
  real_top=float(cy[0]+y0) if len(cy) else (top+bottom)/2
  real_bottom=float(cy[-1]+y0) if len(cy) else (top+bottom)/2
  coords.append([gx,float(top),float(bottom),float(seam),real_top,real_bottom,float(len(cy)>0)])
 # Suppress one-pixel detection noise while retaining the generated crease curve.
 raw=np.array(coords)
 for i in range(len(raw)):
  raw[i,3]=np.median(np.array(coords)[max(0,i-2):min(len(raw),i+3),3])
 return raw

def skin_field(roi):
 x0,y0,x1,y1,kind=roi
 margin=18 if kind=='white' else 12
 left,top,right,bottom=max(0,x0-margin),max(0,y0-margin),min(W,x1+margin),min(H,y1+margin)
 rgb=A[top:bottom,left:right,:3].astype(float);yy,xx=np.indices(rgb.shape[:2]);xx=xx+left;yy=yy+top
 if kind=='white':good=(rgb[:,:,0]<70)&(rgb[:,:,1]>105)&(rgb[:,:,2]>180)&(rgb[:,:,2]>rgb[:,:,1]+50)
 else:good=(rgb[:,:,0]>185)&(rgb[:,:,1]>160)&(rgb[:,:,1]/np.maximum(1,rgb[:,:,0])>.74)&(rgb[:,:,2]<170)
 good&=A[top:bottom,left:right,3]>=250
 cx,cy=(x0+x1)/2,(y0+y1)/2;scale=max(x1-x0,y1-y0)
 u=(xx-cx)/scale;v=(yy-cy)/scale
 features=np.stack([np.ones_like(u),u,v,u*u,u*v,v*v],axis=-1)
 coef=np.linalg.lstsq(features[good],rgb[good],rcond=None)[0]
 return lambda x,y: np.clip(np.stack([np.ones_like(y),(x-cx)/scale+np.zeros_like(y),(y-cy)/scale,
  ((x-cx)/scale)**2+np.zeros_like(y),(x-cx)*(y-cy)/scale**2,((y-cy)/scale)**2],axis=-1)@coef,0,255)

DATA={name:[(eye_data(roi),skin_field(roi)) for roi in rois] for name,rois in EYES.items()}

def sample_vertical(x, ys):
 y0=np.floor(ys).astype(int).clip(0,H-1);y1=(y0+1).clip(0,H-1);w=(ys-y0)[:,None]
 return G[y0,x,:3]*(1-w)+G[y1,x,:3]*w

def render(name,amount):
 patch=np.zeros_like(A)
 if amount==0:return Image.fromarray(patch).crop((RECTS[name][0],RECTS[name][1],RECTS[name][0]+RECTS[name][2],RECTS[name][1]+RECTS[name][3]))
 for coords,skin in DATA[name]:
  for xx,top,bottom,seam,real_top,real_bottom,has_core in coords:
   x=int(xx);ys=np.arange(int(top),int(bottom)+1,dtype=float)
   target=np.clip(seam,real_top,real_bottom) if name=='duck' else real_top+.42*(real_bottom-real_top)
   upper_weight=amount if name=='duck' else max(0,(amount-.40)/.60)
   lower_weight=amount if name=='duck' else min(1,amount*1.35)
   upper=real_top+upper_weight*(target-real_top);lower=real_bottom-lower_weight*(real_bottom-target)
   upper_alpha=np.clip(upper-ys+.5,0,1);lower_alpha=np.clip(ys-lower+.5,0,1)
   if name=='crate' and upper_weight==0:upper_alpha[:]=0
   opacity=np.maximum(upper_alpha,lower_alpha)
   # Original face-material gradients repair the covered surface. No generated raised eye-cap.
   rgb=skin(x,ys)
   # Retain only the image-generated thin crease color at the traveling lid edge.
   crease=sample_vertical(x,np.array([seam]))[0]
   upper_distance=np.abs(ys-upper);lower_distance=np.abs(ys-lower)
   edge=np.minimum(upper_distance,lower_distance)
   thickness=.62 if name=='duck' else .78
   line=np.exp(-.5*(edge/thickness)**2)*opacity*has_core
   if name=='crate' and upper_weight==0:line=np.exp(-.5*(lower_distance/thickness)**2)*opacity*has_core
   rgb=rgb*(1-line[:,None])+crease[None,:]*line[:,None]
   # Soft material perimeter, independent of the moving interior eyelid edge.
   feather=6 if name=='crate' else 2
   outer=np.minimum(np.clip((ys-top+1)/feather,0,1),np.clip((bottom-ys+1)/feather,0,1))
   outer*=min(1,(x-coords[0,0]+1)/feather,(coords[-1,0]-x+1)/feather)
   opacity*=outer
   iy=ys.astype(int);interior=A[iy,x,3]>=250
   if name=='duck':
    interior&=(rgb[:,0]-rgb[:,2]>20)
    old=A[iy,x,:3].astype(float)
    if 348<=x<=405:
     # Source beak silhouette landmarks, not an eyelid-color heuristic (which would preserve an old eye ring).
     boundary=np.interp(x,[348,350,355,358,360,365,370,375,380,385,390,398,405],
      [113.5,114.6,117,118.4,119.2,120,118.7,116,114.8,114.4,115.2,118.7,123])
     interior&=iy<boundary
   else:
    old=A[iy,x,:3].astype(float)
    pink=(old[:,0]>180)&(old[:,0]>old[:,1]*1.3)&(old[:,0]>old[:,2]*1.2)
    interior&=~pink
    if x>=401:interior&=iy<1234
   patch[iy,x,:3]=np.clip(rgb,0,255).astype('uint8');patch[iy,x,3]=(opacity*interior*255).round().astype('uint8')
 x,y,w,h=RECTS[name]
 return Image.fromarray(patch).crop((x,y,x+w,y+h))

manifest={'status':'prototype only; never imported into production assets or scene','generator':'built-in image_gen',
 'baseSource':'original-hero.png','sourceSize':[1024,1536],
 'format':'Seven RGBA overlay PNGs per character. Frame 0 is fully transparent so the original face is exactly unchanged. Replace overlay frame directly; no crossfade, no scale change.',
 'motion':'Original eyeballs and highlights stay at the same source pixels. Original surrounding face color gradients fill the occluded area; only the generated thin crease color and measured curve are reused. No generated raised cap, halo or highlight is imported. Duck upper lid leads; crate shallow response raises the lower lid first. Reverse frame order to reopen.',
 'assets':[]}
composites={}
for name in EYES:
 frames=[];fulls=[];x,y,w,h=RECTS[name]
 for index,amount in enumerate(CLOSURE):
  patch=render(name,amount);filename=f'{name}_{index:02d}.png';patch.save(ROOT/filename)
  full=ORIGINAL.copy();full.alpha_composite(patch,(x,y));fulls.append(full)
  frames.append({'index':index,'closurePercent':round(amount*100,3),'file':filename,'sha256':hashlib.sha256((ROOT/filename).read_bytes()).hexdigest()})
 composites[name]=fulls
 manifest['assets'].append({'name':name,'target':'R9Hero','sourceSize':[1024,1536],
  'rect':{'left':x,'top':y,'width':w,'height':h},'frames':frames,
  'suggestedPeakFrame':6 if name=='duck' else 2,'suggestedCloseMs':70 if name=='duck' else 80,
  'suggestedHoldMs':35 if name=='duck' else 70,'suggestedOpenMs':120 if name=='duck' else 140})
 # At 375px home width the hero is 235px wide. This preview preserves that physical pixel size.
 ids=[0,1,2,3,4,5,6,5,4,3,2,1,0] if name=='duck' else [0,1,2,2,1,0]
 durations=[750,10,10,10,20,20,35,20,20,20,20,20,900] if name=='duck' else [750,40,40,70,70,900]
 for suffix,scale in [('mobile-1x',235/1024),('detail-3x',3)]:
  gifs=[]
  for i in ids:
   if suffix=='mobile-1x':frame=fulls[i].resize((235,round(1536*scale)),Image.Resampling.LANCZOS)
   else:frame=fulls[i].crop((x,y,x+w,y+h)).resize((w*3,h*3),Image.Resampling.LANCZOS)
   bg=Image.new('RGBA',frame.size,'#d8efff');bg.alpha_composite(frame);gifs.append(bg.convert('RGB'))
  gifs[0].save(ROOT/f'{name}-{suffix}.gif',save_all=True,append_images=gifs[1:],duration=durations,loop=0,disposal=2)
 # Filmstrip makes aperture clipping / identity preservation inspectable.
 strip=Image.new('RGB',(w*7,h+22),'#d8efff');draw=ImageDraw.Draw(strip)
 for i,full in enumerate(fulls):
  crop=full.crop((x,y,x+w,y+h));strip.paste(crop,(i*w,22),crop);draw.text((i*w+3,4),f'{round(CLOSURE[i]*100)}%',fill='#18354c')
 strip.save(ROOT/f'{name}-filmstrip.png')
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
print([(a['name'],a['rect']) for a in manifest['assets']])
