"""Integrity checks for prep artifacts, not game tests or visual approval."""
from pathlib import Path
import hashlib,json,wave,re,subprocess,runpy
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
is_batch1a=(project/'assets/batch1/game-controller.ts').exists()
has_home_r9=(project/'assets/batch0/presentation/HomePresentation.ts').exists()
has_home_r10=(ROOT/'art/HOME_R10_IMPORT_MANIFEST.json').exists()
has_shape_trial=(ROOT/'art/GAMEPLAY_SHAPE_IMPORT_MANIFEST.json').exists()
visual_r11_file=ROOT/'art/VISUAL_R11_IMPORT_MANIFEST.json'
has_visual_r11=visual_r11_file.exists()
result_r13_file=ROOT/'art/RESULT_R13_IMPORT_MANIFEST.json'
has_result_r13=result_r13_file.exists()
has_batch1b=(project/'assets/batch1/incident-state.ts').exists()
has_batch1c=(project/'assets/batch1/game-music.ts').exists()
if has_batch1c:assert has_batch1b, 'Batch 1C retains the accepted Batch 1B incident foundation'
if has_batch1b:assert has_result_r13, 'Batch 1B retains the approved R13 runtime baseline'
if has_result_r13:assert has_visual_r11, 'R13 retains the R11 baseline and existing presentation scripts'
if has_home_r10:assert has_home_r9, 'R10 retains the existing Home presentation and R9 imports'
for p in project.rglob('*.json'):
    if any(x in p.parts for x in ['library','temp','node_modules']):continue
    json.loads(p.read_text())
engine=json.loads((project/'settings/v2/packages/engine.json').read_text())['modules']['configs']['defaultConfig']
assert engine['cache']['physics-2d']['_option']=='physics-2d-box2d-wasm'
assert 'physics-2d-box2d-wasm' in engine['includeModules'] and 'physics-2d-box2d' not in engine['includeModules']
expected_scripts=['assets/batch0/presentation/HeightBackdrop.ts']
if has_home_r9:expected_scripts.append('assets/batch0/presentation/HomePresentation.ts')
if has_visual_r11:expected_scripts.append('assets/batch0/presentation/ResultPresentation.ts')
if is_batch1a:
    expected_scripts += ['assets/batch1/'+name+'.ts' for name in ['object-data','tower-world',
        'local-platform','game-audio','play-view','game-controller','scene-actions']]
if has_batch1b:expected_scripts.append('assets/batch1/incident-state.ts')
if has_batch1c:expected_scripts.append('assets/batch1/game-music.ts')
assert sorted(str(p.relative_to(project)) for p in (project/'assets').rglob('*.ts'))==sorted(expected_scripts)
assert not list((project/'assets').rglob('*.js'))
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
assert len(imports)==47
if is_batch1a:
    extra_imports=json.loads((ROOT/'art/BATCH1A_IMPORT_MANIFEST.json').read_text())
    assert {r['id'] for r in extra_imports}=={'next_cardboard_box','next_wood_plank','next_fridge'}
    imports += extra_imports
if has_home_r9:
    home_imports=json.loads((ROOT/'art/HOME_R9_IMPORT_MANIFEST.json').read_text())
    assert {r['id'] for r in home_imports}=={'home_r9_background','home_r9_hero','home_r9_slipper','home_r9_sign','home_r9_cloud'}
    home_approval=json.loads((ROOT/'design/R9/APPROVAL.json').read_text())
    assert home_approval['status']=='approved'
    for row in home_approval['design_files']:
        assert sha(ROOT/row['path'])==row['sha256']
    imports += home_imports
if has_home_r10:
    home_imports=json.loads((ROOT/'art/HOME_R10_IMPORT_MANIFEST.json').read_text())
    assert {r['id'] for r in home_imports}=={'home_r10_background','home_r10_logo','home_r10_airship','home_r10_airplane'}
    home_approval=json.loads((ROOT/'design/R10/APPROVAL.json').read_text())
    assert home_approval['status']=='approved' and home_approval['user_quote'].strip()
    assert home_approval['design_files'], 'R10 approval must identify the reviewed design files'
    for row in home_approval['design_files']:
        assert sha(ROOT/row['path'])==row['sha256']
    imports += home_imports
