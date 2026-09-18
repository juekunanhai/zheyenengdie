"""Bake an isolated, body-occluded toy hand performance; never writes runtime assets."""
from pathlib import Path
from PIL import Image, ImageFilter, ImageDraw
import json, math, shutil, hashlib
import numpy as np
ROOT=Path(__file__).resolve().parents[4]
OUT=Path(__file__).resolve().parent
RAW=Path('/Users/admin/.codex/generated_images/01a0a324-4ccc-7162-ab9c-7ddc3e82a79e')
SOURCES={'grip':'exec-94dc329a-6e69-4369-970c-03cfc58617ed.png','open':'exec-c7658fa8-2bad-48c9-bea2-7e57d0b52d9b.png','half':'exec-1299260f-5a88-4661-8bc7-8e83dfe9d905.png'}
CROP=(150,680,480,1056); W,H=CROP[2]-CROP[0],CROP[3]-CROP[1]
FPS=24; SCALE=.22
CHAIN=np.array([[1030,145],[965,330],[845,502],[704,640],[634,786]],float)
WIDTHS=[60,75,86,78,90]
ROOT_POINT=np.array([418,731.],float)
# All joints are baking controls only; runtime receives ordinary PNG frames.
POSES={
 'hidden':([[418,731],[442,749],[465,762],[483,787],[490,810]],-24),
 'peek':([[418,731],[422,757],[423,779],[407,791],[393,811]],-17),
 'reach':([[418,731],[405,769],[380,810],[347,841],[324,859]],-8),
 'touch':([[418,731],[400,774],[363,815],[316,866],[290,904]],0),
 'grip':([[418,731],[400,774],[363,815],[316,868],[290,910]],0),
 'return':([[418,731],[424,752],[430,770],[415,786],[402,806]],-27),
}
KEYS=[(0,'hidden',0),(.12,'hidden',0),(.30,'peek',0),(.56,'reach',0),(.80,'touch',0),(.98,'grip',.5),(1.10,'grip',1),(1.28,'grip',1),(1.40,'touch',0),(1.62,'return',0),(1.88,'hidden',0),(2.,'hidden',0)]
hero=Image.open(ROOT/'assets/batch0/art/home_r9_hero.png').convert('RGBA')
hero_crop=np.array(hero.crop(CROP)).astype(float)
yy_body,xx_body=np.mgrid[CROP[1]:CROP[3],CROP[0]:CROP[2]]
left_body=np.interp(yy_body,[680,715,757,798,826,849,866,879,897,916,936,951,980,1056],[345,392,385,414,414,405,389,389,395,428,464,483,540,650])
body_mask=((yy_body<850)|(xx_body>=left_body)).astype(float)*np.clip((hero_crop[:,:,3]-1)/160,0,1)
blue_mask=(hero_crop[:,:,2]>hero_crop[:,:,0]*1.35)&(hero_crop[:,:,2]>hero_crop[:,:,1]*1.1)&(hero_crop[:,:,3]>240)
yy,xx=np.mgrid[0:H,0:W]; absolute=np.stack([xx+CROP[0],yy+CROP[1]],axis=-1).reshape(-1,2).astype(float)

def read_source(name):
 path=OUT/f'generated_{name}.png'
 if not path.exists():shutil.copy2(RAW/SOURCES[name],path)
 src=Image.open(path).convert('RGB');rgb=np.array(src).astype(float)
 matte=(rgb[:,:,0]>rgb[:,:,1]*.78)&(rgb[:,:,2]>rgb[:,:,1]*.68)&(rgb[:,:,0]>100)
 mask=Image.fromarray(matte.astype('uint8')*255).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
 # Keep enclosed green gaps between curled fingers transparent; do not flood-fill them.
 mask=mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(.45))
 rgba=np.dstack([rgb,np.array(mask)]).astype(float)
 edge=rgba[:,:,3]<245;rgba[:,:,1][edge]=np.minimum(rgba[:,:,1][edge],rgba[:,:,0][edge])
 # Preserve modeled shading while removing skin-like yellow from the arm only.
 warm=np.clip((780-np.arange(rgba.shape[0]))/80,0,1)[:,None]
 rgba[:,:,1]+=(rgba[:,:,0]-rgba[:,:,1])*.6*warm
 rgba[:,:,2]+=(rgba[:,:,0]-rgba[:,:,2])*.78*warm
 Image.fromarray(np.uint8(rgba)).save(OUT/f'source_{name}.png')
 return rgba
sources={key:read_source(key) for key in SOURCES}

