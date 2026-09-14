"""Prepare six Batch 1C art candidates, preserving source pixels and actual silhouettes.

Local alpha extraction/cropping was explicitly authorized. Generated RGB originals stay
untouched; neutral background connected to the image boundary is removed only here.
Tool dependency: opencv-python-headless in ~/.cache/codex-art-tools (not game runtime).
"""
from pathlib import Path
import hashlib
import json
import sys

sys.path.insert(0, str(Path.home() / '.cache/codex-art-tools'))
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'preparation/design/batch1c'
ROWS = [
    ('wooden_crate', 120, 'generated/wooden_crate-r1.png', True),
    ('ice_block', 120, 'generated/ice_block-r1.png', True),
    ('sofa', 180, 'generated/sofa-r1.png', True),
    ('whale', 225, 'generated/whale-r1.png', True),
    ('burger', 130, '../../../assets/batch0/art/object_burger.png', False),
    ('slipper', 165, '../../art/candidates/objects/object_slipper.png', False),
]

def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()

def remove_background(im, slug):
    rgb = np.asarray(im.convert('RGB'))
    # All four outputs have neutral RGB surroundings; the colored outline separates
    # neutral highlights inside the subject from this boundary-connected component.
    neutral = (rgb.max(axis=2).astype(int) - rgb.min(axis=2).astype(int)) <= 35
    n, labels = cv2.connectedComponents(neutral.astype(np.uint8), connectivity=8)
    edge_labels = np.unique(np.concatenate((labels[0], labels[-1], labels[:, 0], labels[:, -1])))
    outside = np.isin(labels, edge_labels[edge_labels != 0])
    foreground = (~outside).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(foreground, connectivity=8)
    largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    foreground = lab == largest
    rgba = np.dstack((rgb, foreground.astype(np.uint8) * 255))
    return Image.fromarray(rgba), {'method': 'boundary_connected_neutral_background_only',
        'neutral_channel_range_max': 35, 'foreground_component': 'largest',
        'removed_pixels': int((~foreground).sum()), 'input_mode': im.mode}

