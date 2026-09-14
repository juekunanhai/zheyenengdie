"""Apply the independently tested flat lower bun, retaining the R2 generation chain."""
from pathlib import Path
import copy
import hashlib
import json
import re
import runpy
import shutil
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PREP = ROOT/'preparation'
ART = PREP/'design/batch1c'
REV = ART/'burger-r3'
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()

def write(path, value):
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')

def main():
    frozen = json.loads((PREP/'review/evidence/batch1c/burger-before-r3/SHA256.json').read_text())
    for path, expected in frozen.items():
        if path.endswith(('GEOMETRY.json','GENERATION_RESULTS.json','BATCH1C_IMPORT_MANIFEST.json','object-data.ts','.png','.meta')):
            assert sha(ROOT/path)==expected, 'R5 input changed or R3 already applied: '+path
    revision = json.loads((REV/'GEOMETRY.json').read_text())
    geometry = copy.deepcopy(revision['geometry']); density = geometry.pop('density_for_total_mass_3_2')
    data = json.loads((ART/'GEOMETRY.json').read_text())
    row = next(item for item in data['objects'] if item['slug']=='burger')
    source = REV/'composite-original-coordinates.png'
    row.update(source=str(source.relative_to(ROOT)),source_sha256=sha(source),generated=True,
        local_processing=revision['composition'],geometry=geometry,geometry_audit=revision['geometry_audit'],
        revision_recipe={'manifest':str((REV/'GEOMETRY.json').relative_to(ROOT)),
                         'sha256':sha(REV/'GEOMETRY.json'),'script':str((REV/'prepare.py').relative_to(ROOT))})
    for key in ['sprite','next']:
        row[key]=revision[key]; row[key+'_sha256']=sha(ROOT/revision[key])
    data['revisions'].append({'id':'burger-r3','reason':'R4 left-offset and R5 whale load rolled the curved lower bun',
        'apply_script':str(Path(__file__).relative_to(ROOT)),'apply_script_sha256':sha(Path(__file__))})
    write(ART/'GEOMETRY.json',data)
    generated = json.loads((ART/'GENERATION_RESULTS.json').read_text())
    generated['revisions']=[{'slug':'burger','revision':'burger-r3','request':str((REV/'GENERATION_REQUEST.json').relative_to(ROOT)),
        'request_sha256':sha(REV/'GENERATION_REQUEST.json'),'manifest':str((REV/'GEOMETRY.json').relative_to(ROOT)),
        'manifest_sha256':sha(REV/'GEOMETRY.json')}]
    write(ART/'GENERATION_RESULTS.json',generated)
    imported=json.loads((PREP/'art/BATCH1C_IMPORT_MANIFEST.json').read_text())
    meta_for=runpy.run_path(str(PREP/'tools/import_batch1c_art.py'))['meta_for']
    for key in ['sprite','next']:
        source=ROOT/revision[key]; target=ROOT/'assets/batch0/art'/source.name
        entry=next(item for item in imported['entries'] if item['id']==target.stem)
        entry['revision_before_sha256']=sha(target)
        shutil.copyfile(source,target);meta_for(target,Image.open(source).size)
        entry.update(candidate=str(source.relative_to(PREP)),sha256=sha(target),meta_sha256=sha(Path(str(target)+'.meta')))
    write(PREP/'art/BATCH1C_IMPORT_MANIFEST.json',imported)
    path=ROOT/'assets/batch1/object-data.ts'; source=path.read_text()
    lines=[f"    burger: {{ kind: 'burger', width: {geometry['width']}, height: {geometry['height']}, circle: false,",
        f"        spriteWidth: {geometry['spriteWidth']}, spriteHeight: {geometry['spriteHeight']}, spriteOffset: {json.dumps(geometry['spriteOffset'])},",'        outline: [']
    points=[json.dumps(point,separators=(',',':')) for point in geometry['outline']]
    for i in range(0,len(points),3):lines.append('            '+', '.join(points[i:i+3])+',')
    lines+=['        ],',f'        friction: 0.8, restitution: 0.01, density: {density},','        contactAngularDamping: 6, contactImpactSpeed: 2.4,','    },']
    source,count=re.subn(r"    burger: \{ kind: 'burger',[\s\S]+?(?=    slipper:)",'\n'.join(lines)+'\n',source)
    assert count==1;path.write_text(source)
    parameters=json.loads((ART/'PARAMETERS.json').read_text());row=next(item for item in parameters['parameters'] if item['kind']=='burger')
    row.update(area=revision['geometry_audit']['area_world_squared'],density=density,revision='burger-r3')
    write(ART/'PARAMETERS.json',parameters)
    print('Applied only visible lower bread revision, Sprite/NEXT/meta/shape and mass-preserving density.')

if __name__=='__main__': main()