def smooth(v):return v*v*(3-2*v)

def state(time):
 i=next((i for i in range(len(KEYS)-1) if KEYS[i+1][0]>=time),len(KEYS)-2)
 a,b=KEYS[i],KEYS[i+1];v=smooth(np.clip((time-a[0])/(b[0]-a[0]),0,1))
 pa,aa=POSES[a[1]];pb,ab=POSES[b[1]]
 return np.array(pa)*(1-v)+np.array(pb)*v,aa*(1-v)+ab*v,a[2]*(1-v)+b[2]*v,a[1]+'-'+b[1]

def normal(chain,i):
 tangent=chain[min(i+1,len(chain)-1)]-chain[max(0,i-1)]
 tangent/=max(np.linalg.norm(tangent),.001)
 return np.array([-tangent[1],tangent[0]])

def controls(target,angle,grip):
 src=[];dst=[]
 for i,(s,d,w) in enumerate(zip(CHAIN,target,WIDTHS)):
  ns,nd=normal(CHAIN,i),normal(target,i)
  for k in [-1,0,1]:src.append(s+ns*w*k);dst.append(d+nd*w*k*SCALE)
 a=math.radians(angle);rot=np.array([[math.cos(a),-math.sin(a)],[math.sin(a),math.cos(a)]])
 # Rigid palm/wrist registration prevents a squeezed wrist when fingers curl.
 for s in [[260,805],[915,805],[240,1190],[920,1190],[450,930],[760,940]]:
  src.append(s);dst.append(target[-1]+rot@(np.array(s)-CHAIN[-1])*SCALE)
 # One opaque hand surface is bent through each intermediate pose, never faded
 # between different outlines. Knuckles stay fixed; distal fingers lightly curl.
 for s,delta in [([352,935],[0,0]),([560,932],[0,0]),([702,934],[0,0]),
                 ([353,983],[9,-1]),([353,1045],[26,-17]),
                 ([499,992],[3,-2]),([498,1085],[8,-18]),
                 ([642,992],[-2,-1]),([642,1084],[-6,-11]),
                 ([735,923],[0,0]),([790,952],[-28,-7]),([831,974],[-49,-13])]:
  src.append(s);dst.append(target[-1]+rot@(np.array(s)+np.array(delta)*grip-CHAIN[-1])*SCALE)
 return np.array(src),np.array(dst)

def kernel(a,b):
 r2=((a[:,None,:]-b[None,:,:])**2).sum(axis=2)
 return r2*np.log(r2+1e-12)

def inverse_map(src,dst):
 d=dst/400;s=src/1254;n=len(d);p=np.c_[np.ones(n),d]
 matrix=np.block([[kernel(d,d)+np.eye(n)*1e-8,p],[p.T,np.zeros((3,3))]])
 coeff=np.linalg.solve(matrix,np.vstack([s,np.zeros((3,2))]))
 q=absolute/400
 return (np.c_[kernel(q,d),np.ones(len(q)),q]@coeff*1254).reshape(H,W,2)

def sample(im,coords):
 x,y=coords[:,:,0],coords[:,:,1];x0=np.floor(x).astype(int);y0=np.floor(y).astype(int)
 fx=x-x0;fy=y-y0;x0=np.clip(x0,0,im.shape[1]-2);y0=np.clip(y0,0,im.shape[0]-2)
 return im[y0,x0]*(1-fx[:,:,None])*(1-fy[:,:,None])+im[y0,x0+1]*fx[:,:,None]*(1-fy[:,:,None])+im[y0+1,x0]*(1-fx[:,:,None])*fy[:,:,None]+im[y0+1,x0+1]*fx[:,:,None]*fy[:,:,None]

