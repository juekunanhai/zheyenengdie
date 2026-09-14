"""Local correction requested by user: preserve blue skin, antialias gloss.
Keeps previously approved P2 files immutable; no uploads or gameplay changes.
"""
from pathlib import Path
import json,hashlib
import numpy as np
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
source=Path(json.loads((ROOT/'art/EDGE_CANDIDATE_MANIFEST.json').read_text())['source_root'])/'02_ASSETS/result_ui/result_btn_share.png'
im=Image.open(source).convert('RGBA');b=np.array(im);fill=np.array(im)
c1=b[62,356,:3].astype(float);c2=b[112,356,:3].astype(float)
for y in range(25,126):fill[y,:,:3]=np.clip(c1+(c2-c1)*(y-62)/50,0,255)
mask=Image.new('L',im.size);ImageDraw.Draw(mask).rounded_rectangle((27,26,435,126),radius=28,fill=255)
inside=np.asarray(mask)>0;b[inside,:3]=fill[inside,:3]
base=Image.fromarray(b)
# Soft, continuous highlight, rendered at 4x then reduced; no hard 2px stair steps.
scale=4;gloss=Image.new('RGBA',(im.width*scale,im.height*scale));d=ImageDraw.Draw(gloss)
points=[]
for t in np.linspace(0,1,240):
 x=(1-t)**2*39+2*(1-t)*t*150+t*t*420
 y=(1-t)**2*50+2*(1-t)*t*9+t*t*49
 points.append((x*scale,y*scale))
d.line(points,fill=(228,250,255,150),width=5)
base.alpha_composite(gloss.resize(im.size,Image.Resampling.LANCZOS))
# Match P2 transparent padding and crop policy.
base=base.crop(base.getbbox());out=Image.new('RGBA',(base.width+32,base.height+32));out.alpha_composite(base,(16,16))
path=ROOT/'art/ui-corrections/btn_settings_base.png';path.parent.mkdir(parents=True,exist_ok=True);out.save(path)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
row={'id':'btn_settings_base','output':str(path.relative_to(ROOT)),'sha256':sha(path),'source':str(source),'source_sha256':sha(source),'method':'local antialiased subtle highlight; render as whole sprite, not 9-slice','status':'user_requested_correction_pending_visual_review','size':list(out.size)}
(ROOT/'art/UI_CORRECTION_MANIFEST.json').write_text(json.dumps({'revision':'2026-09-12-P3','script_sha256':sha(Path(__file__)),'entries':[row]},ensure_ascii=False,indent=2)+'\n')
# Update only this traceable static-validation copy; preserve all prior accepted candidates.
target=ROOT.parent/'assets/batch0/art/btn_settings_base.png';target.write_bytes(path.read_bytes())
p=ROOT/'art/BATCH0_IMPORT_MANIFEST.json';rows=json.loads(p.read_text())
for r in rows:
 if r['id']==row['id']:r.update(candidate=row['output'],sha256=row['sha256'],purpose='Batch 0 static validation; user requested gloss correction; visual review pending')
p.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
print(row)
