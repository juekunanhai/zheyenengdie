"""Apply the visible flat-bun revision; preserve R3 assets and prior six ObjectSpecs."""
from pathlib import Path
import copy
import hashlib
import json
import re
import shutil
import runpy
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PREP = ROOT / 'preparation'
ART = PREP / 'design/batch1c'
R2 = ART / 'burger-r2'
BACKUP = PREP / 'review/evidence/batch1c/burger-before-r2'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()

def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

def main():
    assert not BACKUP.exists(), 'Revision has already been applied; do not overwrite historical evidence'
    previous_files = [ART/'GEOMETRY.json', ART/'GENERATION_RESULTS.json', ART/'ART_QA.json', ART/'PARAMETERS.json',
                      PREP/'art/BATCH1C_IMPORT_MANIFEST.json', ROOT/'assets/batch1/object-data.ts']
    previous_files += [ROOT/f'assets/batch0/art/{stem}.png{suffix}'
                       for stem in ['object_burger','next_burger'] for suffix in ['', '.meta']]
    for path in previous_files:
        target = BACKUP / path.relative_to(ROOT); target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)
    r2 = json.loads((R2/'GEOMETRY.json').read_text())
    geometry = copy.deepcopy(r2['geometry']); density = geometry.pop('density_for_total_mass_3_2')
    manifest = json.loads((ART/'GEOMETRY.json').read_text())
    row = next(item for item in manifest['objects'] if item['slug'] == 'burger')
    source = R2/'composite-original-coordinates.png'
    row.update(source=str(source.relative_to(ROOT)), source_sha256=sha(source), generated=True,
               local_processing=r2['composition'], geometry=geometry, geometry_audit=r2['geometry_audit'])
    for key in ['sprite','next']:
        row[key] = r2[key]; row[key+'_sha256'] = sha(ROOT/r2[key])
    row['revision_recipe'] = {'manifest':str((R2/'GEOMETRY.json').relative_to(ROOT)),
                              'sha256':sha(R2/'GEOMETRY.json'), 'script':str((R2/'prepare.py').relative_to(ROOT))}
    manifest['revisions'] = [{'id':'burger-r2', 'reason':'R3 real paper-on-burger slipped off the dome',
                              'apply_script':str(Path(__file__).relative_to(ROOT)), 'apply_script_sha256':sha(Path(__file__))}]
    write(ART/'GEOMETRY.json', manifest)
    request = json.loads((R2/'REFINE_REQUEST.json').read_text())
    generated = json.loads((ART/'GENERATION_RESULTS.json').read_text())
    generated['specs'].append({'slug':'burger', 'prompt':request['prompt'], 'source':str(R2/request['output']),
        'workspace_original':str((R2/request['output']).relative_to(ROOT)), 'original_sha256':sha(R2/request['output']),
        'refs':[str(R2/request['reference'])], 'reference_sha256':{str(R2/request['reference']):sha(R2/request['reference'])},
        'status':'upper_bun_redraw_composited_with_original_lower_pixels',
        'revision_manifest':str((R2/'GEOMETRY.json').relative_to(ROOT))})
    write(ART/'GENERATION_RESULTS.json', generated)
    imported = json.loads((PREP/'art/BATCH1C_IMPORT_MANIFEST.json').read_text())
    meta_for = runpy.run_path(str(PREP/'tools/import_batch1c_art.py'))['meta_for']
    for key in ['sprite','next']:
        source = ROOT/r2[key]; target = ROOT/'assets/batch0/art'/source.name
        item = next(item for item in imported['entries'] if item['id'] == target.stem)
        item['revision_before_sha256'] = sha(target)
        shutil.copyfile(source, target); meta_for(target, Image.open(source).size)
        item.update(candidate=str(source.relative_to(PREP)), sha256=sha(target), meta_sha256=sha(Path(str(target)+'.meta')))
    write(PREP/'art/BATCH1C_IMPORT_MANIFEST.json', imported)
    lines = [f"    burger: {{ kind: 'burger', width: {geometry['width']}, height: {geometry['height']}, circle: false,",
             f"        spriteWidth: {geometry['spriteWidth']}, spriteHeight: {geometry['spriteHeight']}, spriteOffset: {json.dumps(geometry['spriteOffset'])},",
             '        outline: [']
    points = [json.dumps(p,separators=(',', ':')) for p in geometry['outline']]
    for i in range(0,len(points),3): lines.append('            '+', '.join(points[i:i+3])+',')
    lines += ['        ],', f'        friction: 0.8, restitution: 0.01, density: {density},',
              '        contactAngularDamping: 6, contactImpactSpeed: 2.4,', '    },']
    path = ROOT/'assets/batch1/object-data.ts'; text = path.read_text()
    text, count = re.subn(r"    burger: \{ kind: 'burger',[\s\S]+?(?=    slipper:)", '\n'.join(lines)+'\n', text)
    assert count == 1; path.write_text(text)
    parameters = json.loads((ART/'PARAMETERS.json').read_text())
    item = next(item for item in parameters['parameters'] if item['kind']=='burger')
    item.update(area=r2['geometry_audit']['area_world_squared'], density=density, revision='burger-r2')
    write(ART/'PARAMETERS.json', parameters)
    art_qa = json.loads((ART/'ART_QA.json').read_text())
    item = next(item for item in art_qa['checks'] if item['slug']=='burger')
    item.update(pixel_size=list(Image.open(ROOT/r2['sprite']).size), native_physics='pending_r2_retest',
                revision_manifest=str((R2/'GEOMETRY.json').relative_to(ROOT)))
    image = Image.open(ROOT/r2['sprite']).convert('RGBA'); histogram = image.getchannel('A').histogram()
    item.update(opaque_pixels=sum(histogram[128:]), transparent_pixels=histogram[0])
    write(ART/'ART_QA.json',art_qa)
    print('Applied only burger Sprite/NEXT/meta/shape; total mass 3.2 and all other materials preserved.')

if __name__ == '__main__': main()
