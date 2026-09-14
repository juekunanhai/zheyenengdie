"""Local, deterministic candidate cleanup and alpha-based geometry. No generated subject drawing."""
from pathlib import Path
from collections import deque
import hashlib,json,math
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
ROOT=Path(__file__).resolve().parent
# Source pixel vertices selected on alpha >= 128. Flat edges vary only 1-2 source
# pixels; corner curvature and the fridge's small plinth recess are retained.
SPECS={
 'cardboard_box':{'name':'纸箱','size_axis':'height','size':100,'points':[[256,143],[1020,143],[1031,147],[1049,162],[1116,232],[1124,243],[1124,1099],[1116,1110],[1094,1129],[159,1129],[138,1110],[129,1099],[129,243],[138,232],[208,172],[234,154],[245,147]],'surfaces':{'top':[[256,143],[1020,143]],'foot':[[159,1129],[1094,1129]]}},
 'fridge':{'name':'冰箱','size_axis':'width','size':110,'points':[[209,174],[876,174],[906,178],[936,193],[970,223],[985,248],[992,273],[996,314],[996,1124],[993,1149],[986,1174],[990,1188],[992,1199],[992,1244],[988,1262],[979,1269],[960,1273],[930,1274],[139,1274],[123,1273],[106,1269],[98,1262],[93,1244],[93,1199],[96,1188],[100,1174],[93,1149],[91,1124],[90,314],[93,273],[100,248],[116,223],[149,193],[179,178]],'surfaces':{'top':[[209,174],[876,174]],'foot':[[139,1274],[930,1274]]}},
 'wood_plank':{'name':'木板','size_axis':'width','size':260,'points':[[50,559],[1203,559],[1210,563],[1224,578],[1228,586],[1228,672],[1224,678],[1217,685],[1205,692],[48,692],[37,685],[29,678],[25,672],[25,586],[29,578],[44,563]],'surfaces':{'top':[[50,559],[1203,559]],'foot':[[48,692],[1205,692]]}}
}
def hashfile(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main_component(mask):
 # All three strong-alpha silhouettes are solid. Flood from a guaranteed interior
 # pixel; this removes tiny disconnected generator fringe, never repairs a shape.
 ys,xs=np.where(mask); seed=(int(ys[len(ys)//2]),int(xs[len(xs)//2]));h,w=mask.shape
 seen=np.zeros_like(mask);q=deque([seed]);seen[seed]=1
 while q:
  y,x=q.popleft()
  for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
   yy,xx=y+dy,x+dx
   if 0<=yy<h and 0<=xx<w and mask[yy,xx] and not seen[yy,xx]:seen[yy,xx]=1;q.append((yy,xx))
 return seen
rows=[];checks=[];audit=[]
for slug,spec in SPECS.items():
 raw=ROOT/'generated'/f'{slug}.png';im=Image.open(raw).convert('RGBA');arr=np.array(im);original_alpha=arr[:,:,3].copy();strong=original_alpha>=128
 main=main_component(strong)
 keep=np.array(Image.fromarray(main.astype('uint8')*255).filter(ImageFilter.MaxFilter(5)))>0
 arr[:,:,3]=np.where(keep,original_alpha,0)
 # No RGB subject edits and no alpha increase; only disconnected exterior cleanup.
 cleaned=Image.fromarray(arr);b=cleaned.getbbox();pad=6;box=(max(0,b[0]-pad),max(0,b[1]-pad),min(im.width,b[2]+pad),min(im.height,b[3]+pad));out=cleaned.crop(box)
 op=ROOT/'assets'/f'object_{slug}.png';out.save(op)
 nxt=Image.new('RGBA',out.size,(218,235,255,0));nxt.putalpha(out.getchannel('A'));npth=ROOT/'assets'/f'next_{slug}.png';nxt.save(npth)
 pts=[[x-box[0],y-box[1]] for x,y in spec['points']];xs=[p[0] for p in pts];ys=[p[1] for p in pts];cx=(min(xs)+max(xs))/2;cy=(min(ys)+max(ys))/2
 scale=spec['size']/((max(xs)-min(xs)) if spec['size_axis']=='width' else (max(ys)-min(ys)))
 world=[[round((x-cx)*scale,6),round((cy-y)*scale,6)] for x,y in pts]
 signed_area=sum(p[0]*q[1]-q[0]*p[1] for p,q in zip(world,world[1:]+world[:1]))/2
 if signed_area<0:world.reverse()
 surfaces={k:{'pixel_segment':[[p[0]-box[0],p[1]-box[1]] for p in v],'width_world':round((v[1][0]-v[0][0])*scale,6),'y_world':round((cy-(v[0][1]-box[1]))*scale,6)} for k,v in spec['surfaces'].items()}
 row={'slug':slug,'kind':slug,'name':spec['name'],'status':'self_checked_candidate_pending_runtime_balance','width':round((max(xs)-min(xs))*scale,6),'height':round((max(ys)-min(ys))*scale,6),'spriteWidth':round(out.width*scale,6),'spriteHeight':round(out.height*scale,6),'spriteOffset':[round((out.width/2-cx)*scale,6),round((cy-out.height/2)*scale,6)],'outline':world,'outline_winding':'counter_clockwise','outline_area_world_squared':round(abs(signed_area),6),'source_outline_px':pts,'raw_source_outline_px':spec['points'],'pixel_to_world':scale,'sprite_path':str(op),'next_path':str(npth),'measurements':surfaces,'size_selection':f"Uniform source-pixel scale; selected {spec['size_axis']} {spec['size']} world units; no horizontal stretching."}
 rows.append(row)
 a=np.array(out.getchannel('A'))>=128;mask=Image.new('1',out.size);ImageDraw.Draw(mask).polygon([tuple(p) for p in pts],fill=1);m=np.array(mask,dtype=bool)
 edge=a.copy();edge[1:-1,1:-1]&=~(a[:-2,1:-1]&a[2:,1:-1]&a[1:-1,:-2]&a[1:-1,2:]);ey,ex=np.where(edge);coords=np.column_stack([ex,ey]);mind=np.full(len(coords),np.inf)
 for p,q in zip(pts,pts[1:]+pts[:1]):
  p=np.array(p,dtype=float);q=np.array(q,dtype=float);v=q-p;t=np.clip(((coords-p)*v).sum(axis=1)/(v*v).sum(),0,1);mind=np.minimum(mind,np.linalg.norm(coords-(p+t[:,None]*v),axis=1))
 def cross(p,q,r):return (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])
 n=len(pts);hits=[]
 for i in range(n):
  for j in range(i+1,n):
   if j in [i,(i+1)%n] or (j+1)%n==i:continue
   p,q=pts[i],pts[(i+1)%n];r,s=pts[j],pts[(j+1)%n]
   if cross(p,q,r)*cross(p,q,s)<0 and cross(r,s,p)*cross(r,s,q)<0:hits.append([i,j])
 report={'slug':slug,'simple_polygon':not hits,'self_intersections':hits,'vertices':n,'polygon_outside_alpha128_percent':round(float((m&~a).sum()/m.sum()*100),6),'alpha_outside_polygon_percent':round(float((a&~m).sum()/a.sum()*100),6),'boundary_distance_world':{'max':round(float(mind.max()*scale),6),'p95':round(float(np.percentile(mind,95)*scale),6)},'next_alpha_identical':np.array_equal(np.array(nxt)[:,:,3],np.array(out)[:,:,3]),'measurements':surfaces,'validation_boundary':'Geometry and raster checks only; engine balance must be verified separately.'}
 checks.append(report)
 bg=Image.new('RGBA',out.size,(218,235,247,255));bg.alpha_composite(out);d=ImageDraw.Draw(bg);d.line([tuple(p) for p in pts]+[tuple(pts[0])],fill=(229,38,58,255),width=3)
 for p in pts:d.ellipse((p[0]-3,p[1]-3,p[0]+3,p[1]+3),fill=(229,38,58,255))
 for surface in surfaces.values():d.line([tuple(p) for p in surface['pixel_segment']],fill=(0,103,221,255),width=4)
 bg.save(ROOT/f'{slug}-geometry.png')
 audit.append({'slug':slug,'generated':str(raw),'generated_sha256':hashfile(raw),'input_size':im.size,'crop_box':box,'output_size':out.size,'removed_nonzero_alpha_pixels':int(((original_alpha>0)&~keep).sum()),'strong_alpha_removed_pixels':int((strong&~main).sum()),'alpha_increased_pixels':int((arr[:,:,3]>original_alpha).sum()),'rgb_changed_pixels':0,'output':str(op),'output_sha256':hashfile(op),'next_sha256':hashfile(npth),'operations':['Keep connected strong-alpha subject plus original two-pixel antialias fringe','Remove disconnected exterior alpha pixels','Crop with six-pixel transparent margin','Make NEXT from identical final alpha; no body repainting or resizing']})
(ROOT/'GEOMETRY.json').write_text(json.dumps({'version':'difficulty-r1','coordinate_system':'x-right y-up; collider bounds center at local origin; world units','assets':rows},ensure_ascii=False,indent=2)+'\n')
(ROOT/'GEOMETRY_CHECK.json').write_text(json.dumps({'status':'passed_geometry_only' if all(c['simple_polygon'] and c['next_alpha_identical'] and c['boundary_distance_world']['max']<1 for c in checks) else 'needs_review','assets':checks},ensure_ascii=False,indent=2)+'\n')
(ROOT/'PROCESSING_AUDIT.json').write_text(json.dumps({'mode':'authorized_local_alpha_cleanup_only','assets':audit},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'assets':[{k:r[k] for k in ['slug','width','height','spriteWidth','spriteHeight','spriteOffset','measurements']} for r in rows],'checks':checks},ensure_ascii=False,indent=2))
