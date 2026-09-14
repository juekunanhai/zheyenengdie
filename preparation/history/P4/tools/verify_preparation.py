"""Integrity checks for prep artifacts, not game tests or visual approval."""
from pathlib import Path
import hashlib,json,wave,re,subprocess
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
art=json.loads((ROOT/'art/CANDIDATE_MANIFEST.json').read_text())
audio=json.loads((ROOT/'audio/AUDIO_MANIFEST.json').read_text())
source=Path(art['source_root'])
inventory=[]
for p in sorted((source/'02_ASSETS').rglob('*.png')):
    with Image.open(p) as im:
        im.verify()
    im=Image.open(p)
    inventory.append({'path':str(p.relative_to(source)),'sha256':sha(p),'size':list(im.size),'bytes':p.stat().st_size})
assert len(inventory)==179
assert art['script_sha256']==sha(ROOT/'tools/prepare_art.py')
assert art['recipe_sha256']==sha(ROOT/'art/recipes.json')
for r in art['entries']:
    assert sha(source/'02_ASSETS'/r['source'])==r['source_sha256'],r['id']
    p=ROOT/r['output'];assert sha(p)==r['output_sha256'],r['id']
    with Image.open(p) as im:
        assert im.mode=='RGBA' and im.getbbox() is not None
    if 'next_output' in r:
        p=ROOT/r['next_output'];assert sha(p)==r['next_sha256']
        im=np.array(Image.open(p));colors=np.unique(im[im[:,:,3]>0,:3],axis=0)
        assert colors.shape==(1,3),r['id']
assert sha(ROOT/'art/OBJECT_GAMEPLAY_SCALE.reference.json')==sha(source/'00_DOCS/OBJECT_GAMEPLAY_SCALE.json')
assert audio['script_sha256']==sha(ROOT/'tools/prepare_audio.py')
for s in audio['entries']:
    p=ROOT/s['file'];assert sha(p)==s['sha256'],s['id']
    with wave.open(str(p),'rb') as w:
        assert w.getsampwidth()==2 and w.getframerate()==44100
        assert w.getnchannels()==s['channels']
        frames=w.getnframes();data=np.frombuffer(w.readframes(frames),dtype='<i2')
        assert data.size==frames*s['channels']
        assert 0 < np.max(np.abs(data.astype('int32'))) < 32767
        assert abs(frames/44100-s['duration_s'])<.001
    if s['loop']:assert s['seam_jump']<.01
project=ROOT.parent
for p in project.rglob('*.json'):
    if any(x in p.parts for x in ['library','temp','node_modules']):continue
    json.loads(p.read_text())
engine=json.loads((project/'settings/v2/packages/engine.json').read_text())['modules']['configs']['defaultConfig']
assert engine['cache']['physics-2d']['_option']=='physics-2d-box2d-wasm'
assert 'physics-2d-box2d-wasm' in engine['includeModules'] and 'physics-2d-box2d' not in engine['includeModules']
assert not list((project/'assets').rglob('*.ts')) and not list((project/'assets').rglob('*.js'))
edges=json.loads((ROOT/'art/EDGE_CANDIDATE_MANIFEST.json').read_text())
approval=json.loads((ROOT/'art/USER_VISUAL_APPROVAL.json').read_text())['approved_outputs']
assert edges['script_sha256']==sha(ROOT/'tools/repair_edges.py')
for r in edges['entries']:
    assert sha(ROOT/r['output'])==r['sha256']==approval[r['id']]['sha256']
    assert sha(source/'02_ASSETS'/r['source'])==r['source_sha256']
    if 'next_output' in r:
        assert sha(ROOT/r['next_output'])==r['next_sha256']
        arr=np.array(Image.open(ROOT/r['next_output']))
        assert np.unique(arr[arr[:,:,3]>0,:3],axis=0).shape==(1,3)
corrections=json.loads((ROOT/'art/UI_CORRECTION_MANIFEST.json').read_text())
assert corrections['script_sha256']==sha(ROOT/corrections['script'])
for r in corrections['entries']:
    assert sha(ROOT/r['output'])==r['sha256']
    assert sha(Path(r['source']))==r['source_sha256']
background=json.loads((ROOT/'art/BACKGROUND_CORRECTION_MANIFEST.json').read_text())
assert background['script_sha256']==sha(ROOT/'tools/prepare_fullscreen_background.py')
for r in background['entries']:
    assert sha(ROOT/r['output'])==r['sha256']
    assert sha(ROOT/r['source_candidate'])==r['source_sha256']
    assert Image.open(ROOT/r['output']).getchannel('A').getextrema()==(255,255)
