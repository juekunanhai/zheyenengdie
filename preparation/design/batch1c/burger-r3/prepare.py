"""R3: replace lower bread only; preserve upper R2 bread and other ingredients."""
from pathlib import Path
import sys, importlib.util, json
HERE=Path(__file__).resolve().parent; ROOT=HERE.parents[3]
sys.path.insert(0,str(Path.home()/'.cache/codex-art-tools'))
import cv2,numpy as np
from PIL import Image,ImageDraw
ms=importlib.util.spec_from_file_location('art',ROOT/'preparation/tools/prepare_batch1c_art.py')
art=importlib.util.module_from_spec(ms);ms.loader.exec_module(art)

def lower_bun_mask(im):
    a=np.asarray(im.convert('RGB')).astype(int)
    orange=((a[:,:,0]>a[:,:,1]+10)&(a[:,:,1]>a[:,:,2]+30)&(a[:,:,0]>a[:,:,2]+70)).astype(np.uint8)
    n,labels,stats,centers=cv2.connectedComponentsWithStats(orange)
    choices=[i for i in range(1,n) if centers[i][1]>im.height*.65]
    selected=max(choices,key=lambda i:stats[i,cv2.CC_STAT_AREA])
    contours,_=cv2.findContours((labels==selected).astype(np.uint8),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    mask=np.zeros(orange.shape,np.uint8);cv2.drawContours(mask,[max(contours,key=cv2.contourArea)],-1,255,-1)
    return Image.fromarray(cv2.dilate(mask,np.ones((3,3),np.uint8),iterations=1))

old=Image.open(HERE/'reference-burger-r2.png').convert('RGBA')
generated=Image.open(HERE/'generated-original.png');new,extraction=art.remove_background(generated,'burger')
om=lower_bun_mask(old);nm=lower_bun_mask(new);ob=om.getbbox();nb=nm.getbbox()
piece=new.copy();piece.putalpha(Image.fromarray(np.minimum(np.asarray(new.getchannel('A')),np.asarray(nm))));piece=piece.crop(nb)
scale=(ob[2]-ob[0])/piece.width;piece=piece.resize((ob[2]-ob[0],round(piece.height*scale)),Image.Resampling.LANCZOS)
offset=(ob[0],ob[1])
# The color component also touches cheese. Never erase that component wholesale:
# all actual lettuce/cheese pixels end above row 218 in this immutable reference.
# Keep through row 219 exactly, then join only the orange bread's lower strip.
preserved_rows=220;blend_end=228
lower=Image.new('RGBA',old.size);lower.alpha_composite(piece,offset)
oa=np.asarray(old).astype(float)/255;la=np.asarray(lower).astype(float)/255
result=np.asarray(old).copy()
for y in range(preserved_rows,old.height):
    w=min(1,(y-preserved_rows+1)/(blend_end-preserved_rows))
    alpha=oa[y,:,3]*(1-w)+la[y,:,3]*w
    premul=oa[y,:,:3]*oa[y,:,3:4]*(1-w)+la[y,:,:3]*la[y,:,3:4]*w
    rgb=np.divide(premul,alpha[:,None],out=np.zeros_like(premul),where=alpha[:,None]>0)
    result[y]=np.rint(np.column_stack((rgb,alpha))*255).astype(np.uint8)
composite=Image.fromarray(result)
composite.save(HERE/'composite-original-coordinates.png')
box=composite.getchannel('A').getbbox();trim=composite.crop(box);sprite=Image.new('RGBA',(trim.width+16,trim.height+16));sprite.alpha_composite(trim,(8,8));sprite.save(HERE/'object_burger.png')
nxt=Image.new('RGBA',sprite.size,(218,235,255));nxt.putalpha(sprite.getchannel('A'));nxt.save(HERE/'next_burger.png')
geo,poly,audit=art.points(sprite,130);geo['density_for_total_mass_3_2']=round(3.2*32*32/audit['area_world_squared'],12)
overlay=Image.new('RGBA',sprite.size,(215,231,243,255));overlay.alpha_composite(sprite);dr=ImageDraw.Draw(overlay);dr.line([tuple(p) for p in poly]+[tuple(poly[0])],fill=(235,25,120,255),width=1)
for x,y in poly:dr.ellipse((x-1,y-1,x+1,y+1),fill=(255,225,0,255))
overlay.convert('RGB').save(HERE/'geometry-overlay.png')
sheet=Image.new('RGB',(640,340),(215,231,243))
for i,im in enumerate([old,sprite]):
    show=im.copy();show.thumbnail((290,285));sheet.paste(show,(15+i*320+(290-show.width)//2,40+(285-show.height)//2),show)
dr=ImageDraw.Draw(sheet);dr.text((15,10),'R2 flat top / curved base',fill=(15,40,65));dr.text((335,10),'R3 flat lower bread only',fill=(15,40,65));sheet.save(HERE/'comparison.png')
segments={}
for name,y in [('top',max(y for x,y in geo['outline'])),('bottom',min(y for x,y in geo['outline']))]:
    segments[name]=[[a[0],b[0]] for a,b in zip(geo['outline'],geo['outline'][1:]+geo['outline'][:1]) if abs(a[1]-y)<1e-6 and abs(b[1]-y)<1e-6]
oa=np.asarray(old);ca=np.asarray(composite)
report={'status':'self_review_candidate_pending_root_engine_validation','slug':'burger',
    'sprite':'preparation/design/batch1c/burger-r3/object_burger.png','next':'preparation/design/batch1c/burger-r3/next_burger.png',
    'geometry':geo,'geometry_audit':audit,'flat_segments':segments,
    'composition':{'old_bun_bounds':ob,'generated_bun_bounds':nb,'new_bun_scale_uniform':scale,'new_bun_offset_old_coordinates':offset,
        'unchanged_above_original_row':preserved_rows,'all_upper_pixels_equal':bool(np.array_equal(oa[:preserved_rows],ca[:preserved_rows])),
        'bread_only_transition_rows':[preserved_rows,blend_end],
        'method':'preserve_all_upper_bread_and_ingredient_pixels; replace_orange_lower_bread_strip_with_premultiplied_alpha_transition'},
    'extraction':extraction,'preserved_runtime_parameters':{'mass':3.2,'friction':0.8,'restitution':0.01,'contactAngularDamping':6,'contactImpactSpeed':2.4,'adhesion':None},
    'hashes':{p.name:art.sha(p) for p in HERE.glob('*.png')},'script_sha256':art.sha(__file__)}
(HERE/'GEOMETRY.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:report[k] for k in ['geometry_audit','flat_segments','composition']},indent=2))