shape_frame_uuids=set()
shape_next_pairs_checked=0
has_toilet_r2=False
if has_shape_trial:
    shape_imports=json.loads((ROOT/'art/GAMEPLAY_SHAPE_IMPORT_MANIFEST.json').read_text())
    assert shape_imports['batch'] in ('shape-trial-1','toilet-shape-r2')
    has_toilet_r2=shape_imports['batch']=='toilet-shape-r2'
    shape_rows=shape_imports['assets']
    expected_shapes={'object_toilet','next_toilet','object_dumbbell','next_dumbbell'}
    assert len(shape_rows)==4 and {Path(r['target']).stem for r in shape_rows}==expected_shapes
    shape_root=ROOT/'design/gameplay-shapes'
    shape_sources=json.loads((shape_root/'ASSET_MANIFEST.json').read_text())['assets']
    assert {r['slug'] for r in shape_sources}=={'toilet','dumbbell'}
    # R1 remains loadable for the same-action replay. R2 replaces only the live toilet pair.
    shape_sources=[(shape_root,row) for row in shape_sources]
    if has_toilet_r2:
        r2_root=ROOT/'design/gameplay-toilet-r2/candidate-b'
        r2_sources=json.loads((r2_root/'ASSET_MANIFEST.json').read_text())['assets']
        assert len(r2_sources)==1 and r2_sources[0]['slug']=='toilet'
        shape_sources += [(r2_root,row) for row in r2_sources]
    source_files={}
    for shape_root,row in shape_sources:
        assert row['status']=='complete_generated_candidate_self_checked_not_user_approved_or_runtime_verified'
        assert sha(shape_root/row['source'])==row['source_sha256'],row['slug']
        sprite_path=shape_root/row['sprite'];next_path=shape_root/row['next']
        assert sha(sprite_path)==row['sprite_sha256'],row['slug']
        assert sha(next_path)==row['next_sha256'],row['slug']
        sprite=np.array(Image.open(sprite_path).convert('RGBA'))
        silhouette=np.array(Image.open(next_path).convert('RGBA'))
        assert sprite.shape==silhouette.shape and list(Image.open(sprite_path).size)==row['size_px']
        assert np.array_equal(sprite[:,:,3],silhouette[:,:,3]),row['slug']+' NEXT alpha differs from Sprite'
        colors=np.unique(silhouette[silhouette[:,:,3]>0,:3],axis=0)
        assert colors.shape==(1,3) and colors[0].tolist()==[216,231,248],row['slug']+' NEXT is not the specified pure silhouette'
        source_files[sprite_path.resolve()]=row['sprite_sha256']
        source_files[next_path.resolve()]=row['next_sha256']
        shape_next_pairs_checked+=1
    for row in shape_rows:
        assert row['status']=='self_checked_trial_candidate_not_user_final_art_approval'
        candidate=project/row['source']
        assert candidate.resolve() in source_files and source_files[candidate.resolve()]==row['sha256']
        assert Path(row['target']).parent==Path('assets/batch0/art')
        meta=json.loads(Path(str(project/row['target'])+'.meta').read_text())
        assert meta['uuid']==row['uuid']
        shape_frame_uuids.add(row['uuid']+'@f9941')
        imports.append({'id':Path(row['target']).stem,'candidate':str(candidate.relative_to(ROOT)),
            'import_path':row['target'],'sha256':row['sha256']})
