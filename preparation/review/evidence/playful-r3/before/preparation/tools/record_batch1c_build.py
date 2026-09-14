"""Validate current 1C inputs and record an actual completed Web build, never inferred success."""
from pathlib import Path
from datetime import datetime
from types import SimpleNamespace
import argparse, copy, hashlib, json, re, runpy, subprocess, sys, uuid, wave
import numpy as np
from PIL import Image

PROJECT = Path(__file__).resolve().parents[2]
PREP = PROJECT / 'preparation'
EVIDENCE = PREP / 'review/evidence/batch1c'
BEFORE = EVIDENCE / 'BEFORE.json'
LOG = PROJECT / 'temp/batch1c-build.stdout.log'
BUILD = PROJECT / 'build/web-desktop'
OUT = EVIDENCE / 'BUILD_REPORT.json'
ART_IMPORT = PREP / 'art/BATCH1C_IMPORT_MANIFEST.json'
AUDIO_IMPORT = PREP / 'audio/BATCH1C_AUDIO_IMPORT_MANIFEST.json'
GEOMETRY = PREP / 'design/batch1c/GEOMETRY.json'
EXPECTED_COUNTS = {'.ts': 12, '.scene': 4, '.png': 95, '.mp3': 34}
NEW_OBJECTS = {'wooden_crate', 'ice_block', 'sofa', 'whale', 'burger', 'slipper'}
OLD_OBJECTS = {'cardboard_box', 'wood_plank', 'basketball', 'fridge', 'toilet', 'dumbbell'}
REPLACED_IMAGES = {'object_ice_block', 'object_burger'}
NEW_IMAGES = {'object_'+name for name in NEW_OBJECTS} | {'next_'+name for name in NEW_OBJECTS}
NEW_IMAGES -= REPLACED_IMAGES
NEW_AUDIO = {'bgm_city', 'bgm_cloud', 'bgm_space'} | {f'impact_{kind}_{i}' for kind in ('soft', 'ice', 'heavy') for i in (1, 2, 3)}
ALLOWED_SOURCE_CHANGES = {'assets/batch1/'+name+'.ts' for name in ('game-controller', 'game-audio', 'play-view', 'object-data')}
ALLOWED_SOURCE_CHANGES.add('assets/batch0/scenes/HUD.scene')
ALLOWED_SOURCE_CHANGES |= {f'assets/batch0/art/{name}.png{suffix}' for name in REPLACED_IMAGES for suffix in ('', '.meta')}
ADDED_FILES = {'assets/batch1/game-music.ts', 'assets/batch1/game-music.ts.meta'}
ADDED_FILES |= {f'assets/batch0/art/{name}.png{suffix}' for name in NEW_IMAGES for suffix in ('', '.meta')}
ADDED_FILES |= {f'assets/batch1/audio/{name}.mp3{suffix}' for name in NEW_AUDIO for suffix in ('', '.meta')}
NODE = '/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'
TYPESCRIPT = '/Applications/CocosCreator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def hashes(paths, base=PROJECT):
    return {str(path.relative_to(base)): sha(path) for path in sorted(paths)}


def baseline_text(relative, baseline):
    path = EVIDENCE / 'before' / (relative + '.txt')
    assert sha(path) == baseline[relative], 'Frozen 1B source changed: ' + relative
    return path.read_text()


def verify_historical_chain():
    saved = json.loads(BEFORE.read_text())
    assert saved['created_at'] and len(saved['files']) == 272
    baseline = {name: value for name, value in saved['files'].items() if not name.startswith('profiles/')}
    prior_path = PREP / 'review/evidence/batch1b/BUILD_REPORT.json'
    prior = json.loads(prior_path.read_text())
    assert prior['status'] == 'success' and prior['revision'] == 'batch1b'
    assert prior['exit_code'] in (0, 36) and prior['typecheck_exit_code'] == 0
    assert baseline == prior['runtime_file_sha256'] and len(baseline) == 260, '1C must inherit the actual final 1B inputs'
    assert prior['log_sha256'] == sha(PROJECT / prior['log'])
    assert prior['baseline_sha256'] == sha(PREP / 'review/evidence/batch1b/BEFORE.json')
    assert prior['recorder_sha256'] == sha(PREP / 'tools/record_batch1b_build.py'), 'Historical recorder changed'
    # Source/import checks remain meaningful for retained assets. Historical scope/build-output
    # checks intentionally do not run against later authorized runtime changes or overwritten build/.
    tools = runpy.run_path(str(PREP / 'tools/record_batch1b_build.py'))
    r13 = runpy.run_path(str(PREP / 'design/result-r13/record_engine_build.py'))
    r13['verify_imports']()
    assert prior['historical_r13_build_report_sha256'] == sha(PREP / 'design/result-r13/engine/BUILD_REPORT.json')
    assert prior['r13_import_manifest_sha256'] == sha(PREP / 'art/RESULT_R13_IMPORT_MANIFEST.json')
    assert prior['a3_audio_import_manifest_sha256'] == sha(PREP / 'audio/BATCH1B_AUDIO_IMPORT_MANIFEST.json')
    assert prior['a3_audio_source_manifest_sha256'] == sha(PREP / 'audio/foley-a3/MANIFEST.json')
    tools['verify_audio_imports'](json.loads((PREP / 'review/evidence/batch1b/BEFORE.json').read_text()))
    return baseline


def source_hash(path, expected, baseline):
    """Replaced old input images still exist as immutable historical candidates."""
    if path.is_file() and sha(path) == expected:
        return
    relative = str(path.relative_to(PROJECT))
    assert relative in {f'assets/batch0/art/{name}.png' for name in REPLACED_IMAGES}
    assert baseline[relative] == expected, 'Unexplained changed provenance source: ' + relative
    old = json.loads((PREP / 'art/BATCH0_IMPORT_MANIFEST.json').read_text())
    rows = [r for r in old if r['import_path'] == relative and r['sha256'] == expected]
    assert len(rows) == 1 and sha(PREP / rows[0]['candidate']) == expected, 'Original replaced pixels no longer traceable'


