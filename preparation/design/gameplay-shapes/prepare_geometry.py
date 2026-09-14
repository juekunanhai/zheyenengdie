"""Map hand-selected support silhouettes to world units without stretching sprites."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent
DATA = {
    'toilet': {
        'width': 85, 'height': 115, 'sprite_px': [615, 784], 'alpha_px': [9, 9, 606, 775],
        'points_px': [[75,9],[225,9],[249,25],[254,63],[242,86],[242,341],[267,326],[493,326],[587,340],[605,367],[603,437],[578,495],[531,545],[462,586],[471,645],[509,717],[522,742],[522,761],[501,775],[184,775],[164,761],[165,739],[188,705],[199,672],[192,625],[176,570],[148,514],[89,480],[74,452],[70,433],[43,417],[29,381],[22,87],[10,81],[9,43],[29,24]],
        'material': 'ceramic',
        'note': 'High cistern plateau and lower closed-lid plateau remain separate; under-bowl neck concavity is real. Rounded corners simplified only below normal game pixel scale.'
    },
    'dumbbell': {
        'width': 115, 'height': 45, 'sprite_px': [784, 251], 'alpha_px': [9, 9, 775, 242],
        'points_px': [[67,9],[207,9],[235,37],[244,68],[259,83],[273,89],[510,89],[530,80],[540,63],[552,34],[577,9],[718,9],[743,36],[757,67],[775,76],[775,177],[757,188],[745,216],[718,242],[577,242],[550,216],[539,184],[530,169],[510,162],[273,162],[254,169],[242,184],[230,219],[207,242],[67,242],[40,216],[27,186],[9,177],[9,76],[27,66],[40,36]],
        'material': 'metal_rubber',
        'note': 'One connected dumbbell, two exposed recesses; both end top and bottom flats share one height. No collider fills the open upper or lower center recess.'
    }
}

rows = []
for slug, row in DATA.items():
    x0,y0,x1,y1 = row['alpha_px']
    cx,cy = (x0+x1)/2,(y0+y1)/2
    factor = row['height']/(y1-y0)
    points = [[round((x-cx)*factor,6), round((cy-y)*factor,6)] for x,y in row['points_px']]
    area = sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(points,points[1:]+points[:1]))/2
    if area < 0:
        points.reverse()
        area = -area
    sw,sh = row['sprite_px']
    width = (x1-x0)*factor
    rows.append({
        'slug': slug,
        'name': '马桶' if slug == 'toilet' else '哑铃',
        'candidate_status': 'self_checked_contour_not_runtime_physics_accepted',
        'formal_source_size_world': [row['width'],row['height']],
        'size_selection': 'Keep original height; derive candidate width by uniform sprite scale. Do not modify formal OBJECT_GAMEPLAY_SCALE.json.',
        'width_change_percent': round((width/row['width']-1)*100,6),
        'width': round(width,6), 'height': row['height'],
        'spriteWidth': round(sw*factor,6), 'spriteHeight': round(sh*factor,6),
        'spriteOffset': [round((sw/2-cx)*factor,6),round((cy-sh/2)*factor,6)],
        'sprite_path': str((ROOT/'assets'/f'object_{slug}.png').resolve()),
        'next_path': str((ROOT/'assets'/f'next_{slug}.png').resolve()),
        'outline': points,
        'outline_winding': 'counter_clockwise',
        'outline_area_world_squared': round(area,6),
        'source_outline_px': row['points_px'],
        'pixel_to_world': factor,
        'visual_alpha128_bounds_px': row['alpha_px'],
        'physics_contact_material': row['material'],
        'notes': row['note'],
        'not_selected_mapping': {'reason':'Keeping original width would shrink actual visible height; do not use with selected candidate.', 'width':row['width'],'height':round((y1-y0)*row['width']/(x1-x0),6)}
    })
(ROOT/'GEOMETRY.json').write_text(json.dumps({'version':'gameplay-shapes-r1','coordinate_system':'x-right y-up; Sprite center at local origin; values world units','assets':rows},ensure_ascii=False,indent=2)+'\n')
print(json.dumps([{k:r[k] for k in ['slug','width','height','spriteWidth','spriteHeight','spriteOffset','width_change_percent']} for r in rows], ensure_ascii=False,indent=2))