def frame(time):
 target,angle,grip,phase=state(time);src,dst=controls(target,angle,grip);mapping=inverse_map(src,dst)
 out=sample(sources['open'],mapping)
 # Root, upper arm and retreat are genuinely occluded by the unchanged toilet.
 out[:,:,3]*=1-body_mask
 # The far thumb lies behind the front lip; near fingers stay above the lip.
 thumb=(mapping[:,:,0]>803)&(mapping[:,:,1]>975)
 lip=937+(absolute[:,0].reshape(H,W)-270)*.15
 behind=thumb & (absolute[:,1].reshape(H,W)>lip)
 out[:,:,3][behind]=0
 # Small contact shadow derives from the hand alpha, projected onto the actual blue rim.
 contact=np.clip((time-.70)/.15,0,1)*np.clip((1.50-time)/.12,0,1)
 shadow=Image.fromarray(np.uint8(np.clip(out[:,:,3],0,255))).filter(ImageFilter.GaussianBlur(3))
 sh=np.array(shadow).astype(float)*blue_mask*.08*contact
 sh[:max(0,920-CROP[1])]=0
 layer=np.zeros((H,W,4));layer[:,:,0:3]=[17,46,73];layer[:,:,3]=np.roll(sh,2,axis=0)
 base=Image.fromarray(np.uint8(np.clip(layer,0,255)));base.alpha_composite(Image.fromarray(np.uint8(np.clip(out,0,255))))
 return base,{'timeSeconds':round(time,5),'phase':phase,'wristHeroPx':target[-1].round(3).tolist(),'elbowHeroPx':target[2].round(3).tolist(),'grip':round(float(grip),4),'rootHeroPx':ROOT_POINT.tolist()}

frames=[];data=[];(OUT/'frames').mkdir(exist_ok=True)
for i in range(49):
 im,info=frame(i/FPS);name=f'frame_{i:03}.png';im.save(OUT/'frames'/name);frames.append(im);info.update(index=i,file='frames/'+name);data.append(info)
 print(i,flush=True)
# One preview image each for source-level and phone-scale review, using exact original base.
select=[0,5,8,12,17,20,24,27,31,34,38,42,46,48]
sheet=Image.new('RGBA',(330*7,400*2),(99,146,170,255));draw=ImageDraw.Draw(sheet)
for at,i in enumerate(select):
 base=Image.new('RGBA',(W,H),(99,146,170,255));base.alpha_composite(hero.crop(CROP));base.alpha_composite(frames[i]);x=(at%7)*330;y=(at//7)*400;sheet.alpha_composite(base,(x,y));draw.text((x+5,y+380),f'{i}  {i/FPS:.2f}s',fill='white')
sheet.save(OUT/'contact_sheet.png')
composites=[]
for i in [8,20,27,38]:
 comp=hero.copy();comp.alpha_composite(frames[i],CROP[:2]);comp.save(OUT/f'hero_frame_{i:03}.png');phone=comp.resize((375,563),Image.Resampling.LANCZOS);phone.save(OUT/f'phone_frame_{i:03}.png');composites.append(comp.resize((500,750)))
preview=[]
for im in frames:
 bg=Image.new('RGBA',hero.size,(112,165,194,255));bg.alpha_composite(hero);bg.alpha_composite(im,CROP[:2]);preview.append(bg.resize((512,768),Image.Resampling.LANCZOS).convert('RGB'))
preview[0].save(OUT/'hand_preview.gif',save_all=True,append_images=preview[1:],duration=round(1000/FPS),loop=0,disposal=2)
# Atlas is for a review player only, never a runtime asset.
atlas=Image.new('RGBA',(330*7,376*7));
for i,im in enumerate(frames):atlas.alpha_composite(im,((i%7)*330,(i//7)*376));data[i]['atlasRect']=[(i%7)*330,(i//7)*376,330,376]
atlas.save(OUT/'hand_atlas.png')
manifest={'status':'independent-motion-sample-not-production','revision':'single-surface-finger-warp-r2','fps':FPS,'durationSeconds':2,'frameCount':49,'heroSize':[1024,1536],'cropHeroPx':list(CROP),'frameSize':[W,H],'atlas':{'file':'hand_atlas.png','columns':7,'rows':7},'sourceHeroSha256':hashlib.sha256((ROOT/'assets/batch0/art/home_r9_hero.png').read_bytes()).hexdigest(),'rootHeroPx':ROOT_POINT.tolist(),'contact':{'palmHeroPx':[275,942],'frontFingertipsHeroPx':[270,979],'farThumbOccludedByOriginalBlueFrontLip':True},'occlusion':'Each RGBA frame already removes every pixel behind the original white toilet. Composite over unchanged hero at crop top-left. Hidden frames have no fade; movement enters original body occlusion.','motion':'Offline inverse TPS changes elbow/forearm curve and curls distal finger joints. Every pixel comes from one registered open master; half/grip generated poses are shape references only. No RGBA pose mixing, root rotation or whole-character movement.','frames':data}
manifest['sources']={name:{'generatedFile':f'generated_{name}.png','generatedSha256':hashlib.sha256((OUT/f'generated_{name}.png').read_bytes()).hexdigest(),'registeredFile':f'source_{name}.png','usedAs':'pixel master' if name=='open' else 'shape reference'} for name in SOURCES}
manifest['prompts']='prompts.json'
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
