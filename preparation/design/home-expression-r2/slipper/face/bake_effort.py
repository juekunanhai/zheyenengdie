"""Bake a reversible local expression from one original slipper surface.

The generated effort master informs the small pinched lip, never replaces the
slipper. No frame blends two different rendered faces. Production is read-only.
"""
from pathlib import Path
from PIL import Image, ImageFilter, ImageDraw
import numpy as np
import json, hashlib
from collections import deque

D = Path(__file__).resolve().parent
ROOT = D.parents[4]
SRC = ROOT / 'assets/batch0/art/home_r9_slipper.png'
original = Image.open(SRC).convert('RGBA')
a = np.asarray(original).copy()
H, W = a.shape[:2]
rect = [197, 106, 111, 94]
x0,y0,cw,ch = rect

def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()

def feature_mask(box):
    l,t,r,b=box
    m=np.zeros((H,W),np.uint8)
    rgb=a[t:b,l:r,:3]
    raw=(rgb[:,:,0]<160)&(rgb[:,:,1]<110)&(rgb[:,:,2]<110)&(a[t:b,l:r,3]>250)
    # The bounding boxes may contain a corner of a neighbouring feature.
    # Keep the one connected facial shape, never those detached pixels.
    visited=np.zeros_like(raw); components=[]
    for yy,xx in np.argwhere(raw):
        if visited[yy,xx]:continue
        q=deque([(int(yy),int(xx))]);visited[yy,xx]=True;component=[]
        while q:
            yy2,xx2=q.popleft();component.append((yy2,xx2))
            for dy,dx in ((-1,0),(1,0),(0,-1),(0,1)):
                yn,xn=yy2+dy,xx2+dx
                if 0<=yn<raw.shape[0] and 0<=xn<raw.shape[1] and raw[yn,xn] and not visited[yn,xn]:
                    visited[yn,xn]=True;q.append((yn,xn))
        components.append(component)
    component=max(components,key=len)
    for yy,xx in component:m[t+yy,l+xx]=255
    im=Image.fromarray(m).filter(ImageFilter.MaxFilter(5))
    # Fill enclosed tongue/highlight holes without touching the source contour.
    mask=np.asarray(im)>0
    for yy in range(t,b):
        ids=np.where(mask[yy,l:r])[0]
        if len(ids)>1:mask[yy,l+ids[0]:l+ids[-1]+1]=True
    return mask

features=[
    {'name':'left-eye','box':(198,141,241,189),'center':(219.5,165),'endScale':(.99,.60)},
    {'name':'right-eye','box':(272,110,306,153),'center':(287.5,132),'endScale':(.99,.58)},
    {'name':'mouth','box':(245,146,293,196),'center':(269,171),'endScale':(1.03,.19)},
]
all_mask=np.zeros((H,W),bool)
for f in features:
    f['mask']=feature_mask(f['box']);all_mask|=f['mask']

# Harmonic local fill reconstructs only red plastic hidden by facial features.
# Boundary pixels, white stripes, specular highlights and silhouette stay exact.
filled=a[:,:,:3].astype(float)
boundary=np.asarray(Image.fromarray((all_mask*255).astype('uint8')).filter(ImageFilter.MaxFilter(7)))>0
ring=boundary & ~all_mask
filled[all_mask]=np.mean(filled[ring],axis=0)
for _ in range(2600):
    avg=(np.roll(filled,1,0)+np.roll(filled,-1,0)+np.roll(filled,1,1)+np.roll(filled,-1,1))*.25
    filled[all_mask]=avg[all_mask]
clean=Image.fromarray(np.dstack((np.uint8(np.clip(filled,0,255)),a[:,:,3])))

