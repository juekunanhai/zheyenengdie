from pathlib import Path
import json,hashlib
import numpy as np
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parent
calls=[('fridge-first','/Users/admin/.codex/generated_images/01a09a46-f889-7fa1-a3f0-03f63ff9df3b/exec-49c0fcb4-8152-4c4f-bf02-bcf13b311c0b.png',False,'Eight-sided physical silhouette succeeded, but 110 width maps to 147.33 height; rejected in favor of a shorter wider candidate.'),('fridge','/Users/admin/.codex/generated_images/01a09a46-f889-7fa1-a3f0-03f63ff9df3b/exec-d2a8e094-fc3c-4479-85c2-71fd4e3f2491.png',True,'Eight visible straight exterior sides; playful enamel inside simple physical shell. Uniform scale gives 110 x 122.873563; no anisotropic stretching.')]
source={'version':'difficulty-r1-fridge-r2-frozen','date':'2026-09-13','tool':'built-in image_gen.imagegen','mode':'pure text; one asset per call','submitted_images':[],'local_files_uploaded':False,'purpose':'Replace rounded many-vertex fridge with an actual eight-sided body, avoiding Cocos fan decomposition without invisible collision geometry. Original R1 art remains frozen.','calls':[]}
for slug,original,selected,reason in calls:
 p=R/'generated'/f'{slug}.png';prompt=R/'prompts'/f'{slug}.txt';source['calls'].append({'id':slug,'selected':selected,'reason':reason,'original_tool_path':original,'saved_path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'prompt_file':str(prompt),'prompt':prompt.read_text()})
g=json.loads((R/'GEOMETRY.json').read_text())['assets'][0];pts=g['source_outline_px'];world=g['outline'];cross=lambda p,q,r:(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);convex=all(cross(pts[i-1],pts[i],pts[(i+1)%8])>0 for i in range(8))
im=Image.open(g['sprite_path']);a=np.array(im)[:,:,3]>=128;mask=Image.new('1',im.size);ImageDraw.Draw(mask).polygon([tuple(p) for p in pts],fill=1);m=np.array(mask,dtype=bool);s=g['pixel_to_world']
phys={'strictly_convex':convex,'vertices':8,'single_convex_fixture_eligible':convex,'expected_fixture_count':1,'actual_engine_fixture_count':'pending_engine_import','outside_alpha128_area_world_squared':round(float((m&~a).sum()*s*s),6),'outside_alpha128_percentage':round(float((m&~a).sum()/m.sum()*100),6),'outline_area_world_squared':g['outline_area_world_squared'],'uniform_pixel_to_world':s,'width':g['width'],'height':g['height'],'note':'Preserve this geometry mass target by recalculating density from 13165.444595 square-world-units polygon area. Sprite dimensions are texture mapping, never body dimensions.'}
(R/'PHYSICS_CHECK.json').write_text(json.dumps(phys,ensure_ascii=False,indent=2)+'\n')
source['frozen_files']={str(p.relative_to(R)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [R/'GEOMETRY.json',R/'GEOMETRY_CHECK.json',R/'PHYSICS_CHECK.json',R/'PROCESSING_AUDIT.json',*sorted((R/'assets').glob('*.png'))]};(R/'SOURCE.json').write_text(json.dumps(source,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'physics':phys,'geometry_sha256':source['frozen_files']['GEOMETRY.json']},ensure_ascii=False))