difficulty_file=ROOT/'art/DIFFICULTY_R1_IMPORT_MANIFEST.json'
difficulty_replacements={}
if difficulty_file.exists():
    difficulty=json.loads(difficulty_file.read_text())
    assert difficulty['batch']=='difficulty-r1'
    difficulty_replacements={r['id']:r for r in difficulty['entries']}
    assert len(difficulty['entries'])==6 and set(difficulty_replacements)=={
        prefix+kind for prefix in ('object_','next_') for kind in ('cardboard_box','fridge','wood_plank')}
    source_root=ROOT/'design/difficulty-r1'
    provenance=json.loads((source_root/'SOURCE.json').read_text())
    assert provenance['local_files_uploaded'] is False and provenance['input_images_submitted']==[]
    for file,expected in provenance['frozen_files'].items():assert sha(source_root/file)==expected,file
    for row in provenance['generation_calls']:
        assert sha(Path(row['saved_generated_file']))==row['generated_sha256']
        assert Path(row['prompt_file']).read_text()==row['prompt']
    difficulty_source_files={}
    for kind in ('cardboard_box','fridge','wood_plank'):
        sprite=np.array(Image.open(source_root/f'assets/object_{kind}.png').convert('RGBA'))
        silhouette=np.array(Image.open(source_root/f'assets/next_{kind}.png').convert('RGBA'))
        assert sprite.shape==silhouette.shape and np.array_equal(sprite[:,:,3],silhouette[:,:,3]),kind
        colors=np.unique(silhouette[silhouette[:,:,3]>0,:3],axis=0)
        assert colors.shape==(1,3) and colors[0].tolist()==[218,235,255],kind
        for prefix in ('object_','next_'):
            p=source_root/f'assets/{prefix}{kind}.png'
            difficulty_source_files[p.resolve()]=sha(p)
    # The original rounded fridge remains frozen; the live eight-sided candidate
    # has its own provenance and a uniform 125 / 110 world-size selection.
    fridge_root=source_root/'fridge-r2'
    fridge_source=json.loads((fridge_root/'SOURCE.json').read_text())
    assert fridge_source['local_files_uploaded'] is False and fridge_source['submitted_images']==[]
    for file,expected in fridge_source['frozen_files'].items():assert sha(fridge_root/file)==expected,file
    for row in fridge_source['calls']:
        assert sha(Path(row['saved_path']))==row['sha256']
        assert Path(row['prompt_file']).read_text()==row['prompt']
    sprite=np.array(Image.open(fridge_root/'assets/object_fridge.png').convert('RGBA'))
    silhouette=np.array(Image.open(fridge_root/'assets/next_fridge.png').convert('RGBA'))
    assert sprite.shape==silhouette.shape and np.array_equal(sprite[:,:,3],silhouette[:,:,3]),'fridge-r2 NEXT alpha'
    colors=np.unique(silhouette[silhouette[:,:,3]>0,:3],axis=0)
    assert colors.shape==(1,3) and colors[0].tolist()==[218,235,255],'fridge-r2 NEXT color'
    for prefix in ('object_','next_'):
        p=fridge_root/f'assets/{prefix}fridge.png'
        difficulty_source_files[p.resolve()]=sha(p)
    size_source=json.loads((fridge_root/'SOURCE_125.json').read_text())
    assert size_source['new_image_generation_calls']==0 and size_source['raster_operations']==[]
    for file,expected in size_source['outputs'].items():assert sha(fridge_root/file)==expected,file
    original=json.loads((fridge_root/'GEOMETRY.json').read_text())['assets'][0]
    scaled_file=json.loads((fridge_root/'GEOMETRY_125.json').read_text())
    assert scaled_file['source_geometry_110_sha256']==sha(fridge_root/'GEOMETRY.json')
    scaled=scaled_file['assets'][0]
    factor=125/110
    assert original['width']==110 and scaled['width']==125
    assert scaled_file['uniform_scale_from_110']==size_source['uniform_world_scale']==factor
    assert original['source_outline_px']==scaled['source_outline_px']==size_source['same_eight_source_vertices']
    assert len(scaled['outline'])==8
    for key in ('height','spriteWidth','spriteHeight','pixel_to_world','spriteOffset','outline'):
        assert np.allclose(scaled[key],np.asarray(original[key])*factor,rtol=0,atol=1e-6),key
    assert abs(scaled['outline_area_world_squared']-original['outline_area_world_squared']*factor**2)<1e-6
    for name,surface in original['measurements'].items():
        assert scaled['measurements'][name]['pixel_segment']==surface['pixel_segment']
        for key in ('width_world','y_world'):
            assert abs(scaled['measurements'][name][key]-surface[key]*factor)<1e-6,(name,key)
    points=np.asarray(scaled['outline']);segments=np.roll(points,-1,axis=0)-points
    following=np.roll(segments,-1,axis=0)
    assert np.all(segments[:,0]*following[:,1]-segments[:,1]*following[:,0]>0),'fridge-r2 convexity'
    physical=json.loads((fridge_root/'PHYSICS_CHECK_125.json').read_text())
    assert physical['strictly_convex'] and physical['vertices']==8 and physical['expected_fixture_count']==1
    assert physical['texture_and_alpha_unchanged'] and physical['source_pixel_vertices_unchanged']
    assert 0<physical['boundary_distance_world']['max']<1
    for key in ('width','height','outline_area_world_squared'):assert physical[key]==scaled[key],key
    # The 150-wide trial retains the frozen 125 mapping. Its measured chamfer
    # error exceeds 1 unit; only the real bearing segments are required exact.
    trial_source=json.loads((fridge_root/'SOURCE_150.json').read_text())
    assert trial_source['status']=='accepted_for_current_trial_pending_runtime'
    assert trial_source['new_image_generation_calls']==0 and trial_source['raster_operations']==[]
    for file,expected in trial_source['outputs'].items():assert sha(fridge_root/file)==expected,file
    trial_file=json.loads((fridge_root/'GEOMETRY_150.json').read_text())
    assert trial_file['source_geometry_110_sha256']==sha(fridge_root/'GEOMETRY.json')
    assert trial_file['source_geometry_125_sha256']==sha(fridge_root/'GEOMETRY_125.json')
    trial=trial_file['assets'][0]
    assert trial['width']==150 and trial['status'].startswith('candidate_150_width_pending_runtime_review')
    assert trial_file['uniform_scale_from_110']==trial_source['uniform_scale_from_110']==150/110
    assert trial_source['uniform_scale_from_125']==150/125
    assert trial['source_outline_px']==scaled['source_outline_px'] and len(trial['outline'])==8
    for key in ('height','spriteWidth','spriteHeight','pixel_to_world','spriteOffset','outline'):
        assert np.allclose(trial[key],np.asarray(scaled[key])*1.2,rtol=0,atol=1e-6),key
    assert abs(trial['outline_area_world_squared']-scaled['outline_area_world_squared']*1.2**2)<1e-6
    for name,surface in scaled['measurements'].items():
        assert trial['measurements'][name]['pixel_segment']==surface['pixel_segment']
        for key in ('width_world','y_world'):
            assert abs(trial['measurements'][name][key]-surface[key]*1.2)<1e-6,(name,key)
    trial_physical=json.loads((fridge_root/'PHYSICS_CHECK_150.json').read_text())
    assert trial_physical['status']=='trial_candidate_exceeds_one_world_unit_limit_pending_runtime'
    assert trial_physical['passes_one_world_unit_limit'] is False and trial_physical['limit_not_relaxed']==1
    assert trial_physical['strictly_convex'] and trial_physical['vertices']==8
    assert trial_physical['same_pixels_and_same_source_vertices'] is True
    assert 1<trial_physical['boundary_distance_world']['max']<1.184
    assert abs(trial_physical['boundary_distance_world']['max']-physical['boundary_distance_world']['max']*1.2)<1e-6
    for key in ('width','height','outline_area_world_squared'):assert trial_physical[key]==trial[key],key
    # Recheck all actual alpha128 bearing pixels, not just the diagnostic booleans.
    for name,surface in trial['measurements'].items():
        (x0,y),(x1,y1)=surface['pixel_segment'];assert y==y1
        for x in range(x0,x1+1):
            ys=np.flatnonzero(sprite[:,x,3]>=128)
            assert len(ys) and (ys[0] if name=='top' else ys[-1])==y,(name,x)
        measured=trial_physical['bearing_surfaces'][name]
        assert measured['endpoints_inside_alpha128']==[True,True]
        assert measured['maximum_vertical_edge_difference_px']==measured['maximum_vertical_edge_difference_world']==0
    for row in difficulty['entries']:
        candidate=(ROOT/row['candidate']).resolve()
        assert candidate in difficulty_source_files and difficulty_source_files[candidate]==row['sha256'],row['id']
        assert sha(candidate)==row['sha256']==sha(project/row['import_path']),row['id']
        meta=json.loads(Path(str(project/row['import_path'])+'.meta').read_text())
        assert meta['uuid']==row['uuid'],row['id']
        size=Image.open(ROOT/row['candidate']).size
        frame=meta['subMetas']['f9941']['userData']
        assert (frame['rawWidth'],frame['rawHeight'])==size,row['id']
