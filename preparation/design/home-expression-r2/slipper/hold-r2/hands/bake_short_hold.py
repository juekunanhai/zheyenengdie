"""Short persistent duck-head hold; reuses approved generated pixels, no production writes."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np, json, hashlib
P=Path(__file__).resolve().parent
OLD=P.parents[1]/'hands'
base=Image.open(P.parents[1]/'reference-pair.png').convert('RGBA')
CROP=(350,250,630,590); W,H=280,340; FPS=24
LOOP_FROM=14/FPS; DURATION=38/FPS
yy,xx=np.mgrid[CROP[1]:CROP[3],CROP[0]:CROP[2]]; q=np.stack([xx,yy],axis=-1).reshape(-1,2)
source={name:np.array(Image.open(OLD/f'source-{name}.png').convert('RGBA')).astype(float) for name in ['far','near']}
chains={'far':np.array([[408,304],[422,326],[419,349],[422,379]],float),'near':np.array([[430,278],[463,346],[441,430],[435,464]],float)}
# Both palms sit on the duck's right head edge. No wrist/palm reaches the back or wing.
POSES={
 'hidden':{'far':[[412,294],[411,295],[398,283],[393,278]],'near':[[424,285],[413,282],[402,272],[397,266]]},
 'peek':{'far':[[416,303],[435,322],[433,342],[433,358]],'near':[[438,290],[465,324],[465,371],[453,393]]},
 'hold':{'far':[[416,303],[434,316],[428,334],[412,352]],'near':[[438,290],[469,322],[462,369],[435,395]]}}
def smooth(x):return x*x*(3-2*x)
def state(t,name):
 if t<LOOP_FROM:
  a,b=('hidden','peek') if t<.25 else ('peek','hold')
  u=t/.25 if t<.25 else (t-.25)/(LOOP_FROM-.25)
  v=smooth(np.clip(u,0,1));ch=np.array(POSES[a][name],float)*(1-v)+np.array(POSES[b][name],float)*v
  return ch,.78*max(0,(t-.40)/(LOOP_FROM-.40))
 phase=(t-LOOP_FROM)/(DURATION-LOOP_FROM)*np.pi*2
 ch=np.array(POSES['hold'][name],float)
 # Fixed root and fixed palm: tiny elbow/wrist tension, no translation or fade.
 amount=(1-np.cos(phase))*.5
 ch[1]+=[-.9*amount,-.65*amount]
 ch[2]+=[-.5*amount,-.4*amount]
 return ch,.78+.16*amount
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
# Keep all original duck facial features unpainted, including eyebrow and beak edge.
protected=(xx<=385)&(yy>=344)&(yy<=515)
frames=[];entries=[];(P/'frames').mkdir(exist_ok=True)
for i in range(39):
 t=i/FPS;im=Image.new('RGBA',(W,H));info={}
 for name in ['far','near']:
  ch,g=state(t,name);a=warp(name,ch,g);a[:,:,3]*=(~shoe)&(~protected)
  if i==0:a[:,:,3]=0
  im.alpha_composite(Image.fromarray(np.uint8(np.clip(a,0,255))))
  info[name]={'rootReferencePx':ch[0].tolist(),'palmReferencePx':ch[-1].tolist()}
 contact=np.clip((t-.44)/(.583333-.44),0,1)
 yellow=(b[:,:,0]>170)&(b[:,:,1]>95)&(b[:,:,2]<110)&(b[:,:,3]>0)
 shade=np.array(im.getchannel('A').filter(ImageFilter.GaussianBlur(3))).astype(float)
 shadow=np.zeros((H,W,4),dtype='uint8');shadow[:,:,:3]=[113,62,18];shadow[:,:,3]=np.uint8(np.roll(shade,3,axis=0)*yellow*.13*contact*(~protected)*(~shoe))
 behind=Image.fromarray(shadow);behind.alpha_composite(im);im=behind
 name=f'frames/frame_{i:03}.png';im.save(P/name);frames.append(im);entries.append({'index':i,'timeSeconds':round(t,6),'file':name,**info})
 print(i,flush=True)
select=[0,3,6,10,14,20,26,32,38]
sheet=Image.new('RGBA',(680*3,750*3),(183,222,244,255));d=ImageDraw.Draw(sheet)
for j,i in enumerate(select):
 comp=base.copy();comp.alpha_composite(frames[i],CROP[:2]);sheet.alpha_composite(comp,((j%3)*680,(j//3)*750));d.text(((j%3)*680+8,(j//3)*750+720),f'{i} / {i/FPS:.3f} seconds',fill='black')
 if i in [14,26,38]:
  comp.save(P/f'pair-frame-{i:03}.png');comp.resize((170,180),Image.Resampling.LANCZOS).save(P/f'phone-detail-{i:03}.png')
sheet.resize((1020,1125)).save(P/'contact-sheet.png')
gif=[]
for frame in frames[14:38]*5:
 comp=Image.new('RGBA',base.size,(183,222,244,255));comp.alpha_composite(base);comp.alpha_composite(frame,CROP[:2]);gif.append(comp.resize((340,360)).convert('RGB'))
gif[0].save(P/'hold-loop.gif',save_all=True,append_images=gif[1:],duration=42,loop=0,disposal=2)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
manifest={'status':'independent-motion-sample-not-production','revision':'slipper-short-head-hold-r2','fps':FPS,'durationSeconds':DURATION,'loopFrom':LOOP_FROM,'loopDurationSeconds':DURATION-LOOP_FROM,'frameCount':39,'frameSize':[W,H],'rectStage':[405,475,140,170],'referenceRectPx':list(CROP),'referenceScale':2,'contactSeconds':LOOP_FROM,'motion':'Short reach once, then fixed-palm persistent grip. Loop alters only elbow/wrist tension and finger tips; root and contact palms stay fixed. No retract frames, no translation/fade/crossfade. Original duck mouth, eyes and brows protected.','sourceSha256':sha(OLD/'generated-pair.png'),'sourceFiles':{'near':{'path':'../../hands/source-near.png','sha256':sha(OLD/'source-near.png')},'far':{'path':'../../hands/source-far.png','sha256':sha(OLD/'source-far.png')}},'prompt':'../../hands/prompt.txt','frames':entries}
(P/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
checks={'frameCount':len(frames),'equalDimensions':all(x.size==(W,H) for x in frames),'firstFrameTransparent':frames[0].getbbox() is None,'lastFrameStillHolding':frames[-1].getbbox() is not None,'loopFirstLastPixelEqual':np.array_equal(np.array(frames[14]),np.array(frames[38])),'loopPalmsFixed':all(entries[i][name]['palmReferencePx']==entries[14][name]['palmReferencePx'] for i in range(14,39) for name in ['near','far']),'sourceReferenceSha256':sha(P.parents[1]/'reference-pair.png'),'frameSha256':{e['file']:sha(P/e['file']) for e in entries}}
checks['originalShoeOcclusionTouchedPixels']=sum(int(np.count_nonzero(np.array(x)[:,:,3][shoe])) for x in frames)
checks['protectedDuckFaceTouchedPixels']=sum(int(np.count_nonzero(np.array(x)[:,:,3][protected])) for x in frames)
checks['status']='technical_checks_passed_visual_review_separate'
assert checks['originalShoeOcclusionTouchedPixels']==0
assert checks['protectedDuckFaceTouchedPixels']==0
assert checks['loopFirstLastPixelEqual'] and checks['loopPalmsFixed'] and checks['lastFrameStillHolding']
(P/'checks.json').write_text(json.dumps(checks,indent=2)+'\n')
