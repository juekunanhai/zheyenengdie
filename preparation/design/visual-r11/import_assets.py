"""Import reviewed R11 images, preserving source evidence and existing UUIDs."""
from pathlib import Path
import copy, hashlib, json, shutil, uuid
from PIL import Image
ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
baseline = json.loads((HERE / 'BEFORE.json').read_text())['source_assets_sha256']
template = json.loads((ROOT / 'assets/batch0/art/home_r9_cloud.png.meta').read_text())
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def import_image(row):
    name = row['id']
    candidate = HERE / 'assets' / (name + '.png')
    im = Image.open(row['source_path']).convert('RGBA')
    if name.startswith('result_'): im.thumbnail((900,650),Image.Resampling.LANCZOS)
    im.save(candidate)
    target = ROOT / 'assets/batch0/art' / (name + '.png')
    mp = Path(str(target)+'.meta')
    meta = json.loads(mp.read_text()) if mp.exists() else copy.deepcopy(template)
    if not mp.exists(): meta['uuid'] = str(uuid.uuid5(uuid.NAMESPACE_URL,'zheyenengdie:visual-r11:'+name))
    uid=meta['uuid'];meta['imported']=False
    for key,sub in meta['subMetas'].items():
        sub['uuid']=uid+'@'+key;sub['displayName']=name
        sub['userData']['imageUuidOrDatabaseUri']=uid+('@6c48a' if key=='f9941' else '')
    f=meta['subMetas']['f9941']['userData'];w,h=im.size
    f.update(width=w,height=h,rawWidth=w,rawHeight=h,trimX=0,trimY=0,offsetX=0,offsetY=0,trimType='none')
    f['vertices'].update(rawPosition=[-w/2,-h/2,0,w/2,-h/2,0,-w/2,h/2,0,w/2,h/2,0],uv=[0,h,w,h,0,0,w,0],minPos=[-w/2,-h/2,0],maxPos=[w/2,h/2,0])
    meta['userData'].update(redirect=uid+'@6c48a',hasAlpha=im.getchannel('A').getextrema()[0]<255)
    shutil.copy2(candidate,target);mp.write_text(json.dumps(meta,indent=2)+'\n')
    rel=str(target.relative_to(ROOT))
    return dict(id=name,candidate=str(candidate.relative_to(ROOT/'preparation')),import_path=rel,sha256=sha(candidate),previous_sha256=baseline.get(rel),uuid=uid,kind='replacement' if rel in baseline else 'new',size=[w,h],source_sha256=sha(Path(row['source_path'])),source_path=row['source_path'],status='self_checked_pending_engine_and_user_visual_review')
if __name__=='__main__':
    rows=json.loads((HERE/'SOURCE.json').read_text())['selected']
    entries=[import_image(r) for r in rows]
    (ROOT/'preparation/art/VISUAL_R11_IMPORT_MANIFEST.json').write_text(json.dumps(dict(revision='visual-r11',entries=entries),ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'imported':[r['id'] for r in entries]}))