visual_r11_replacements={}
visual_r11_new=[]
if has_visual_r11:
    visual_r11=json.loads(visual_r11_file.read_text())
    assert visual_r11['revision']=='visual-r11'
    replacement_uuids={
        'bg_ground_city':'55b492a0-02aa-57a7-ae12-5fc00dfcc9b5',
        'bg_city_altitude':'d711b439-0443-582d-8906-935f848bf98d',
        'bg_space_altitude':'7bb14d35-5685-5e29-8257-a0bb9f9e6e9e',
        'result_btn_retry':'25db6570-53c6-50e3-9212-0d903fefdc8a'}
    new_ids={'result_title_sticker','result_close','result_confetti','bg_ground_foreground'}
    opaque_ids={'bg_ground_city','bg_city_altitude','bg_space_altitude'}
    rows=visual_r11['entries']
    assert len(rows)==8 and {r['id'] for r in rows}==set(replacement_uuids)|new_ids
    historical={r['id']:r for r in imports}
    assert not new_ids.intersection(historical)
    assert not set(replacement_uuids).intersection(difficulty_replacements)
    for row in rows:
        name=row['id']
        assert row['candidate']==f'design/visual-r11/assets/{name}.png',name
        assert row['import_path']==f'assets/batch0/art/{name}.png',name
        candidate=ROOT/row['candidate'];target=project/row['import_path']
        assert sha(candidate)==row['sha256']==sha(target),name
        meta=json.loads(Path(str(target)+'.meta').read_text())
        assert meta['importer']=='image' and meta['uuid']==row['uuid'],name
        assert re.fullmatch(r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}',row['uuid']),name
        frame=meta['subMetas']['f9941']
        assert frame['uuid']==row['uuid']+'@f9941' and frame['importer']=='sprite-frame',name
        assert meta['subMetas']['6c48a']['uuid']==row['uuid']+'@6c48a',name
        data=frame['userData']
        with Image.open(candidate) as im:
            im.load()
            assert im.format=='PNG' and im.mode in ('RGB','RGBA'),name
            assert (data['rawWidth'],data['rawHeight'])==(data['width'],data['height'])==im.size,name
            assert data['trimType']=='none' and not data['rotated'],name
            assert all(data[key]==0 for key in ('offsetX','offsetY','trimX','trimY')),name
            alpha=np.asarray(im.convert('RGBA'))[:,:,3]
            if name in replacement_uuids:
                assert row['kind']=='replacement' and row['uuid']==replacement_uuids[name],name
                assert row['previous_sha256']==historical[name]['sha256']!=row['sha256'],name
                assert row['import_path']==historical[name]['import_path'],name
                visual_r11_replacements[name]=row
            else:
                assert row['kind']=='new' and row['previous_sha256'] is None,name
                visual_r11_new.append(row)
            if name in opaque_ids:
                assert np.all(alpha==255),name+' background must cover without alpha holes'
            else:
                # The independent ground follows the tower; its sky must stay transparent.
                assert im.mode=='RGBA' and np.any(alpha==0) and np.any(alpha>0),name+' needs real transparent cutout alpha'
    imports += visual_r11_new
