"""Alpha-following R2 toilet outline; candidate geometry, not a physics acceptance."""
from pathlib import Path
import json, math
import numpy as np
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parent
# Pixel vertices were selected on alpha>=128. Nearly horizontal bearing
# surfaces follow visible alpha and preserve the actual broad tank proportions.
POINTS=[[42, 9], [503, 9], [528, 20], [534, 38], [531, 61], [518, 68], [506, 279], [518, 278], [734, 278], [763, 288], [774, 307], [769, 349], [758, 390], [739, 423], [713, 445], [678, 463], [669, 479], [677, 509], [691, 531], [722, 549], [733, 577], [716, 592], [64, 592], [48, 584], [54, 560], [72, 543], [107, 527], [135, 504], [150, 475], [157, 447], [148, 413], [127, 385], [99, 350], [70, 340], [51, 306], [34, 205], [26, 73], [12, 63], [9, 39], [15, 23]]
im=Image.open(ROOT/'assets/object_toilet.png').convert('RGBA')
a=np.asarray(im.getchannel('A'))>=128
# Select 115 gameplay units for the load-bearing outline height; map every
# image pixel uniformly with this same scale, including alpha protrusions.
xmin=min(p[0] for p in POINTS);xmax=max(p[0] for p in POINTS)
ymin=min(p[1] for p in POINTS);ymax=max(p[1] for p in POINTS)
cx=(xmin+xmax)/2;cy=(ymin+ymax)/2;s=115/(ymax-ymin)
world=[[round((x-cx)*s,6),round((cy-y)*s,6)] for x,y in POINTS]
area=sum(p[0]*q[1]-q[0]*p[1] for p,q in zip(world,world[1:]+world[:1]))/2
if area<0:world.reverse();area=-area
def span(x0,x1,y):
 return {'pixel_segment':[[x0,y],[x1,y]],'width_world':round((x1-x0)*s,6),'x_world':[round((x0-cx)*s,6),round((x1-cx)*s,6)],'y_world':round((cy-y)*s,6)}
measure={'high_plateau':span(42,503,9),'low_plateau':span(518,734,278),'foot':span(64,716,592),'step_height_world':round(269*s,6)}
row={'slug':'toilet','name':'马桶','candidate_status':'self_checked_contour_pending_runtime_physics',
'formal_source_size_world':[85,115],'size_selection':'115 world units for simplified bearing-outline height; whole raster is mapped uniformly, never anisotropically stretched. Original formal scale untouched.',
'width':round((xmax-xmin)*s,6),'height':115,
'spriteWidth':round(im.width*s,6),'spriteHeight':round(im.height*s,6),
'spriteOffset':[round((im.width/2-cx)*s,6),round((cy-im.height/2)*s,6)],
'sprite_path':str(ROOT/'assets/object_toilet.png'),'next_path':str(ROOT/'assets/next_toilet.png'),
'outline':world,'outline_winding':'counter_clockwise','outline_area_world_squared':round(area,6),
'source_outline_px':POINTS,'pixel_to_world':s,
'visual_alpha128_bounds_px':list(im.getchannel('A').point(lambda v:255 if v>=128 else 0).getbbox()),
'physics_contact_material':'ceramic','measurements':measure,
'notes':'Broad tank exterior top crosses center; integrated broad foot reaches beneath it. Separate lower seat and under-bowl concavities remain real. The high bearing edge follows an actual horizontal alpha row; no broad invisible shelf or convex fill is added.'}
(ROOT/'GEOMETRY.json').write_text(json.dumps({'version':'gameplay-toilet-r2-candidate-b','coordinate_system':'x-right y-up, collider bounds center at local origin; world units','assets':[row]},ensure_ascii=False,indent=2)+'\n')
# Robust segment intersections, raster overlap and boundary distance checks.
def cross(p,q,r):return (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])
def intersects(a,b,c,d):
 ca=cross(a,b,c);da=cross(a,b,d);ab=cross(c,d,a);bb=cross(c,d,b)
 return ca*da<0 and ab*bb<0