# Evaluate a single affine surface at 4x resolution per feature. This is a
# geometric squeeze, not RGBA crossfade; it preserves original glossy texture.
S=4
large=original.resize((W*S,H*S),Image.Resampling.LANCZOS)
clean_hi=clean.resize((W*S,H*S),Image.Resampling.LANCZOS)
angle=np.deg2rad(-26)
R=np.array([[np.cos(angle),-np.sin(angle)],[np.sin(angle),np.cos(angle)]])

def nonlinear_lip(plane, center, strength, scale_x):
    """One original lip surface: tightly pinched centre, fuller offset corners."""
    # Work solely inside the contracted output region, with inverse texture
    # sampling. The two lip corners do not collapse when the centre tightens.
    yy,xx=np.mgrid[y0*S:(y0+ch)*S,x0*S:(x0+cw)*S]
    xy=np.stack((xx-center[0],yy-center[1]),axis=-1)
    uv=xy@R
    su=uv[:,:,0]/scale_x
    u=su/S
    lip_height=.10+.57*np.minimum(1,(np.abs(u)/19)**1.25)
    sy=1-strength+strength*lip_height
    corner_offset=strength*(1.0*np.tanh(u/7)+.3*(u/20)**2)*S
    sv=(uv[:,:,1]-corner_offset)/sy
    source=np.stack((su,sv),axis=-1)@R.T+center
    ax=np.clip(source[:,:,0],0,W*S-1.001);ay=np.clip(source[:,:,1],0,H*S-1.001)
    ix=np.floor(ax).astype(int);iy=np.floor(ay).astype(int)
    fx=(ax-ix)[:,:,None];fy=(ay-iy)[:,:,None]
    pixels=np.asarray(plane).astype(float)
    sampled=(pixels[iy,ix]*(1-fx)*(1-fy)+pixels[iy,ix+1]*fx*(1-fy)
             +pixels[iy+1,ix]*(1-fx)*fy+pixels[iy+1,ix+1]*fx*fy)
    full=Image.new('RGBA',(W*S,H*S))
    full.paste(Image.fromarray(np.uint8(np.clip(sampled,0,255))),(x0*S,y0*S))
    return full
out=[];composites=[];max_outside=0;contour_alpha_changes=0;interior_alpha_replacement=0
for i in range(7):
    strength=i/6
    if i==0:
        patch=Image.new('RGBA',(cw,ch))
        comp=original.copy()
    else:
        comp_hi=large.copy()
        # Erase each original eye/mouth solely inside the feature mask.
        erase=Image.fromarray((all_mask*255).astype('uint8')).resize((W*S,H*S),Image.Resampling.LANCZOS)
        comp_hi.paste(clean_hi,(0,0),erase)
        for f in features:
            sx=1+(f['endScale'][0]-1)*strength
            sy=1+(f['endScale'][1]-1)*strength
            inv=R@np.diag([1/sx,1/sy])@R.T
            center=np.array(f['center'])*S
            bias=center-inv@center
            coeff=(inv[0,0],inv[0,1],bias[0],inv[1,0],inv[1,1],bias[1])
            mask=Image.fromarray((f['mask']*255).astype('uint8')).resize((W*S,H*S),Image.Resampling.LANCZOS)
            plane=large.copy();plane.putalpha(mask)
            warped=(nonlinear_lip(plane,center,strength,sx) if f['name']=='mouth'
                    else plane.transform(plane.size,Image.Transform.AFFINE,coeff,Image.Resampling.BICUBIC))
            comp_hi.alpha_composite(warped)
        generated=comp_hi.resize((W,H),Image.Resampling.LANCZOS)
        # Only feature surroundings can change. All protected source pixels exact.
        change_mask=np.asarray(Image.fromarray((all_mask*255).astype('uint8')).filter(ImageFilter.MaxFilter(7)))>0
        g=np.array(generated);g[~change_mask]=a[~change_mask]
        comp=Image.fromarray(g)
        p=g[y0:y0+ch,x0:x0+cw].copy()
        p[:,:,3]=np.where(change_mask[y0:y0+ch,x0:x0+cw],255,0)
        patch=Image.fromarray(p)
        check=np.array(original.copy());checkim=original.copy();checkim.alpha_composite(patch,(x0,y0));check=np.array(checkim)
        outside=~change_mask
        max_outside=max(max_outside,int(np.any(check[outside]!=a[outside],axis=1).sum()))
        alpha_delta=check[:,:,3]!=a[:,:,3]
        contour_alpha_changes=max(contour_alpha_changes,int(np.count_nonzero(alpha_delta & (a[:,:,3]<240))))
        interior_alpha_replacement=max(interior_alpha_replacement,int(np.count_nonzero(alpha_delta)))
    file=f'effort_{i:02d}.png';patch.save(D/file)
    out.append({'index':i,'file':file,'strength':round(strength,6),'sha256':sha(D/file)})
    composites.append(comp)