result_r13_new=[]
if has_result_r13:
    # R13 imports always retain their complete approval/hash checks. Its historical scope cannot
    # police later authorized code changes; Batch 1B has its own frozen successor baseline.
    result_r13_tools=runpy.run_path(str(ROOT/'design/result-r13/record_engine_build.py'))
    result_r13=result_r13_tools['verify_imports']()
    if has_batch1c:
        batch1c_tools=runpy.run_path(str(ROOT/'tools/record_batch1c_build.py'))
        batch1c_before,batch1c_current,_,_=batch1c_tools['verify_scope']()
        batch1b_tools=runpy.run_path(str(ROOT/'tools/record_batch1b_build.py'))
        batch1b_before=json.loads((ROOT/'review/evidence/batch1b/BEFORE.json').read_text())
    elif has_batch1b:
        batch1b_tools=runpy.run_path(str(ROOT/'tools/record_batch1b_build.py'))
        batch1b_before,batch1b_current,_,_=batch1b_tools['verify_scope']()
    else:
        result_r13_before,result_r13_current,_,_=result_r13_tools['verify_scope'](result_r13)
    result_r13_new=result_r13['entries']
    assert not {r['id'] for r in result_r13_new}.intersection(r['id'] for r in imports)
batch1c_art_new=[]
batch1c_art_replacements={}
if has_batch1c:
    batch1c_art=batch1c_tools['verify_art_imports'](batch1c_before)
    batch1c_art_new=[r for r in batch1c_art['entries'] if r['kind']=='new']
    batch1c_art_replacements={r['id']:r for r in batch1c_art['entries'] if r['kind']=='replacement'}
    assert len(batch1c_art_new)==10 and set(batch1c_art_replacements)=={'object_ice_block','object_burger'}
frames=set()
for r in imports:
    # Historical candidates remain immutable; authorized runtime replacements carry both hashes.
    assert sha(ROOT/r['candidate'])==r['sha256'],r['id']
    live=batch1c_art_replacements.get(r['id'],visual_r11_replacements.get(r['id'],difficulty_replacements.get(r['id'],r)))
    if live is not r:
        assert live['previous_sha256']==r['sha256'] and live['import_path']==r['import_path'],r['id']
    assert sha(project/r['import_path'])==live['sha256'],r['id']
    meta=json.loads(Path(str(project/r['import_path'])+'.meta').read_text())
    frames.add(meta['uuid']+'@f9941')
assert len(frames)==len(imports)==(50 if is_batch1a else 47)+(5 if has_home_r9 else 0)+(4 if has_home_r10 else 0)+(4 if has_shape_trial else 0)+len(visual_r11_new)
if has_visual_r11:
    assert len(imports)==67, 'R11 adds four images to the existing 63'
    historical_runtime_images={str(p.relative_to(project)) for p in (project/'assets').rglob('*.png')}-{r['import_path'] for r in result_r13_new+batch1c_art_new}
    assert historical_runtime_images=={r['import_path'] for r in imports},'R11 retains exactly 67 runtime images before the separate R13 additions'
if has_result_r13:
    imports += result_r13_new
    frames.update(row['uuid']+'@f9941' for row in result_r13_new)
    assert len(frames)==len(imports)==85, 'R13 adds exactly 18 images to the unchanged 67-image baseline'
    assert {str(p.relative_to(project)) for p in (project/'assets').rglob('*.png')}-{r['import_path'] for r in batch1c_art_new}=={r['import_path'] for r in imports}
