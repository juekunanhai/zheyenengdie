"""Copy approved R13 components verbatim, with explicit Cocos sprite-frame metadata."""
from pathlib import Path
import copy, hashlib, json, shutil, uuid
from PIL import Image

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
NAMES = {'panel': 'result_panel_decorated', 'tower': 'result_character_tower',
         'title': 'result_title', 'bubble': 'result_bubble',
         'retry': 'result_retry', 'close': 'result_close'}
NAMES.update({f'height_{char}': f'height_{char}' for char in [*map(str, range(10)), 'dot', 'm']})
TEMPLATE = json.loads((PROJECT/'assets/batch0/art/home_r9_cloud.png.meta').read_text())
APPROVAL = json.loads((HERE/'QA.json').read_text())['user_visual_review']

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    assert APPROVAL['status'] == 'approved'
    assert sha(HERE/'full-card-r13.png') == APPROVAL['approved_artifact_sha256']
    entries = []
    for key, source_name in NAMES.items():
        name = 'result_r13_' + key
        candidate = HERE/'assets'/f'{source_name}.png'
        target = PROJECT/'assets/batch0/art'/f'{name}.png'
        with Image.open(candidate) as im:
            assert im.mode == 'RGBA' and im.getchannel('A').getextrema() == (0, 255)
            width, height = im.size
        meta = copy.deepcopy(TEMPLATE)
        uid = str(uuid.uuid5(uuid.NAMESPACE_URL, 'zheyenengdie:result-r13:' + name))
        meta.update(uuid=uid, imported=False)
        for suffix, sub in meta['subMetas'].items():
            sub.update(uuid=uid+'@'+suffix, displayName=name, imported=False)
            sub['userData']['imageUuidOrDatabaseUri'] = uid+('@6c48a' if suffix=='f9941' else '')
        frame = meta['subMetas']['f9941']['userData']
        frame.update(width=width, height=height, rawWidth=width, rawHeight=height,
                     trimType='none', trimX=0, trimY=0, offsetX=0, offsetY=0,
                     borderTop=0, borderBottom=0, borderLeft=0, borderRight=0)
        frame['vertices'].update(rawPosition=[-width/2,-height/2,0,width/2,-height/2,0,-width/2,height/2,0,width/2,height/2,0],
                                 uv=[0,height,width,height,0,0,width,0],
                                 minPos=[-width/2,-height/2,0], maxPos=[width/2,height/2,0])
        meta['userData'].update(redirect=uid+'@6c48a', hasAlpha=True)
        if target.exists(): assert sha(target) == sha(candidate), 'Do not overwrite a different runtime image'
        shutil.copy2(candidate, target)
        Path(str(target)+'.meta').write_text(json.dumps(meta, indent=2)+'\n')
        entries.append(dict(id=name, candidate=str(candidate.relative_to(PROJECT/'preparation')),
                            import_path=str(target.relative_to(PROJECT)), sha256=sha(candidate),
                            uuid=uid, kind='new', size=[width,height]))
    manifest = dict(revision='result-r13', status='approved_visual_runtime_integration',
                    approved_artifact_sha256=APPROVAL['approved_artifact_sha256'], entries=entries)
    (PROJECT/'preparation/art/RESULT_R13_IMPORT_MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
    print(f'Imported {len(entries)} approved component PNGs; excluded unimplemented feature sprites.')

if __name__ == '__main__': main()