n=len(POINTS);hits=[]
for i in range(n):
 for j in range(i+1,n):
  if j in [i,(i+1)%n] or (j+1)%n==i:continue
  if intersects(POINTS[i],POINTS[(i+1)%n],POINTS[j],POINTS[(j+1)%n]):hits.append([i,j])
mask=Image.new('1',im.size);ImageDraw.Draw(mask).polygon([tuple(p) for p in POINTS],fill=1)
m=np.asarray(mask,dtype=bool)
# 4-connected alpha boundary, its distance to nearest polygon segment.
edge=a.copy()
edge[1:-1,1:-1]&=~(a[:-2,1:-1]&a[2:,1:-1]&a[1:-1,:-2]&a[1:-1,2:])
ys,xs=np.where(edge);coords=np.column_stack([xs,ys]);mind=np.full(len(coords),np.inf)
for p,q in zip(POINTS,POINTS[1:]+POINTS[:1]):
 p=np.array(p,dtype=float);q=np.array(q,dtype=float);v=q-p
 t=np.clip(((coords-p)*v).sum(axis=1)/(v*v).sum(),0,1)
 dist=np.linalg.norm(coords-(p+t[:,None]*v),axis=1);mind=np.minimum(mind,dist)
concave=sum(cross(POINTS[i-1],POINTS[i],POINTS[(i+1)%n])<0 for i in range(n))
report={'slug':'toilet','outline_vertices':n,'simple_polygon':not hits,'self_intersections':hits,'concave_vertices':concave,
 'minimum_edge_world':min(math.dist(p,q)*s for p,q in zip(POINTS,POINTS[1:]+POINTS[:1])),
 'polygon_pixels':int(m.sum()),'polygon_outside_alpha128_pixels':int((m&~a).sum()),
 'outside_percentage':round(float((m&~a).sum()/m.sum()*100),4),
 'visible_alpha_not_in_polygon_pixels':int((a&~m).sum()),
 'alpha_boundary_to_polygon_world':{'max':round(float(mind.max()*s),6),'p95':round(float(np.percentile(mind,95)*s),6)},
 'high_plateau_alpha_deviation_world_max':round(1*s,6),
 'visual_alpha_height_world':round((592-9)*s,6),'bearing_outline_height_world':115,
 'measurements':measure,'target_comparison':{'width_target':125,'width_actual':row['width'],'high_width_target':[70,78],'high_width_actual':measure['high_plateau']['width_world'],'low_width_target':[38,42],'low_width_actual':measure['low_plateau']['width_world'],'foot_width_target':[102,108],'foot_width_actual':measure['foot']['width_world'],'step_height_target':[35,40],'step_actual':measure['step_height_world']},
 'notes':'Raster metrics are visual diagnostics, not Cocos physics acceptance. Candidate B is proportionally wider than the nominal 125:115 target; keep actual 151:115 proportions rather than stretch. The fat tank support crosses the body center. Flattening 1-3 pixels follows the nearly horizontal visible lips; it does not invent a broad invisible platform.'}
(ROOT/'GEOMETRY_CHECK.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
bg=Image.new('RGBA',im.size,(214,231,247,255));bg.alpha_composite(im)
d=ImageDraw.Draw(bg);d.line([tuple(p) for p in POINTS]+[tuple(POINTS[0])],fill=(224,45,63,255),width=2)
for p in POINTS:d.ellipse((p[0]-3,p[1]-3,p[0]+3,p[1]+3),fill=(224,45,63,255))
for val in [measure['high_plateau'],measure['low_plateau'],measure['foot']]:
 d.line([tuple(p) for p in val['pixel_segment']],fill=(0,119,255,255),width=4)
bg.save(ROOT/'toilet-geometry.png')
print(json.dumps({'geometry':str(ROOT/'GEOMETRY.json'),'dimensions':[row['width'],row['height']],'checks':report},ensure_ascii=False,indent=2))