if has_batch1c:
    imports += batch1c_art_new
    frames.update(row['uuid']+'@f9941' for row in batch1c_art_new)
    assert len(frames)==len(imports)==95
    assert {str(p.relative_to(project)) for p in (project/'assets').rglob('*.png')}=={r['import_path'] for r in imports}
audio_import_file=ROOT/'audio/BATCH1A_IMPORT_MANIFEST.json'
audio_imports=[]
a2_audio_imports=[]
a3_audio_import_file=ROOT/'audio/BATCH1B_AUDIO_IMPORT_MANIFEST.json'
a3_audio_imports=[]
batch1c_audio_imports=[]
if a3_audio_import_file.exists():
    assert has_batch1b, 'A3 audio belongs to the authorized Batch 1B integration'
    a3_audio_manifest=batch1b_tools['verify_audio_imports'](batch1b_before)
    a3_audio_imports=a3_audio_manifest['entries']
a3_audio_replacements={row['id']:row for row in a3_audio_imports if row['kind']=='replacement'}
if audio_import_file.exists():
    approved_audio=json.loads(audio_import_file.read_text())
    assert approved_audio['status']=='approved_for_current_use'
    a2_audio_imports=approved_audio['entries']
    assert len(a2_audio_imports)==18
    for row in a2_audio_imports:
        assert sha(ROOT/row['candidate'])==row['sha256'], 'Historical A2 candidate must remain unchanged'
        live=a3_audio_replacements.get(row['id'],row)
        if live is not row:
            assert live['previous_sha256']==row['sha256'] and live['import_path']==row['import_path']
        target=project/live['import_path']
        assert sha(ROOT/live['candidate'])==sha(target)==live['sha256']
        frames.add(json.loads(Path(str(target)+'.meta').read_text())['uuid'])
        audio_imports.append(live)
    for row in a3_audio_imports:
        if row['kind']=='new':
            audio_imports.append(row)
            frames.add(json.loads(Path(str(project/row['import_path'])+'.meta').read_text())['uuid'])
    if has_batch1c:
        batch1c_audio_imports=batch1c_tools['verify_audio_imports'](batch1c_before)['entries']
        audio_imports += batch1c_audio_imports
        frames.update(row['uuid'] for row in batch1c_audio_imports)
    assert {str(p.relative_to(project)) for p in (project/'assets').rglob('*.mp3')}=={r['import_path'] for r in audio_imports}
    assert len(audio_imports)==(22 if a3_audio_imports else 18)+(12 if has_batch1c else 0)
generated=json.loads((ROOT/'art/GENERATED_VISUAL_MANIFEST.json').read_text())
for row in generated['entries']:
    assert sha(ROOT/row['output'])==row['sha256']
    assert sha(Path(row['generated_source']))==row['source_sha256']
    assert row['input_images_uploaded'] is False
for row in json.loads((ROOT/'art/RAIL_COMPONENT_MANIFEST.json').read_text()):
    assert sha(ROOT/row['candidate'])==row['sha256']
    assert sha(project/row['source'])==row['source_sha256']
scenes=list((project/'assets').rglob('*.scene'));assert len(scenes)==4
sprite_count=0
referenced_shape_frames=set()
for p in scenes:
    data=json.loads(p.read_text())
    def walk(v):
        if isinstance(v,dict):
            if '__id__' in v:assert 0<=v['__id__']<len(data),(p,v)
            if '__uuid__' in v:
                assert v['__uuid__'] in frames,(p,v)
                if v['__uuid__'] in shape_frame_uuids:
                    assert p.name=='HUD.scene','Shape-trial frames must only be referenced by HUD'
                    referenced_shape_frames.add(v['__uuid__'])
            for x in v.values():walk(x)
        elif isinstance(v,list):
            for x in v:walk(x)
    walk(data)
    for n in data:
        assert n.get('__type__') not in ['cc.RigidBody2D','cc.BoxCollider2D','cc.PolygonCollider2D','cc.CircleCollider2D']
        if n.get('__type__')=='cc.Sprite':sprite_count+=1
        if n.get('__type__')=='cc.Widget' and n.get('_bottom',0)!=0:
            assert n['_alignFlags']&4,(p,n)
assert referenced_shape_frames==shape_frame_uuids,'HUD must reference all four shape-trial images'
encoded=json.loads((ROOT/'audio/ENCODED_MANIFEST.json').read_text())
assert encoded['script_sha256']==sha(ROOT/'tools/encode_audio.py')
for r in encoded['entries']:
    assert sha(ROOT/r['file'])==r['sha256'] and sha(ROOT/r['source_file'])==r['source_sha256']
    assert (ROOT/r['file']).stat().st_size==r['bytes']
