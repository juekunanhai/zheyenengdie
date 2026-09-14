"""User-requested fullscreen background: remove baked panel rim, keep formal pixels."""
from pathlib import Path
import json,hashlib
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
p1=ROOT/'art/candidates/backgrounds/bg_sky_panel.png'
# Interior wholly inside the rounded panel; neither UI rim nor transparent padding.
roi=(40,40,360,220);im=Image.open(p1).convert('RGBA').crop(roi)
assert im.getchannel('A').getextrema()[0]>=250
im.putalpha(255)
out=ROOT/'art/ui-corrections/bg_sky_panel.png';im.save(out)
row={'id':'bg_sky_panel','source_candidate':str(p1.relative_to(ROOT)),'source_sha256':sha(p1),'roi':roi,'output':str(out.relative_to(ROOT)),'sha256':sha(out),'status':'user_requested_fullscreen_fix_pending_visual_review','note':'仅裁取正式天空内区，排除原组件烤入的圆角边框和透明残片，内区 Alpha 250–253 归一为背景所需的 255；以等比 cover 用于背景，原文件保持不变。'}
(ROOT/'art/BACKGROUND_CORRECTION_MANIFEST.json').write_text(json.dumps({'revision':'2026-09-12-P3','script_sha256':sha(Path(__file__)),'entries':[row]},ensure_ascii=False,indent=2)+'\n')
(ROOT.parent/'assets/batch0/art/bg_sky_panel.png').write_bytes(out.read_bytes())
p=ROOT/'art/BATCH0_IMPORT_MANIFEST.json';rows=json.loads(p.read_text())
for r in rows:
 if r['id']==row['id']:r.update(candidate=row['output'],sha256=row['sha256'],purpose='Batch 0; requested fullscreen background correction')
p.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
print('Opaque formal-source background interior:',im.size)