def verify_burger_revision(imported, data, generated, runtime_root=PROJECT):
    """The R3 failure led to one visible bun edit, not new hidden support or global assistance."""
    row = next(r for r in data['objects'] if r['slug'] == 'burger')
    if 'revision_recipe' not in row:
        return
    r2 = PREP / 'design/batch1c/burger-r2'
    backup = EVIDENCE / 'burger-before-r2'
    r3 = json.loads((EVIDENCE / 'BUILD_R3.json').read_text())
    assert r3['status'] == 'success' and r3['exit_code'] in (0, 36) and r3['typecheck_exit_code'] == 0
    assert sha(EVIDENCE / 'BUILD_R3.stdout.log') == r3['log_sha256']
    for path in (backup / 'assets').rglob('*'):
        if path.is_file():
            assert sha(path) == r3['runtime_file_sha256'][str(path.relative_to(backup))]
    old_geometry_path = backup / 'preparation/design/batch1c/GEOMETRY.json'
    old_import_path = backup / 'preparation/art/BATCH1C_IMPORT_MANIFEST.json'
    assert sha(old_geometry_path) == r3['geometry_manifest_sha256']
    assert sha(old_import_path) == r3['art_import_manifest_sha256']
    old_geometry = json.loads(old_geometry_path.read_text())
    for old_row in old_geometry['objects']:
        if old_row['slug'] != 'burger':
            assert old_row == next(r for r in data['objects'] if r['slug'] == old_row['slug'])
    old_generated = json.loads((backup / 'preparation/design/batch1c/GENERATION_RESULTS.json').read_text())
    assert generated['specs'][:4] == old_generated['specs'] and len(generated['specs']) == 5
    old_import = {r['id']: r for r in json.loads(old_import_path.read_text())['entries']}
    for new_import in imported['entries']:
        old = old_import[new_import['id']]
        if new_import['id'] in ('object_burger', 'next_burger'):
            assert new_import['revision_before_sha256'] == old['sha256'] == r3['runtime_file_sha256'][new_import['import_path']]
            for key in ('kind', 'previous_sha256', 'uuid', 'import_path'):
                assert new_import[key] == old[key], 'R2 must retain the original 1B-relative import history: '+key
        else:
            assert new_import == old, 'R2 changed an unrelated import: '+new_import['id']
    recipe = row['revision_recipe']; detail_path = PROJECT / recipe['manifest']
    assert detail_path == r2/'GEOMETRY.json' and sha(detail_path) == recipe['sha256']
    detail = json.loads(detail_path.read_text())
    assert PROJECT / recipe['script'] == r2/'prepare.py' and sha(r2/'prepare.py') == detail['script_sha256']
    revisions = data['revisions']; assert len(revisions) == 1 and revisions[0]['id'] == 'burger-r2'
    assert sha(PROJECT/revisions[0]['apply_script']) == revisions[0]['apply_script_sha256']
    for name, expected in detail['hashes'].items():
        assert sha(r2/name) == expected, 'R2 source/composite derivative changed: '+name
    request = json.loads((r2/'GENERATION_REQUEST.json').read_text())
    refine = json.loads((r2/'REFINE_REQUEST.json').read_text())
    assert request['tool'] == refine['tool'] == 'built-in image_gen' and request['prompt'].strip() and refine['prompt'].strip()
    assert sha(PROJECT/request['immutable_reference']) == request['reference_sha256'] == r3['runtime_image_sha256']['assets/batch0/art/object_burger.png']
    assert PROJECT/request['immutable_reference'] == r2/'reference-burger-r1.png'
    assert PROJECT/request['generated_file'] == r2/'generated-original.png'
    assert sha(PROJECT/request['generated_file']) == request['generated_sha256'] == detail['hashes'][refine['reference']]
    assert refine['reference'] == 'generated-original.png' and refine['output'] == 'generated-refined.png'
    new_generated = generated['specs'][-1]
    assert new_generated['slug'] == 'burger' and new_generated['prompt'] == refine['prompt']
    assert PROJECT/new_generated['workspace_original'] == r2/refine['output']
    assert new_generated['original_sha256'] == detail['hashes'][refine['output']]
    assert new_generated['revision_manifest'] == recipe['manifest']
    old_image = Image.open(r2/'reference-burger-r1.png').convert('RGBA')
    composite = Image.open(r2/'composite-original-coordinates.png').convert('RGBA')
    old_pixels, pixels = np.array(old_image), np.array(composite)
    composition = detail['composition']; assert old_pixels.shape == pixels.shape
    x0, y0, x1, y1 = composition['old_bun_bounds']
    assert 0 <= x0 < x1 <= old_image.width and 0 <= y0 < y1 <= old_image.height
    assert composition['unchanged_below_original_row'] == y1
    changed = np.any(old_pixels != pixels, axis=2)
    assert changed.any() and np.array_equal(old_pixels[y1:], pixels[y1:]), 'Lower ingredients changed'
    permitted = np.zeros(changed.shape, dtype=bool); permitted[y0:y1, x0:x1] = True
    assert not np.any(changed & ~permitted), 'Composite modified pixels outside the old upper-bun region'
    assert composition['all_lower_pixels_equal'] is True
    assert row['source'] == str((r2/'composite-original-coordinates.png').relative_to(PROJECT))
    assert row['local_processing'] == composition and row['geometry_audit'] == detail['geometry_audit']
    trimmed = composite.crop(composite.getchannel('A').getbbox())
    padded = Image.new('RGBA', (trimmed.width+16, trimmed.height+16)); padded.alpha_composite(trimmed, (8, 8))
    assert np.array_equal(np.array(padded), np.array(Image.open(PROJECT/row['sprite']).convert('RGBA'))), 'Final Sprite does not reproduce the local composite/crop'
    geometry = copy.deepcopy(detail['geometry']); density = geometry.pop('density_for_total_mass_3_2')
    assert row['geometry'] == geometry
    before = read_object_exports((backup/'assets/batch1/object-data.ts').read_text())
    now = read_object_exports((runtime_root/'assets/batch1/object-data.ts').read_text())
    for name, value in before.items():
        if name not in ('OBJECTS', 'CALIBRATION_SEQUENCE'):
            assert now[name] == value, 'R2 changed a non-object gameplay export: '+name
    assert now['CALIBRATION_SEQUENCE'] and all(kind in now['OBJECTS'] for kind in now['CALIBRATION_SEQUENCE']), 'Calibration sequence references an unknown object'
    for name, spec in before['OBJECTS'].items():
        if name != 'burger':
            assert now['OBJECTS'][name] == spec, 'R2 changed another object: '+name
    allowed = set(geometry) | {'density'}
    old_spec, spec = before['OBJECTS']['burger'], now['OBJECTS']['burger']
    assert {k:v for k,v in old_spec.items() if k not in allowed} == {k:v for k,v in spec.items() if k not in allowed}
    assert spec['density'] == density and abs(density*detail['geometry_audit']['area_world_squared']/1024-3.2) < 1e-7
    points = np.asarray(geometry['outline']); top = points[:, 1].max(); following = np.roll(points, -1, axis=0)
    segments = [[float(a[0]), float(b[0])] for a,b in zip(points,following) if abs(a[1]-top)<1e-6 and abs(b[1]-top)<1e-6]
    assert segments == detail['top_flat_segments'] and max(abs(b-a) for a,b in segments) >= 70
    # The actual alpha contour must show the flat bearing face, not just a flat physics line.
    image = Image.open(PROJECT/row['sprite']).convert('RGBA'); alpha = np.array(image)[:, :, 3]
    scale = geometry['spriteWidth']/image.width
    cx = image.width/2-geometry['spriteOffset'][0]/scale
    cy = image.height/2+geometry['spriteOffset'][1]/scale
    left, right = max(segments, key=lambda ab:abs(ab[1]-ab[0])); left,right = sorted((left,right))
    px0, px1, py = round(cx+left/scale), round(cx+right/scale), round(cy-top/scale)
    assert np.all(alpha[py,px0:px1+1]>=128) and np.all(alpha[:py,px0:px1+1]<128), 'Flat physics face is not the visible upper outline'