imports=json.loads((ROOT/'art/BATCH0_IMPORT_MANIFEST.json').read_text())
frames=set()
for r in imports:
    assert sha(ROOT/r['candidate'])==sha(project/r['import_path'])==r['sha256'],r['id']
    meta=json.loads(Path(str(project/r['import_path'])+'.meta').read_text())
    frames.add(meta['uuid']+'@f9941')
assert len(frames)==len(imports)==35
scenes=list((project/'assets').rglob('*.scene'));assert len(scenes)==4
sprite_count=0
for p in scenes:
    data=json.loads(p.read_text())
    def walk(v):
        if isinstance(v,dict):
            if '__id__' in v:assert 0<=v['__id__']<len(data),(p,v)
            if '__uuid__' in v:assert v['__uuid__'] in frames,(p,v)
            for x in v.values():walk(x)
        elif isinstance(v,list):
            for x in v:walk(x)
    walk(data)
    for n in data:
        assert n.get('__type__') not in ['cc.RigidBody2D','cc.BoxCollider2D','cc.PolygonCollider2D','cc.CircleCollider2D']
        if n.get('__type__')=='cc.Sprite':sprite_count+=1
        if n.get('__type__')=='cc.Widget' and n.get('_bottom',0)!=0:
            assert n['_alignFlags']&4,(p,n)
encoded=json.loads((ROOT/'audio/ENCODED_MANIFEST.json').read_text())
assert encoded['script_sha256']==sha(ROOT/'tools/encode_audio.py')
for r in encoded['entries']:
    assert sha(ROOT/r['file'])==r['sha256'] and sha(ROOT/r['source_file'])==r['source_sha256']
    assert (ROOT/r['file']).stat().st_size==r['bytes']
assert sum(r['bytes'] for r in encoded['entries'])==encoded['encoded_bytes']
# Baseline comparison, not a fresh inventory replacing the prior one.
previous=json.loads((ROOT/'art/SOURCE_INVENTORY.json').read_text())
assert {r['path']:r['sha256'] for r in previous['files']}=={r['path']:r['sha256'] for r in inventory}

page=(ROOT/'review/index.html').read_text()
assert not re.search(r'<(?:script|link|img)[^>]+(?:src|href)=["\']https?://',page)
scripts=re.findall(r'<script>([\s\S]*?)</script>',page)
for name in ['index','layout','edge-review','engine','engine-player']:
    content=(ROOT/f'review/{name}.html').read_text()
    assert not re.search(r'<(?:script|link|img)[^>]+(?:src|href)=["\']https?://',content)
    check=Path('/private/tmp/zhynd-'+name+'-check.js')
    check.write_text('\n'.join(re.findall(r'<script>([\s\S]*?)</script>',content)))
    subprocess.run(['/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node','--check',str(check)],check=True,capture_output=True)

source_check={'files':inventory,'png_count':len(inventory)}
(ROOT/'art/SOURCE_INVENTORY.json').write_text(json.dumps(source_check,ensure_ascii=False,indent=2)+'\n')
build=json.loads((ROOT/'review/evidence/BUILD_REPORT.json').read_text())
assert build['status']=='success'
for relative,expected in build['output_sha256'].items():assert sha(project/'build/web-desktop'/relative)==expected
for name,expected in build['scene_source_sha256'].items():assert sha(project/'assets/batch0/scenes'/name)==expected
report={'status':'passed_integrity_only','source_png_count':len(inventory),
    'art_candidates':len(art['entries']),'next_candidates':sum('next_output' in r for r in art['entries']),
    'audio_candidates':len(audio['entries']),'source_scale_unchanged':True,
    'raw_audio_bytes':sum((ROOT/s['file']).stat().st_size for s in audio['entries']),
    'gameplay_scripts':0,'scene_files':len(scenes),'static_sprite_references':sprite_count,'import_images':len(imports),'accepted_edge_repairs':len(approval),'encoded_audio_bytes':encoded['encoded_bytes'],'ui_corrections_pending_review':len(corrections['entries'])+len(background['entries']),
    'not_proven':['runtime status is tracked separately in STATIC_ACCEPTANCE.md','physics behavior','subjective sound quality','WeChat runtime/device performance','publication readiness']}
(ROOT/'review/INTEGRITY_REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False))