assert sum(r['bytes'] for r in encoded['entries'])==encoded['encoded_bytes']
revision_file=ROOT/'audio/batch1a-v2/MANIFEST.json'
if revision_file.exists():
    revision=json.loads(revision_file.read_text())
    assert revision['script_sha256']==sha(ROOT/'tools/build_audio_revision.py')
    assert len(revision['entries'])==18 and revision['imported_into_game']==bool(audio_imports)
    if audio_imports:
        assert revision['status']=='approved_for_current_use'
        assert {r['id']:r['sha256'] for r in revision['entries']}=={r['id']:r['sha256'] for r in a2_audio_imports}
    for row in revision['entries']:
        assert sha(ROOT/row['master'])==row['master_sha256']
        assert sha(ROOT/row['file'])==row['sha256']
        for recipe in row['sources_and_edits']:
            assert sha(ROOT/recipe['file'])==recipe['sha256']
    if not audio_imports:assert not list((project/'assets').rglob('*.mp3')), 'Unapproved audio must stay outside game assets'
# Baseline comparison, not a fresh inventory replacing the prior one.
previous=json.loads((ROOT/'art/SOURCE_INVENTORY.json').read_text())
assert {r['path']:r['sha256'] for r in previous['files']}=={r['path']:r['sha256'] for r in inventory}

page=(ROOT/'review/index.html').read_text()
assert not re.search(r'<(?:script|link|img)[^>]+(?:src|href)=["\']https?://',page)
scripts=re.findall(r'<script>([\s\S]*?)</script>',page)
page_names=['index','layout','edge-review','engine','engine-player']
if is_batch1a:page_names+=['play','play-player','audio-1a']
if has_shape_trial:page_names+=['shapes']
if has_toilet_r2:page_names+=['toilet-r2']
if difficulty_file.exists():page_names+=['difficulty','difficulty-before-player']
if has_batch1c:page_names+=['audio-1c','batch1c']
for name in page_names:
    content=(ROOT/f'review/{name}.html').read_text()
    assert not re.search(r'<(?:script|link|img)[^>]+(?:src|href)=["\']https?://',content)
    check=Path('/private/tmp/zhynd-'+name+'-check.js')
    check.write_text('\n'.join(re.findall(r'<script>([\s\S]*?)</script>',content)))
    subprocess.run(['/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node','--check',str(check)],check=True,capture_output=True)
if has_batch1c:
    subprocess.run(['/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node','--check',str(ROOT/'review/batch1c-checks.js')],check=True,capture_output=True)

build_report='review/evidence/batch1a/BUILD_REPORT.json' if is_batch1a else 'review/evidence/BUILD_REPORT.json'
if has_home_r9:build_report='design/R9/evidence/BUILD_REPORT.json'
if has_home_r10:build_report='design/R10/evidence/BUILD_REPORT.json'
if has_shape_trial:build_report='review/evidence/gameplay-shapes/BUILD_REPORT.json'
if has_toilet_r2:build_report='review/evidence/gameplay-toilet-r2/BUILD_REPORT.json'
if (ROOT/'review/evidence/placement-wait-r1/BUILD_REPORT.json').exists():
    build_report='review/evidence/placement-wait-r1/BUILD_REPORT.json'
if (ROOT/'review/evidence/difficulty-r1/BUILD_REPORT.json').exists():
    build_report='review/evidence/difficulty-r1/BUILD_REPORT.json'
if has_visual_r11:build_report='design/visual-r11/evidence/BUILD_REPORT.json'
if has_result_r13:build_report='design/result-r13/engine/BUILD_REPORT.json'
if has_batch1b:build_report='review/evidence/batch1b/BUILD_REPORT.json'
if has_batch1c:build_report='review/evidence/batch1c/BUILD_REPORT.json'
build=json.loads((ROOT/build_report).read_text())
assert build['status']=='success'
if has_batch1c:
    batch1c_tools['verify_recorded_build'](build)
    assert build['runtime_file_sha256']==batch1c_current, 'Batch 1C inputs changed after the recorded build'
    assert build['runtime_counts']=={'.ts':12,'.scene':4,'.png':95,'.mp3':34}
    assert build['new_runtime_scripts']==['assets/batch1/game-music.ts']
    assert set(build['new_runtime_images'])=={row['import_path'] for row in batch1c_art_new}
    assert set(build['replaced_runtime_images'])=={row['import_path'] for row in batch1c_art_replacements.values()}
    assert set(build['new_runtime_audio'])=={row['import_path'] for row in batch1c_audio_imports}
    assert build['replaced_runtime_audio']==[]
    assert len(expected_scripts)==12 and len(audio_imports)==34
