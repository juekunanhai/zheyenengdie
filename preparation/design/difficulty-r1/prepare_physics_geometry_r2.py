"""Eight-point single-fixture candidates. Frozen R1 art and geometry are inputs only."""
from pathlib import Path
import hashlib,json,math
import numpy as np
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parent
old=json.loads((R/'GEOMETRY.json').read_text())
# Preserve the four exact horizontal bearing endpoints and original extrema.
INDICES={'cardboard_box':[0,1,5,6,8,9,11,12], 'wood_plank':[0,1,4,5,8,9,12,13], 'fridge':[0,1,7,13,17,18,22,28]}
rows=[];checks=[]
for row in old['assets']:
 s=row['slug'];points=[row['source_outline_px'][i] for i in INDICES[s]];scale=row['pixel_to_world'];orig=row['source_outline_px'];cx=(min(p[0] for p in orig)+max(p[0] for p in orig))/2;cy=(min(p[1] for p in orig)+max(p[1] for p in orig))/2
 out=Image.open(row['sprite_path']).convert('RGBA');a=np.array(out.getchannel('A'))>=128
 world=[[round((x-cx)*scale,6),round((cy-y)*scale,6)] for x,y in points]
 area=sum(p[0]*q[1]-q[0]*p[1] for p,q in zip(world,world[1:]+world[:1]))/2
 if area<0:world.reverse()
 def cross(p,q,r):return (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])
 convex=all(cross(points[i-1],points[i],points[(i+1)%len(points)])>0 for i in range(len(points)))
 mask=Image.new('1',out.size);ImageDraw.Draw(mask).polygon([tuple(p) for p in points],fill=1);m=np.array(mask,dtype=bool)
 edge=a.copy();edge[1:-1,1:-1]&=~(a[:-2,1:-1]&a[2:,1:-1]&a[1:-1,:-2]&a[1:-1,2:]);ey,ex=np.where(edge);coords=np.column_stack([ex,ey]);mind=np.full(len(coords),np.inf)
 for p,q in zip(points,points[1:]+points[:1]):
  p=np.array(p,dtype=float);q=np.array(q,dtype=float);v=q-p;t=np.clip(((coords-p)*v).sum(axis=1)/(v*v).sum(),0,1);mind=np.minimum(mind,np.linalg.norm(coords-(p+t[:,None]*v),axis=1))
 maxerr=float(mind.max()*scale);accepted=maxerr<=1 and convex
 hidden=int((m&~a).sum());om=Image.new('1',out.size);ImageDraw.Draw(om).polygon([tuple(p) for p in orig],fill=1);original_mask=np.array(om,dtype=bool)
 check={'slug':s,'accepted_for_runtime_comparison':accepted,'vertices':len(points),'strictly_convex':convex,'extrema_unchanged':(min(p[0] for p in points)==min(p[0] for p in orig) and max(p[0] for p in points)==max(p[0] for p in orig) and min(p[1] for p in points)==min(p[1] for p in orig) and max(p[1] for p in points)==max(p[1] for p in orig)),'top_and_foot_endpoints_unchanged':all(p in points for d in row['measurements'].values() for p in d['pixel_segment']),'boundary_distance_world':{'max':round(maxerr,6),'p95':round(float(np.percentile(mind,95)*scale),6)},'outside_visible_alpha128_area_world_squared':round(hidden*scale*scale,6),'outside_visible_alpha128_percent':round(float(hidden/m.sum()*100),6),'added_area_vs_R1_polygon_world_squared':round(int((m&~original_mask).sum())*scale*scale,6),'lost_visible_area_world_squared':round(int((a&~m).sum())*scale*scale,6),'next_and_sprite_changed':False}
 new={k:row[k] for k in ['slug','kind','name','width','height','spriteWidth','spriteHeight','spriteOffset','sprite_path','next_path','measurements','pixel_to_world']}
 new.update({'status':'accepted_geometric_candidate_pending_engine_test' if accepted else 'rejected_error_exceeds_one_world_unit','outline':world,'outline_winding':'counter_clockwise','outline_area_world_squared':round(abs(area),6),'source_outline_px':points,'source_vertex_indices':INDICES[s],'notes':'Eight convex vertices retain original top/foot endpoints and full width/height. Not committed to runtime.'})
 rows.append(new);checks.append(check)
 bg=Image.new('RGBA',out.size,(218,235,247,255));bg.alpha_composite(out);d=ImageDraw.Draw(bg);d.line([tuple(p) for p in points]+[tuple(points[0])],fill=(229,38,58,255),width=3)
 for p in points:d.ellipse((p[0]-4,p[1]-4,p[0]+4,p[1]+4),fill=(229,38,58,255))
 for surface in row['measurements'].values():d.line([tuple(p) for p in surface['pixel_segment']],fill=(0,103,221,255),width=4)
 bg.save(R/f'{s}-physics-r2.png')
root={'version':'difficulty-r1-physics-geometry-r2','frozen_visual_geometry_sha256':hashlib.sha256((R/'GEOMETRY.json').read_bytes()).hexdigest(),'intent':'At most 8 strictly convex vertices so simple basic bodies avoid Cocos polygon fan decomposition; visual assets and size are unchanged. Fridge is rejected if visible error is too large.','assets':rows}
(R/'PHYSICS_GEOMETRY_R2.json').write_text(json.dumps(root,ensure_ascii=False,indent=2)+'\n');(R/'PHYSICS_GEOMETRY_R2_CHECK.json').write_text(json.dumps({'status':'partial_candidates_review_required','assets':checks},ensure_ascii=False,indent=2)+'\n');print(json.dumps(checks,ensure_ascii=False,indent=2))
