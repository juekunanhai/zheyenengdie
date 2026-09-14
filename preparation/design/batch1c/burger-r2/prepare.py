"""Replace only R1 upper bread pixels with the generated flat upper bread.
The other original ingredients and lower support pixels remain unchanged.
"""
from pathlib import Path
import sys, importlib.util, json, hashlib
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
sys.path.insert(0,str(Path.home()/'.cache/codex-art-tools'))
import cv2, numpy as np
from PIL import Image,ImageDraw
module_spec=importlib.util.spec_from_file_location('art',ROOT/'preparation/tools/prepare_batch1c_art.py')
art=importlib.util.module_from_spec(module_spec);module_spec.loader.exec_module(art)

def bun_mask(im):
    a=np.asarray(im.convert('RGB')).astype(int)
    orange=((a[:,:,0]>a[:,:,1]+10)&(a[:,:,1]>a[:,:,2]+30)&(a[:,:,0]>a[:,:,2]+70)).astype(np.uint8)
    n,labels,stats,centers=cv2.connectedComponentsWithStats(orange)
    choices=[i for i in range(1,n) if centers[i][1]<im.height*.5]
    selected=max(choices,key=lambda i:stats[i,cv2.CC_STAT_AREA])
    contours,_=cv2.findContours((labels==selected).astype(np.uint8),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    mask=np.zeros(orange.shape,np.uint8);cv2.drawContours(mask,[max(contours,key=cv2.contourArea)],-1,255,-1)
    # Include original fine edge antialiasing but not any underlying ingredient.
    mask=cv2.dilate(mask,np.ones((3,3),np.uint8),iterations=1)
    return Image.fromarray(mask)

old=Image.open(HERE/'reference-burger-r1.png').convert('RGBA')
generated=Image.open(HERE/'generated-refined.png')
new,extraction=art.remove_background(generated,'burger')
old_mask=bun_mask(old);new_mask=bun_mask(new)
ob=old_mask.getbbox();nb=new_mask.getbbox()
piece=new.copy();piece.putalpha(Image.fromarray(np.minimum(np.asarray(new.getchannel('A')),np.asarray(new_mask))))
piece=piece.crop(nb);scale=(ob[2]-ob[0])/piece.width
piece=piece.resize((ob[2]-ob[0],round(piece.height*scale)),Image.Resampling.LANCZOS)
offset=(ob[0],ob[3]-piece.height)
base=np.asarray(old).copy();base[np.asarray(old_mask)>0,3]=0
composite=Image.fromarray(base);composite.alpha_composite(piece,offset)
# Retain old canvas coordinates in a separate file so unchanged-pixel proof is exact.
composite.save(HERE/'composite-original-coordinates.png')
bounds=composite.getchannel('A').getbbox();trimmed=composite.crop(bounds)
sprite=Image.new('RGBA',(trimmed.width+16,trimmed.height+16));sprite.alpha_composite(trimmed,(8,8))
sprite.save(HERE/'object_burger.png')
next_image=Image.new('RGBA',sprite.size,(218,235,255));next_image.putalpha(sprite.getchannel('A'));next_image.save(HERE/'next_burger.png')
geo,polygon,audit=art.points(sprite,130)
geo['density_for_total_mass_3_2']=round(3.2*32*32/audit['area_world_squared'],12)
overlay=Image.new('RGBA',sprite.size,(215,231,243,255));overlay.alpha_composite(sprite)
d=ImageDraw.Draw(overlay);d.line([tuple(p) for p in polygon]+[tuple(polygon[0])],fill=(235,25,120,255),width=1)
for x,y in polygon:d.ellipse((x-1,y-1,x+1,y+1),fill=(255,225,0,255))
overlay.convert('RGB').save(HERE/'geometry-overlay.png')
pair=Image.new('RGB',(640,340),(215,231,243))
for i,im in enumerate([old,sprite]):
    show=im.copy();show.thumbnail((290,285));pair.paste(show,(15+i*320+(290-show.width)//2,40+(285-show.height)//2),show)
draw=ImageDraw.Draw(pair);draw.text((15,10),'R1 unchanged base',fill=(15,40,65));draw.text((335,10),'R2 flat upper bread only',fill=(15,40,65));pair.save(HERE/'comparison.png')
old_a=np.asarray(old);new_a=np.asarray(composite)
unchanged_from=ob[3]
top=max(y for x,y in geo['outline']);xs=[]
for a,b in zip(geo['outline'],geo['outline'][1:]+geo['outline'][:1]):
    if abs(a[1]-top)<1e-6 and abs(b[1]-top)<1e-6:xs.append([a[0],b[0]])
report={'status':'self_review_candidate_pending_root_engine_validation','slug':'burger',
    'sprite':'preparation/design/batch1c/burger-r2/object_burger.png',
    'next':'preparation/design/batch1c/burger-r2/next_burger.png',
    'geometry':geo,'geometry_audit':audit,'top_flat_segments':xs,
    'composition':{'old_bun_bounds':ob,'generated_bun_bounds':nb,'new_bun_scale_uniform':scale,'new_bun_offset_old_coordinates':offset,
        'unchanged_below_original_row':unchanged_from,'all_lower_pixels_equal':bool(np.array_equal(old_a[unchanged_from:],new_a[unchanged_from:])),
        'method':'replace_only_old_upper_bread_component; all_other_pixels_retained'},
    'extraction':extraction,'preserved_runtime_parameters':{'mass':3.2,'friction':0.8,'restitution':0.01,'contactAngularDamping':6,'contactImpactSpeed':2.4,'adhesion':None},
    'hashes':{p.name:art.sha(p) for p in HERE.glob('*.png')},'script_sha256':art.sha(__file__)}
(HERE/'GEOMETRY.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:report[k] for k in ['geometry_audit','top_flat_segments','composition']},indent=2))