elif has_batch1b:
    batch1b_tools['verify_recorded_build'](build)
    assert build['runtime_file_sha256']==batch1b_current, 'Batch 1B inputs changed after the recorded build'
    assert build['runtime_counts']=={'.ts':11,'.scene':4,'.png':85,'.mp3':22 if a3_audio_imports else 18}
    assert build['new_runtime_scripts']==['assets/batch1/incident-state.ts']
    assert build['new_runtime_images']==[]
    assert set(build['new_runtime_audio'])=={row['import_path'] for row in a3_audio_imports if row['kind']=='new'}
    assert set(build['replaced_runtime_audio'])=={row['import_path'] for row in a3_audio_imports if row['kind']=='replacement'}
    assert len(expected_scripts)==11 and len(audio_imports)==(22 if a3_audio_imports else 18)
elif has_result_r13:
    assert build['revision']=='result-r13' and build['exit_code'] in (0,36) and build['typecheck_exit_code']==0
    assert build['log']=='temp/result-r13-build.stdout.log' and sha(project/build['log'])==build['log_sha256']
    assert build['import_manifest_sha256']==sha(result_r13_file)
    assert build['baseline_sha256']==sha(ROOT/'design/result-r13/engine/BEFORE.json')
    assert build['approved_artifact_sha256']==result_r13['approved_artifact_sha256']
    assert build['runtime_file_sha256']==result_r13_current, 'R13 runtime inputs changed after the recorded build'
    assert build['runtime_image_count']==85 and build['import_manifest_entries_verified']==18
    assert build['new_runtime_scripts']==[] and len(expected_scripts)==10 and len(audio_imports)==18
    assert set(build['new_runtime_images'])=={r['import_path'] for r in result_r13_new}
if has_visual_r11:
    assert {'assets/batch0/presentation/HeightBackdrop.ts','assets/batch0/presentation/ResultPresentation.ts'}<=set(build.get('code_and_settings_sha256',{})), 'R11 build must identify both changed presentation sources'
for relative,expected in build['output_sha256'].items():assert sha(project/'build/web-desktop'/relative)==expected
if has_visual_r11:
    assert set(build['scene_source_sha256'])=={p.name for p in scenes}
for name,expected in build['scene_source_sha256'].items():assert sha(project/'assets/batch0/scenes'/name)==expected
for name,expected in build.get('code_and_settings_sha256',{}).items():assert sha(project/name)==expected
presentation_count=1+int(has_home_r9)+int(has_visual_r11)
report={'status':'passed_integrity_only','source_png_count':len(inventory),
    'art_candidates':len(art['entries']),'next_candidates':sum('next_output' in r for r in art['entries']),
    'audio_candidates':len(audio['entries']),'source_scale_unchanged':True,
    'raw_audio_bytes':sum((ROOT/s['file']).stat().st_size for s in audio['entries']),
    'gameplay_scripts':len(expected_scripts)-presentation_count,'presentation_scripts':presentation_count,'generated_visual_candidates':len(generated['entries']),'scene_files':len(scenes),'static_sprite_references':sprite_count,'import_images':len(imports),'accepted_edge_repairs':len(approval),'encoded_audio_bytes':encoded['encoded_bytes'],'ui_correction_files_checked':len(corrections['entries'])+len(background['entries']),
    'build_report':build_report,'audio_revision2_files':18 if revision_file.exists() else 0,'imported_audio_files':len(audio_imports),
    'shape_trial_import_images':4 if has_shape_trial else 0,'shape_trial_next_pairs_checked':shape_next_pairs_checked,
    'difficulty_replacement_images':len(difficulty_replacements),
    'visual_r11_replacement_images':len(visual_r11_replacements),'visual_r11_new_images':len(visual_r11_new),
    'result_r13_new_images':len(result_r13_new),
    'batch1b_incident_module':has_batch1b,
    'batch1c_music_module':has_batch1c,'batch1c_new_images':len(batch1c_art_new),'batch1c_replacement_images':len(batch1c_art_replacements),
    'batch1c_audio_additions':len(batch1c_audio_imports),
    'runtime_audio_bytes':sum((project/row['import_path']).stat().st_size for row in audio_imports),
    'a3_audio_replacements':len(a3_audio_replacements),'a3_audio_additions':sum(row['kind']=='new' for row in a3_audio_imports),
    'shape_trial_art_status':'self_checked_candidate_not_user_final_art_approval' if has_shape_trial else 'not_imported',
    'not_proven':['Runtime behavior requires separate Batch 1C engine evidence; this report proves integrity only' if has_batch1c else 'Runtime evidence is separate: BATCH1A_ACCEPTANCE.md or historical STATIC_ACCEPTANCE.md','subjective sound quality','WeChat runtime/device performance','publication readiness']}
(ROOT/'review/INTEGRITY_REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False))