def verify_burger_r3(imported, data, generated):
    """Keep the R2 chain intact, then verify the independently frozen lower-bread edit."""
    folder = PREP/'design/batch1c/burger-r3'; backup = EVIDENCE/'burger-before-r3'
    prior = json.loads((EVIDENCE/'BUILD_R5.json').read_text())
    assert prior['status'] == 'success' and prior['exit_code'] in (0, 36) and prior['typecheck_exit_code'] == 0
    assert sha(EVIDENCE/'BUILD_R5.stdout.log') == prior['log_sha256']
    snapshot = json.loads((backup/'SHA256.json').read_text())
    for relative, expected in snapshot.items():
        assert sha(backup/relative) == expected, 'R5 frozen input changed: '+relative
        if relative.startswith('assets/'):
            assert prior['runtime_file_sha256'][relative] == expected
        elif relative in prior['art_revision_evidence_sha256']:
            assert prior['art_revision_evidence_sha256'][relative] == expected
    geometry_path = backup/'preparation/design/batch1c/GEOMETRY.json'
    import_path = backup/'preparation/art/BATCH1C_IMPORT_MANIFEST.json'
    assert sha(geometry_path) == prior['geometry_manifest_sha256']
    assert sha(import_path) == prior['art_import_manifest_sha256']
    old_data = json.loads(geometry_path.read_text()); old_imported = json.loads(import_path.read_text())
    old_generated = json.loads((backup/'preparation/design/batch1c/GENERATION_RESULTS.json').read_text())
    # Run every existing R2 check on its frozen R5 outputs, including original image,
    # both prompts, the upper-bun-only composite and the R3 -> R5 runtime change scope.
    verify_burger_revision(old_imported, old_data, old_generated, runtime_root=backup)
    assert generated['specs'] == old_generated['specs'], 'R3 lost or changed an original/R2 generation record'
    assert data['revisions'][:-1] == old_data['revisions'] and len(data['revisions']) == 2
    revision = data['revisions'][-1]
    assert revision['id'] == 'burger-r3' and sha(PROJECT/revision['apply_script']) == revision['apply_script_sha256']
    assert PROJECT/revision['apply_script'] == PREP/'tools/apply_batch1c_burger_r3.py'
    for old_row in old_data['objects']:
        if old_row['slug'] != 'burger':
            assert old_row == next(r for r in data['objects'] if r['slug'] == old_row['slug'])
    old_import = {r['id']:r for r in old_imported['entries']}
    for row in imported['entries']:
        old = old_import[row['id']]
        if row['id'] in ('object_burger', 'next_burger'):
            assert row['revision_before_sha256'] == old['sha256'] == prior['runtime_file_sha256'][row['import_path']]
            for key in ('kind', 'previous_sha256', 'uuid', 'import_path'):
                assert row[key] == old[key], 'R3 lost original import history: '+key
        else:
            assert row == old, 'R3 changed an unrelated import: '+row['id']
    row = next(r for r in data['objects'] if r['slug'] == 'burger'); recipe = row['revision_recipe']
    assert PROJECT/recipe['manifest'] == folder/'GEOMETRY.json' and sha(folder/'GEOMETRY.json') == recipe['sha256']
    detail = json.loads((folder/'GEOMETRY.json').read_text())
    assert PROJECT/recipe['script'] == folder/'prepare.py' and sha(folder/'prepare.py') == detail['script_sha256']
    assert len(generated['revisions']) == 1
    generation = generated['revisions'][0]
    assert generation['slug'] == 'burger' and generation['revision'] == 'burger-r3'
    assert generation['manifest'] == recipe['manifest'] and generation['manifest_sha256'] == recipe['sha256']
    assert PROJECT/generation['request'] == folder/'GENERATION_REQUEST.json'
    assert sha(folder/'GENERATION_REQUEST.json') == generation['request_sha256']
    request = json.loads((folder/'GENERATION_REQUEST.json').read_text())
    assert request['tool'] == 'built-in image_gen' and request['prompt'].strip()
    assert request['source'] == 'reference-burger-r2.png' and request['generated_output'] == 'generated-original.png'
    for name, expected in detail['hashes'].items():
        assert sha(folder/name) == expected, 'R3 source/composite derivative changed: '+name
    assert request['reference_sha256'] == detail['hashes'][request['source']] == prior['runtime_image_sha256']['assets/batch0/art/object_burger.png']
    assert request['generated_output_sha256'] == detail['hashes'][request['generated_output']]
    assert request['final_sprite_sha256'] == detail['hashes']['object_burger.png']
    assert request['preparation_script_sha256'] == detail['script_sha256']
    assert row['source'] == str((folder/'composite-original-coordinates.png').relative_to(PROJECT))
    assert row['local_processing'] == detail['composition'] and row['geometry_audit'] == detail['geometry_audit']
    old = Image.open(folder/request['source']).convert('RGBA')
    composite = Image.open(PROJECT/row['source']).convert('RGBA')
    original, actual = np.array(old), np.array(composite)
    composition = detail['composition']
    assert original.shape == actual.shape and composition['unchanged_above_original_row'] == 220
    assert composition['bread_only_transition_rows'] == [220, 228] and composition['all_upper_pixels_equal'] is True
    assert np.array_equal(original[:220], actual[:220]) and np.any(original[220:] != actual[220:]), 'R3 altered retained upper bun/ingredients or made no edit'
    # Rebuild only in memory. Never execute the revision's top-level image-writing script.
    art = runpy.run_path(str(PREP/'tools/prepare_batch1c_art.py'))
    import cv2
    new, extraction = art['remove_background'](Image.open(folder/request['generated_output']), 'burger')
    assert extraction == detail['extraction']
    def lower_mask(image):
        rgb = np.asarray(image.convert('RGB')).astype(int)
        orange = ((rgb[:,:,0]>rgb[:,:,1]+10)&(rgb[:,:,1]>rgb[:,:,2]+30)&(rgb[:,:,0]>rgb[:,:,2]+70)).astype(np.uint8)
        _, labels, stats, centers = cv2.connectedComponentsWithStats(orange)
        choices = [i for i in range(1,len(stats)) if centers[i][1]>image.height*.65]
        selected = max(choices,key=lambda i:stats[i,cv2.CC_STAT_AREA])
        contours,_ = cv2.findContours((labels==selected).astype(np.uint8),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
        mask = np.zeros(orange.shape,np.uint8)
        cv2.drawContours(mask,[max(contours,key=cv2.contourArea)],-1,255,-1)
        return Image.fromarray(cv2.dilate(mask,np.ones((3,3),np.uint8),iterations=1))
    old_mask, new_mask = lower_mask(old), lower_mask(new)
    old_bounds, new_bounds = old_mask.getbbox(), new_mask.getbbox()
    assert list(old_bounds) == composition['old_bun_bounds'] and list(new_bounds) == composition['generated_bun_bounds']
    piece = new.copy(); piece.putalpha(Image.fromarray(np.minimum(np.asarray(new.getchannel('A')),np.asarray(new_mask))))
    piece = piece.crop(new_bounds); factor = (old_bounds[2]-old_bounds[0])/piece.width
    assert factor == composition['new_bun_scale_uniform'] and composition['new_bun_offset_old_coordinates'] == list(old_bounds[:2])
    piece = piece.resize((old_bounds[2]-old_bounds[0],round(piece.height*factor)),Image.Resampling.LANCZOS)
    lower = Image.new('RGBA',old.size); lower.alpha_composite(piece,old_bounds[:2])
    oa,la = original.astype(float)/255,np.asarray(lower).astype(float)/255
    rebuilt = original.copy()
    for y in range(220,old.height):
        w = min(1,(y-219)/8)
        alpha = oa[y,:,3]*(1-w)+la[y,:,3]*w
        premul = oa[y,:,:3]*oa[y,:,3:4]*(1-w)+la[y,:,:3]*la[y,:,3:4]*w
        rgb = np.divide(premul,alpha[:,None],out=np.zeros_like(premul),where=alpha[:,None]>0)
        rebuilt[y] = np.rint(np.column_stack((rgb,alpha))*255).astype(np.uint8)
    assert np.array_equal(rebuilt,actual), 'R3 pixels differ from the recorded local premultiplied-alpha composition'
    trim = composite.crop(composite.getchannel('A').getbbox())
    padded = Image.new('RGBA',(trim.width+16,trim.height+16)); padded.alpha_composite(trim,(8,8))
    image = Image.open(PROJECT/row['sprite']).convert('RGBA')
    assert np.array_equal(np.asarray(padded),np.asarray(image)), 'R3 final Sprite differs from composite/crop'
    geometry = copy.deepcopy(detail['geometry']); density = geometry.pop('density_for_total_mass_3_2')
    derived,_,audit = art['points'](image,130)
    assert derived == geometry == row['geometry'] and audit == detail['geometry_audit'], 'R3 geometry no longer follows actual alpha'
    before = read_object_exports((backup/'assets/batch1/object-data.ts').read_text())
    now = read_object_exports((PROJECT/'assets/batch1/object-data.ts').read_text())
    assert {k:v for k,v in before.items() if k not in ('OBJECTS','CALIBRATION_SEQUENCE')} == {k:v for k,v in now.items() if k not in ('OBJECTS','CALIBRATION_SEQUENCE')}, 'R3 changed a non-object gameplay export'
    assert now['CALIBRATION_SEQUENCE'] and all(kind in now['OBJECTS'] for kind in now['CALIBRATION_SEQUENCE']), 'Calibration sequence references an unknown object'
    assert set(before['OBJECTS']) == set(now['OBJECTS'])
    for name,spec in before['OBJECTS'].items():
        if name != 'burger':
            assert now['OBJECTS'][name] == spec, 'R3 changed another object: '+name
    allowed = set(geometry)|{'density'}; spec = now['OBJECTS']['burger']; old_spec = before['OBJECTS']['burger']
    assert {k:v for k,v in old_spec.items() if k not in allowed} == {k:v for k,v in spec.items() if k not in allowed}
    assert spec['density'] == density and abs(density*audit['area_world_squared']/1024-3.2)<1e-7
    points = np.asarray(geometry['outline']); following = np.roll(points,-1,axis=0); alpha = np.asarray(image)[:,:,3]
    scale = geometry['spriteWidth']/image.width
    cx,cy = image.width/2-geometry['spriteOffset'][0]/scale,image.height/2+geometry['spriteOffset'][1]/scale
    for face,height in (('top',points[:,1].max()),('bottom',points[:,1].min())):
        segments = [[float(a[0]),float(b[0])] for a,b in zip(points,following) if abs(a[1]-height)<1e-6 and abs(b[1]-height)<1e-6]
        assert segments == detail['flat_segments'][face] and max(abs(b-a) for a,b in segments)>=70
        left,right = sorted(max(segments,key=lambda ab:abs(ab[1]-ab[0])))
        x0,x1,y = round(cx+left/scale),round(cx+right/scale),round(cy-height/scale)
        outside = alpha[:y,x0:x1+1] if face=='top' else alpha[y+1:,x0:x1+1]
        assert np.all(outside<128), 'R3 flat '+face+' lies inside the visible alpha silhouette'
        # The declared 0.5-world-unit simplification can span a one-pixel antialiased
        # ripple. Check every column against its actual outermost solid alpha pixel.
        for x in range(x0,x1+1):
            solid = np.flatnonzero(alpha[:,x]>=128); assert len(solid)
            boundary = solid[0] if face=='top' else solid[-1]
            assert abs(boundary-y)*scale <= audit['epsilon_world']+1e-6, 'R3 flat '+face+' exceeds its recorded contour tolerance'


def verify_art_imports(baseline):
    imported = json.loads(ART_IMPORT.read_text())
    assert imported['geometry_manifest'] == 'design/batch1c/GEOMETRY.json' and imported['status'].strip()
    rows = imported['entries']
    assert len(rows) == 12 and {r['id'] for r in rows} == NEW_IMAGES | REPLACED_IMAGES
    data = json.loads(GEOMETRY.read_text())
    assert data['script_sha256'] == sha(PREP / 'tools/prepare_batch1c_art.py')
    assert data['no_nonuniform_stretch'] and data['original_scale_file_unchanged']
    objects = {r['slug']: r for r in data['objects']}
    assert set(objects) == NEW_OBJECTS
    candidates = {}
    for name, row in objects.items():
        source_hash(PROJECT / row['source'], row['source_sha256'], baseline)
        sprite, silhouette = PROJECT / row['sprite'], PROJECT / row['next']
        assert sha(sprite) == row['sprite_sha256'] and sha(silhouette) == row['next_sha256'], name
        a, b = np.array(Image.open(sprite).convert('RGBA')), np.array(Image.open(silhouette).convert('RGBA'))
        assert a.shape == b.shape and np.array_equal(a[:, :, 3], b[:, :, 3]), name + ' NEXT alpha differs'
        colors = np.unique(b[b[:, :, 3] > 0, :3], axis=0)
        assert colors.shape == (1, 3) and colors[0].tolist() == [218, 235, 255], name + ' NEXT is not a pure silhouette'
        assert np.any(a[:, :, 3] == 0) and np.any(a[:, :, 3] > 127), name
        geometry = row['geometry']; width_px, height_px = Image.open(sprite).size
        assert abs(geometry['spriteWidth']/width_px-geometry['spriteHeight']/height_px) < 1e-8, name + ' nonuniform Sprite scale'
        points = np.asarray(geometry['outline'])
        assert points.ndim == 2 and points.shape[1] == 2 and len(points) >= 3 and np.isfinite(points).all()
        assert np.allclose(np.ptp(points,axis=0), [geometry['width'],geometry['height']], atol=1e-5,rtol=0), name + ' declared size differs from outline'
        candidates['object_'+name] = sprite
        candidates['next_'+name] = silhouette
    generated = json.loads((PREP / 'design/batch1c/GENERATION_RESULTS.json').read_text())
    generated_names = {'wooden_crate', 'ice_block', 'sofa', 'whale'}
    if 'revision_recipe' in objects['burger']:
        generated_names.add('burger')
    assert len(generated['specs']) == len(generated_names) and {r['slug'] for r in generated['specs']} == generated_names
    for row in generated['specs']:
        assert row['prompt'].strip() and sha(PROJECT / row['workspace_original']) == row['original_sha256']
        for path, expected in row['reference_sha256'].items():
            source_hash(Path(path), expected, baseline)
    if objects['burger'].get('revision_recipe',{}).get('manifest','').endswith('burger-r3/GEOMETRY.json'):
        verify_burger_r3(imported, data, generated)
    else:
        verify_burger_revision(imported, data, generated)
    old_uuids = {json.loads((PROJECT / name).read_text()).get('uuid') for name in baseline if name.endswith('.meta')}
    seen = set()
    for row in rows:
        name = row['id']; target = PROJECT / row['import_path']
        assert row['import_path'] == f'assets/batch0/art/{name}.png'
        assert (PREP / row['candidate']).resolve() == candidates[name].resolve()
        assert sha(candidates[name]) == row['sha256'] == sha(target), name
        meta_path = Path(str(target) + '.meta'); meta = json.loads(meta_path.read_text())
        assert row['meta_sha256'] == sha(meta_path) and meta['uuid'] == row['uuid']
        assert meta['importer'] == 'image' and meta['imported'] is True
        assert re.fullmatch(r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}', row['uuid'])
        frame = meta['subMetas']['f9941']; texture = meta['subMetas']['6c48a']
        assert frame['uuid'] == row['uuid'] + '@f9941' and texture['uuid'] == row['uuid'] + '@6c48a'
        assert frame['importer'] == 'sprite-frame' and texture['importer'] == 'texture'
        frame_data = frame['userData']; size = Image.open(target).size
        assert (frame_data['rawWidth'], frame_data['rawHeight']) == (frame_data['width'], frame_data['height']) == size
        assert frame_data['trimType'] == 'none' and not frame_data['rotated']
        assert all(frame_data[key] == 0 for key in ('offsetX', 'offsetY', 'trimX', 'trimY'))
        if name in REPLACED_IMAGES:
            assert row['kind'] == 'replacement' and baseline[row['import_path']] == row['previous_sha256'] != row['sha256']
            # Original Batch 0 metas use uuid5(project UUID, runtime-relative image path).
            namespace = uuid.UUID(json.loads(baseline_text('package.json', baseline))['uuid'])
            assert row['uuid'] == str(uuid.uuid5(namespace, row['import_path']))
        else:
            assert row['kind'] == 'new' and row['previous_sha256'] is None and row['uuid'] not in old_uuids
        assert row['uuid'] not in seen; seen.add(row['uuid'])
    return imported


def verify_audio_imports(baseline):
    imported = json.loads(AUDIO_IMPORT.read_text())
    assert imported['status'] == 'authorized_for_current_use' and imported['listening_status'] == 'not_reviewed'
    assert imported['candidate_manifest'] == 'audio/batch1c/MANIFEST.json'
    candidate = json.loads((PREP / imported['candidate_manifest']).read_text())
    assert candidate['status'] == imported['status'] and candidate['listening_status'] == 'not_reviewed'
    assert candidate['script_sha256'] == sha(PREP / 'tools/build_audio_batch1c.py')
    assert len(candidate['license_files']) >= 2, 'Keep both author/CC0 evidence and Kenney license'
    for row in candidate['license_files']:
        assert sha(PREP / row['file']) == row['sha256']
    provenance = json.loads((PREP / 'audio/sources/batch1c/SOURCES.json').read_text())
    assert len(provenance) == 1 and provenance[0]['license'] == 'CC0-1.0'
    for row in provenance:
        assert sha(PROJECT / row['file']) == row['sha256']
        assert sha(PROJECT / row['page_and_license_evidence']) == row['page_and_license_evidence_sha256']
    entries = {r['id']: r for r in candidate['entries']}
    assert len(imported['entries']) == len(entries) == 12 and set(entries) == NEW_AUDIO
    music = []
    for row in imported['entries']:
        name = row['id']; entry = entries[name]; path = PROJECT / row['import_path']
        assert row['candidate'] == entry['file'] == f'audio/batch1c/encoded/{name}.mp3'
        assert row['import_path'] == f'assets/batch1/audio/{name}.mp3' and row['import_path'] not in baseline
        assert sha(path) == sha(PREP / row['candidate']) == row['sha256'] == entry['sha256']
        assert path.stat().st_size == entry['bytes'] and entry['sample_rate'] == 44100
        assert sha(PREP / entry['master']) == entry['master_sha256']
        with wave.open(str(PREP / entry['master']), 'rb') as wav:
            assert wav.getsampwidth() == 2 and wav.getframerate() == 44100 and wav.getnchannels() == entry['channels']
            assert abs(wav.getnframes()/44100-entry['duration_s']) < .001
        if name.startswith('bgm_'):
            assert entry['kind'] == 'music' and entry['channels'] == 2 and entry['duration_s'] == 35.64
            assert entry['loop_check']['decoded_sample_count'] == 1571724
            assert entry['loop_check']['decoded_seam_jump_dbfs'] < -45
            music.append(entry)
        else:
            assert entry['kind'] == 'impact' and entry['channels'] == 1 and 0 < entry['duration_s'] < 1
        assert entry['sources_and_edits'] and entry['decode_peak_dbfs'] < -1.94
        for recipe in entry['sources_and_edits']:
            assert sha(PREP / recipe['file']) == recipe['sha256'] and recipe['license'] == 'CC0-1.0'
            assert recipe['author'] and recipe['page_url'].startswith('https://')
            if 'rate' in recipe:
                assert recipe['rate'] == 1
            else:
                assert recipe['pitch_or_speed_change'] is False and recipe['phrase_repetitions'] == 4
        meta_path = Path(str(path)+'.meta'); meta = json.loads(meta_path.read_text())
        assert sha(meta_path) == row['meta_sha256'] and meta['uuid'] == row['uuid']
        assert meta['importer'] == 'audio-clip' and meta['imported'] is True
    assert len(music) == 3 and len({r['sources_and_edits'][0]['sha256'] for r in music}) == 1
    return imported


def read_object_exports(source):
    # Use the installed compiler to erase TypeScript, then evaluate the existing pure data module.
    script = "const ts=require(process.argv[1]),vm=require('vm');let s='';process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>{const e={};vm.runInNewContext(ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:e});for(const k in e)if(typeof e[k]==='function')e[k]=e[k].toString();process.stdout.write(JSON.stringify(e));});"
    result = subprocess.run([NODE, '-e', script, TYPESCRIPT], input=source, text=True, capture_output=True, check=True)
    return json.loads(result.stdout)


def verify_restricted_changes(baseline, art, audio):
    relative = 'assets/batch1/object-data.ts'
    old = read_object_exports(baseline_text(relative, baseline))
    new = read_object_exports((PROJECT / relative).read_text())
    parameters = json.loads((PREP/'design/batch1c/PARAMETERS.json').read_text())
    assert parameters['sequence'] == new['CALIBRATION_SEQUENCE'], 'Documented calibration sequence differs from current runtime'
    assert set(old['OBJECTS']) == OLD_OBJECTS and set(new['OBJECTS']) == OLD_OBJECTS | NEW_OBJECTS
    for name in OLD_OBJECTS:
        assert old['OBJECTS'][name] == new['OBJECTS'][name], 'Accepted object changed: ' + name
    for name in old.keys() - {'OBJECTS', 'CALIBRATION_SEQUENCE'}:
        assert new[name] == old[name], 'Existing physics/difficulty/coordinate helper changed: ' + name
    for row in json.loads(GEOMETRY.read_text())['objects']:
        for field, value in row['geometry'].items():
            assert new['OBJECTS'][row['slug']][field] == value, f"Runtime geometry differs: {row['slug']}/{field}"
    scene = 'assets/batch0/scenes/HUD.scene'
    original = json.loads(baseline_text(scene, baseline)); current = json.loads((PROJECT / scene).read_text())
    assert len(original) == len(current)
    controllers = [i for i, row in enumerate(original) if 'frames' in row and 'approvedSounds' in row]
    assert len(controllers) == 1
    index = controllers[0]; normalized = copy.deepcopy(current)
    for field, additions in [('frames', [{'__uuid__':r['uuid']+'@f9941', '__expectedType__':'cc.SpriteFrame'} for r in art['entries']]),
                             ('approvedSounds', [{'__uuid__':r['uuid'], '__expectedType__':'cc.AudioClip'} for r in audio['entries']])]:
        previous = original[index][field]; expected = [r for r in additions if r not in previous]
        now = current[index][field]
        assert now[:len(previous)] == previous, 'Old HUD references changed: ' + field
        assert sorted(json.dumps(r,sort_keys=True) for r in now[len(previous):]) == sorted(json.dumps(r,sort_keys=True) for r in expected)
        normalized[index][field] = previous
    assert normalized == original, 'HUD changed beyond the new asset/audio references'


def verify_scope():
    baseline = verify_historical_chain()
    files = [path for folder in ('assets', 'settings') for path in (PROJECT/folder).rglob('*') if path.is_file()]
    files += [PROJECT/'package.json', PROJECT/'tsconfig.json']
    current = hashes(files)
    assert set(current)-set(baseline) == ADDED_FILES, 'Unexpected new runtime/config file set'
    assert not set(baseline)-set(current), 'Existing runtime/config input removed'
    protected = {name:value for name,value in baseline.items() if name not in ALLOWED_SOURCE_CHANGES}
    changed = [name for name,value in protected.items() if current[name] != value]
    assert not changed, 'Protected 1B art/audio/physics/scene/config changed: ' + str(changed)
    for suffix, expected in EXPECTED_COUNTS.items():
        assert sum(name.startswith('assets/') and name.endswith(suffix) for name in current) == expected, suffix
    assert not any(name.startswith('assets/') and name.endswith('.js') for name in current)
    art = verify_art_imports(baseline); audio = verify_audio_imports(baseline)
    verify_restricted_changes(baseline, art, audio)
    new_metas = [PROJECT/name for name in ADDED_FILES if name.endswith('.meta')]
    old_ids = {json.loads((PROJECT/name).read_text()).get('uuid') for name in baseline if name.endswith('.meta')}
    new_ids = [json.loads(path.read_text()).get('uuid') for path in new_metas]
    assert len(new_ids) == len(set(new_ids)) and not old_ids.intersection(new_ids)
    meta = json.loads((PROJECT/'assets/batch1/game-music.ts.meta').read_text())
    assert meta['importer'] == 'typescript' and meta['imported'] is True
    return baseline, current, protected, files


def stamp(log, marker):
    matches = list(re.finditer(r'(\d{4}-\d{1,2}-\d{1,2} \d{2}:\d{2}:\d{2}) - [^\n]*' + marker, log))
    assert matches, 'Missing actual Creator log marker: ' + marker
    return datetime.strptime(matches[-1][1], '%Y-%m-%d %H:%M:%S').timestamp(), matches[-1].start()


def record(args, prior_input_hashes=None):
    assert args.exit_code in (0, 36), 'Actual Creator process failed'
    assert args.typecheck_exit_code == 0, 'Actual TypeScript process failed'
    log = LOG.read_text(); started, start_index = stamp(log, r'Start build task, options:')
    completed, end_index = stamp(log, r'build task\(web-desktop\) in \d+!')
    assert end_index > start_index and completed >= started, 'Completion predates latest start'
    baseline, current, protected, files = verify_scope()
    inputs = [p for p in files if p.suffix != '.meta']; latest = max(inputs, key=lambda p:p.stat().st_mtime)
    if prior_input_hashes is None:
        assert latest.stat().st_mtime < started+1, 'Build predates current input: ' + str(latest.relative_to(PROJECT))
    else:
        # Revalidation only: Creator can rewrite identical settings during another
        # platform build. Runtime sources never receive this timestamp exception.
        assert current == prior_input_hashes, 'Frozen build input content changed'
        for path in inputs:
            if path.stat().st_mtime >= started+1:
                assert str(path.relative_to(PROJECT)).startswith('settings/'), 'Build predates runtime source: '+str(path.relative_to(PROJECT))
    scripts = sorted((PROJECT/'assets').rglob('*.ts')); scenes = sorted((PROJECT/'assets').rglob('*.scene'))
    configs = [p for p in files if str(p.relative_to(PROJECT)).startswith('settings/')] + [PROJECT/'package.json', PROJECT/'tsconfig.json']
    bundle = BUILD/'assets/main/index.js'
    assert bundle.stat().st_mtime >= max(p.stat().st_mtime for p in scripts)
    assert started-1 <= bundle.stat().st_mtime <= completed+1 and LOG.stat().st_mtime >= completed
    outputs = [p for p in BUILD.rglob('*') if p.is_file()]
    assert outputs and (BUILD/'src/settings.json').is_file()
    revision_evidence = []
    if (PREP/'design/batch1c/burger-r2/GEOMETRY.json').is_file():
        revision_evidence = [PREP/'design/batch1c/GENERATION_REQUESTS.json', PREP/'design/batch1c/GENERATION_RESULTS.json',
                             PREP/'design/batch1c/PARAMETERS.json',
                             PREP/'tools/apply_batch1c_burger_r2.py']
        revision_evidence += [PREP/'design/batch1c/burger-r2'/name for name in
                              ('GENERATION_REQUEST.json','REFINE_REQUEST.json','prepare.py','GEOMETRY.json')]
    if (PREP/'design/batch1c/burger-r3/GEOMETRY.json').is_file():
        revision_evidence += [PREP/'tools/apply_batch1c_burger_r3.py', EVIDENCE/'burger-before-r3/SHA256.json']
        revision_evidence += [PREP/'design/batch1c/burger-r3'/name for name in
                              ('GENERATION_REQUEST.json','prepare.py','GEOMETRY.json','ART_QA.json')]
    return {'status':'success', 'revision':'batch1c', 'engine':'3.8.8', 'platform':'web-desktop',
            'recorded_at':datetime.now().astimezone().isoformat(), 'exit_code':args.exit_code, 'typecheck_exit_code':args.typecheck_exit_code,
            'execution_result_source':'Caller-supplied actual exits; latest Creator start/completion and fresh current input/output timestamps independently checked.',
            'command':f"CocosCreator --project {PROJECT} --build 'platform=web-desktop;debug=true'",
            'log':str(LOG.relative_to(PROJECT)), 'log_sha256':sha(LOG),
            'log_warning_or_error_lines':[line for line in log.splitlines() if re.search(r'\b(?:warn(?:ing)?|[a-z]*error|failed)\b',line,re.I)],
            'freshness':{'build_started_local':datetime.fromtimestamp(started).astimezone().isoformat(),
                         'build_completed_local':datetime.fromtimestamp(completed).astimezone().isoformat(),
                         'latest_input':str(latest.relative_to(PROJECT)), 'latest_input_mtime':latest.stat().st_mtime,
                         'main_bundle_mtime':bundle.stat().st_mtime, 'timestamp_tolerance_seconds':1,
                         'note':'Non-meta runtime/settings inputs precede build. Imported metas checked semantically and hashed. Mutable profiles excluded.'},
            'output_sha256':hashes(outputs,BUILD), 'code_and_settings_sha256':hashes(scripts+configs),
            'scene_source_sha256':{p.name:sha(p) for p in scenes}, 'runtime_file_sha256':current,
            'runtime_counts':EXPECTED_COUNTS, 'runtime_image_count':95, 'runtime_audio_count':34,
            'runtime_image_sha256':{name:value for name,value in current.items() if name.endswith('.png')},
            'asset_meta_sha256':{name:value for name,value in current.items() if name.endswith('.meta')},
            'baseline_sha256':sha(BEFORE), 'historical_batch1b_build_report_sha256':sha(PREP/'review/evidence/batch1b/BUILD_REPORT.json'),
            'art_import_manifest_sha256':sha(ART_IMPORT), 'geometry_manifest_sha256':sha(GEOMETRY),
            'art_revision_evidence_sha256':hashes(revision_evidence),
            'audio_import_manifest_sha256':sha(AUDIO_IMPORT), 'audio_source_manifest_sha256':sha(PREP/'audio/batch1c/MANIFEST.json'),
            'recorder_sha256':sha(Path(__file__)), 'protected_unchanged_sha256':protected,
            'changed_existing_sources':sorted(name for name in baseline if current[name] != baseline[name]),
            'new_runtime_scripts':['assets/batch1/game-music.ts'],
            'new_runtime_images':sorted(f'assets/batch0/art/{name}.png' for name in NEW_IMAGES),
            'replaced_runtime_images':sorted(f'assets/batch0/art/{name}.png' for name in REPLACED_IMAGES),
            'new_runtime_audio':sorted(f'assets/batch1/audio/{name}.mp3' for name in NEW_AUDIO), 'replaced_runtime_audio':[],
            'restricted_change_checks':['Final 1B runtime is the frozen input baseline; profiles excluded',
                'Six existing ObjectSpecs and coordinate/difficulty helpers preserved; six new geometries match source',
                'HUD only appends new image/audio references; existing layout preserved',
                'All prior 22 audio files/metas, tower-world, incident-state, HeightBackdrop and three other scenes unchanged',
                'Historical R13/A3 source checks retained without applying their old code scope to 1C',
                'Twelve new art imports and twelve natural audio imports verified against source/recipe/license hashes'],
            'not_proven':['Real Cocos geometry/audio/lifecycle behavior; separate runtime evidence required',
                          'User subjective new-art/music acceptance', 'WeChat device behavior or performance', 'Publication readiness']}


def verify_recorded_build(saved):
    assert saved['status'] == 'success' and saved['revision'] == 'batch1c'
    archived_recorder = None
    if saved['recorder_sha256'] != sha(Path(__file__)):
        # One explicit frozen predecessor, not an unrestricted recorder exemption.
        archived_recorder = EVIDENCE/'record_batch1c_build_R7.py'
        assert sha(archived_recorder) == saved['recorder_sha256'], 'Unknown historical recorder'
        assert saved == json.loads((EVIDENCE/'BUILD_R7.json').read_text()), 'Frozen R7 build report changed'
    fresh = record(SimpleNamespace(exit_code=saved['exit_code'], typecheck_exit_code=saved['typecheck_exit_code']),
                   prior_input_hashes=saved['runtime_file_sha256'])
    assert set(saved) == set(fresh)
    for key in fresh:
        if key == 'freshness':
            for field in fresh[key]:
                if field not in ('latest_input', 'latest_input_mtime'):
                    assert saved[key][field] == fresh[key][field], '1C build timing evidence changed: '+field
        elif key not in ('recorded_at', 'recorder_sha256'):
            assert saved[key] == fresh[key], '1C build evidence no longer matches current files: '+key
    started = datetime.fromisoformat(saved['freshness']['build_started_local']).timestamp()
    rewritten_settings = {name:{'sha256':value,'observed_mtime':(PROJECT/name).stat().st_mtime}
                          for name,value in fresh['runtime_file_sha256'].items()
                          if name.startswith('settings/') and (PROJECT/name).stat().st_mtime >= started+1}
    return {'status':'passed_existing_build_integrity','new_build_recorded':False,
            'original_recorded_at':saved['recorded_at'], 'current_recorder_sha256':fresh['recorder_sha256'],
            'archived_recorder':str(archived_recorder.relative_to(PROJECT)) if archived_recorder else None,
            'original_recorder_sha256':saved['recorder_sha256'], 'identical_settings_rewritten':rewritten_settings,
            'input_hashes_checked':len(fresh['runtime_file_sha256']), 'output_hashes_checked':len(fresh['output_sha256']),
            'boundary':'Original exits, log, all input/output/provenance hashes and scope retained; only byte-identical settings mtime may advance. Profiles remain excluded as before.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exit-code',type=int,required=True)
    parser.add_argument('--typecheck-exit-code',type=int,required=True)
    args = parser.parse_args()
    try:
        report = record(args)
    except (AssertionError,OSError,KeyError,ValueError,TypeError,subprocess.CalledProcessError) as error:
        report = {'status':'failed','revision':'batch1c','recorded_at':datetime.now().astimezone().isoformat(),
                  'error':str(error),'exit_code':args.exit_code,'typecheck_exit_code':args.typecheck_exit_code,
                  'log':str(LOG.relative_to(PROJECT)),'log_sha256':sha(LOG) if LOG.is_file() else None,
                  'execution_result_source':'Actual exits could not be verified; no successful build claimed.'}
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'status':report['status'],'report':str(OUT),'error':report.get('error')},ensure_ascii=False))
    return 0 if report['status']=='success' else 1


if __name__ == '__main__':
    sys.exit(main())
