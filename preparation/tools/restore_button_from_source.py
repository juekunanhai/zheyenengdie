"""Restore a blank button from formal pixels, without drawing a replacement highlight.

Only icon/text masks change. The right half supplies the occluded left highlight;
text background is interpolated between intact neighbours on the same source row.
All pixels outside the repair masks, including the native border/gloss, are retained.
"""
from pathlib import Path
import hashlib,json
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
ROOT=Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
source=Path(json.loads((ROOT/'art/EDGE_CANDIDATE_MANIFEST.json').read_text())['source_root'])/'02_ASSETS/result_ui/result_btn_share.png'
original=Image.open(source).convert('RGBA');a=np.array(original);h,w=a.shape[:2]
# The icon occludes part of the source highlight. Clone its intact opposite side.
icon_mask=Image.new('L',(w,h));d=ImageDraw.Draw(icon_mask)
for bounds in [(46,26,70,50),(82,46,108,72),(45,69,71,96)]:d.ellipse(bounds,fill=255)
d.polygon([(55,32),(102,53),(101,66),(58,91),(50,76),(82,59),(51,46)],fill=255)
icon_mask=icon_mask.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(.7))
ImageDraw.Draw(icon_mask).rectangle((0,0,w-1,23),fill=0)
clone=a.copy()
for x in range(40,114):clone[:,x]=a[:,460-x]
# Text does not overlap the native highlight. Replace only its blue interior region.
text_mask=Image.new('L',(w,h));ImageDraw.Draw(text_mask).rectangle((129,39,309,94),fill=255)
text_mask=text_mask.filter(ImageFilter.GaussianBlur(1.2))
fill=a.copy()
for y in range(34,100):
 left=np.median(a[y,119:128,:3],axis=0);right=np.median(a[y,313:322,:3],axis=0)
 for x in range(123,316):fill[y,x,:3]=np.clip(np.rint(left+(right-left)*(x-123)/(315-123)),0,255)
result=Image.composite(Image.fromarray(clone),original,icon_mask)
result=Image.composite(Image.fromarray(fill),result,text_mask)
result.putalpha(original.getchannel('A'))
mask=np.maximum(np.array(icon_mask),np.array(text_mask));changed=np.any(np.array(result)!=a,axis=2)
assert not np.any(changed & (mask==0))
assert np.array_equal(np.array(result)[:,:,3],a[:,:,3])
# Unoccluded native highlight and all outer border pixels are exact source pixels.
assert np.array_equal(np.array(result)[:24],a[:24])
assert np.array_equal(np.array(result)[:,322:],a[:,322:])
assert np.array_equal(np.array(result)[105:],a[105:])
out=ROOT/'art/source-restored/btn_settings_base.png';out.parent.mkdir(exist_ok=True)
box=original.getbbox();cropped=result.crop(box);padded=Image.new('RGBA',(cropped.width+32,cropped.height+32));padded.alpha_composite(cropped,(16,16));padded.save(out)
Image.fromarray(mask).save(out.with_name('btn_settings_repair_mask.png'))
manifest=ROOT/'art/UI_CORRECTION_MANIFEST.json'
history=ROOT/'art/UI_CORRECTION_MANIFEST.P3.json'
if not history.exists():history.write_bytes(manifest.read_bytes())
row={'id':'btn_settings_base','output':str(out.relative_to(ROOT)),'sha256':sha(out),'source':str(source),'source_sha256':sha(source),'method':'source-pixel repair: clone occluded icon/highlight from intact right side; fill text only from same-row native blue; no replacement gloss drawing','status':'user_requested_source_repair_pending_visual_review','size':list(padded.size),'source_crop':list(box),'padding_px':16,'repair_mask':str(out.with_name('btn_settings_repair_mask.png').relative_to(ROOT)),'changed_source_pixels':int(changed.sum()),'unchanged_outside_mask':True,'original_alpha_unchanged':True,'original_border_unchanged':True,'highlight_donor_symmetry_axis_x':230}
manifest.write_text(json.dumps({'revision':'2026-09-12-P4','script':'tools/restore_button_from_source.py','script_sha256':sha(Path(__file__)),'entries':[row]},ensure_ascii=False,indent=2)+'\n')
(ROOT.parent/'assets/batch0/art/btn_settings_base.png').write_bytes(out.read_bytes())
p=ROOT/'art/BATCH0_IMPORT_MANIFEST.json';rows=json.loads(p.read_text())
for r in rows:
 if r['id']==row['id']:r.update(candidate=row['output'],sha256=row['sha256'],purpose='Batch 0 static validation; source-pixel button repair requested by user')
p.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
print({k:row[k] for k in ['size','changed_source_pixels','unchanged_outside_mask','original_alpha_unchanged','sha256']})