def points(im, target_width):
    alpha = np.asarray(im.getchannel('A'))
    contours, _ = cv2.findContours((alpha >= 128).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    c = max(contours, key=cv2.contourArea)
    raw = c[:, 0, :]
    px_width = int(raw[:, 0].max() - raw[:, 0].min())
    scale = target_width / px_width
    # A sub-world-unit tolerance removes texture noise while retaining actual ledges,
    # concave tail and rounded bearing faces. No convex hull / filled rectangle.
    epsilon = 0.5 / scale
    p = cv2.approxPolyDP(c, epsilon, True)[:, 0, :].astype(float)
    # Image coordinates are y-down; runtime is y-up. Positive area is CCW.
    lo = p.min(axis=0); hi = p.max(axis=0); center = (lo + hi) / 2
    world = np.column_stack(((p[:, 0] - center[0]) * scale, (center[1] - p[:, 1]) * scale))
    area = np.sum(world[:, 0] * np.roll(world[:, 1], -1) - np.roll(world[:, 0], -1) * world[:, 1]) / 2
    if area < 0:
        p = p[::-1]; world = world[::-1]; area = -area
    # Report actual full-contour-to-polyline distance, independent of simplify epsilon.
    error_px = max(abs(cv2.pointPolygonTest(p.astype(np.float32).reshape(-1, 1, 2), tuple(map(float, v)), True)) for v in raw)
    out = {
        'width': round(float(hi[0] - lo[0]) * scale, 6),
        'height': round(float(hi[1] - lo[1]) * scale, 6),
        'circle': False,
        'spriteWidth': round(im.width * scale, 6),
        'spriteHeight': round(im.height * scale, 6),
        'spriteOffset': [round((im.width/2-center[0])*scale, 6), round((center[1]-im.height/2)*scale, 6)],
        'outline': [[round(float(x), 6), round(float(y), 6)] for x, y in world],
    }
    return out, p, {'alpha_threshold':128, 'epsilon_world':0.5, 'vertex_count':len(p),
        'max_contour_to_polygon_distance_world':round(error_px * scale, 6),
        'area_world_squared':round(area, 6), 'scale_world_per_pixel':round(scale, 9),
        'native_fixture_count':'not_yet_checked', 'method':'actual_alpha_contour_simplified_no_hull'}

def main():
    (OUT / 'assets').mkdir(parents=True, exist_ok=True)
    (OUT / 'review').mkdir(exist_ok=True)
    rows=[]; tiles=[]
    for slug, width, rel, generated in ROWS:
        source=(OUT / rel).resolve()
        original=Image.open(source)
        if generated:
            im, edit=remove_background(original, slug)
        else:
            im=original.convert('RGBA'); edit={'method':'existing_formal_alpha_preserved'}
        rotation=0
        if slug=='slipper':
            yy,xx=np.where(np.asarray(im.getchannel('A'))>=128)
            _,v=np.linalg.eigh(np.cov(np.column_stack((xx,yy)),rowvar=False))
            axis=v[:,-1]
            rotation=float(np.degrees(np.arctan2(axis[1],axis[0])))
            while rotation>90:rotation-=180
            while rotation< -90:rotation+=180
            im=im.rotate(rotation,Image.Resampling.BICUBIC,expand=True)
            edit.update(rotation_deg=rotation,rotation_reason='align_actual_shoe_long_axis_before_geometry')
        box=im.getchannel('A').getbbox(); im=im.crop(box)
        # Uniform downsample only for newly generated oversize sources; old sources
        # are not magnified. Clear margin supports filtering and four-way rotation.
        factor=min(1,768/max(im.size))
        if factor<1:im=im.resize(tuple(round(x*factor) for x in im.size),Image.Resampling.LANCZOS)
        padded=Image.new('RGBA',(im.width+16,im.height+16));padded.alpha_composite(im,(8,8));im=padded
        sprite=OUT/'assets'/f'object_{slug}.png';im.save(sprite)
        nxt=Image.new('RGBA',im.size,(218,235,255));nxt.putalpha(im.getchannel('A'))
        next_file=OUT/'assets'/f'next_{slug}.png';nxt.save(next_file)
        geometry, poly, audit=points(im,width)
        assert max(geometry['width'],geometry['height'])<=260
        assert im.getchannel('A').tobytes()==nxt.getchannel('A').tobytes()
        tile=Image.new('RGB',(420,320),(215,231,243))
        render=im.copy();render.thumbnail((390,260))
        tile.paste(render,((420-render.width)//2,36+(260-render.height)//2),render)
        dr=ImageDraw.Draw(tile);dr.text((12,8),f'{slug}  {geometry["width"]} x {geometry["height"]}',fill=(15,40,65))
        # Full-resolution overlay remains available for checking shape contact edges.
        overlay=Image.new('RGBA',im.size,(218,232,242,255));overlay.alpha_composite(im)
        od=ImageDraw.Draw(overlay);od.line([tuple(x) for x in poly]+[tuple(poly[0])],fill=(235,25,120,255),width=2)
        for x,y in poly:od.ellipse((x-2,y-2,x+2,y+2),fill=(255,225,0,255))
        overlay.convert('RGB').save(OUT/'review'/f'{slug}-geometry.png')
        tiles.append(tile)
        rows.append({'slug':slug,'target_width':width,'source':str(source.relative_to(ROOT)),
            'source_sha256':sha(source),'generated':generated,'local_processing':edit,
            'sprite':str(sprite.relative_to(ROOT)),'sprite_sha256':sha(sprite),
            'next':str(next_file.relative_to(ROOT)),'next_sha256':sha(next_file),
            'next_alpha_matches':True,'geometry':geometry,'geometry_audit':audit,
            'status':'self_reviewed_candidate_pending_engine_contact_and_user_visual_review'})
    sheet=Image.new('RGB',(1260,640))
    for i,tile in enumerate(tiles):sheet.paste(tile,((i%3)*420,(i//3)*320))
    sheet.save(OUT/'review/contact-sheet.png')
    result={'status':'candidates_not_physics_acceptance','script_sha256':sha(__file__),
        'original_scale_file_unchanged':True,'source_precedence':'approved_reuse_or_authorized_necessary_redraw',
        'no_nonuniform_stretch':True,'objects':rows}
    (OUT/'GEOMETRY.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps([{'slug':r['slug'],**{k:r['geometry'][k] for k in ['width','height']},**r['geometry_audit']} for r in rows],indent=2))

if __name__=='__main__':main()