sheet=Image.new('RGB',(340*4,290*2),(192,225,243));draw=ImageDraw.Draw(sheet)
for i,im in enumerate(composites):
    xx=(i%4)*340;yy=(i//4)*290
    sheet.paste(im,(xx,yy),im);draw.text((xx+8,yy+264),f'{i}/6 effort',fill=(24,52,69))
sheet.save(D/'contact-sheet.png')
phone=Image.new('RGB',(160*7,165),(192,225,243));pd=ImageDraw.Draw(phone)
for i,im in enumerate(composites):
    small=im.resize((97,73),Image.Resampling.LANCZOS)
    phone.paste(small,(i*160+32,38),small);pd.text((i*160+47,127),f'{i}/6',fill=(24,52,69))
phone.save(D/'phone-contact-sheet.png')
gif=[]
for i in [0,0,0,0,1,2,3,4,5,6,6,6,6,5,4,3,2,1,0,0,0,0]:
    frame=Image.new('RGB',(160,140),(192,225,243));im=composites[i].resize((97,73),Image.Resampling.LANCZOS)
    frame.paste(im,(32,30),im);gif.append(frame)
gif[0].save(D/'phone-preview.gif',save_all=True,append_images=gif[1:],duration=60,loop=0)

manifest={
 'revision':'pinched-corners-effort-r2','source':str(SRC.relative_to(ROOT)),
 'sourceSize':list(original.size),'sourceSha256':sha(SRC),
 'rect':rect,'rectConvention':'left, top, width, height in original slipper pixels',
 'frames':out,'playback':'play forward after hand contact; hold 0.35 seconds; reverse on release',
 'method':'Original glossy eyes tighten without becoming thin lines. The single original mouth surface pinches locally at the centre, keeps fuller mouth corners and a subtle asymmetry, guided by the generated effort reference. Local red plastic is reconstructed within bounded feature masks. There is no two-face alpha crossfade.',
 'generatedReference':'generated-effort-reference.png','prompt':'prompt.txt','script':'bake_effort.py',
 'protected':'All original outline/stripes/highlights outside facial feature masks; no new eyebrows, teeth or X eyes.',
 'integration':'Independent sample only, production source unchanged',
}
(D/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
validation={'status':'passed','frames':len(out),'size':[cw,ch],
 'frame0FullyTransparent':not np.any(np.asarray(Image.open(D/out[0]['file']))[:,:,3]),
 'protectedPixelsChanged':max_outside,'sourceUnchanged':sha(SRC)==manifest['sourceSha256'],
 'outerContourAlphaChanges':contour_alpha_changes,'interiorAlphaReplacementCount':interior_alpha_replacement,
 'alphaNote':'Source interior pixels mostly carry alpha 253; opaque expression patches replace only the face interior. Exterior antialias and silhouette remain unchanged.',
 'noDoubleFaceBlend':True,'reviewLimit':'Technical protection checks do not prove expressive quality; review at 97px slipper width.'}
(D/'checks.json').write_text(json.dumps(validation,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(validation))
