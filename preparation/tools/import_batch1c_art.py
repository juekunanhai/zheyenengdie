"""Import the reviewed six candidates, preserving prior playable shapes and original source files."""
from pathlib import Path
import hashlib
import json
import re
import shutil
import uuid
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
GEOMETRY = ROOT / 'preparation/design/batch1c/GEOMETRY.json'
BEFORE = ROOT / 'preparation/review/evidence/batch1c/before'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def meta_for(path, size):
    meta_path = Path(str(path) + '.meta')
    template = ROOT / 'assets/batch0/art/object_cardboard_box.png.meta'
    meta = json.loads((meta_path if meta_path.exists() else template).read_text())
    old_uuid = meta['uuid']
    new_uuid = old_uuid if meta_path.exists() else str(uuid.uuid5(uuid.NAMESPACE_URL, 'zhynd:batch1c:art:' + path.stem))
    meta = json.loads(json.dumps(meta).replace(old_uuid, new_uuid))
    for sub in meta['subMetas'].values():
        sub['displayName'] = path.stem
    data = meta['subMetas']['f9941']['userData']
    w, h = size
    data.update(width=w, height=h, rawWidth=w, rawHeight=h, trimX=0, trimY=0, offsetX=0, offsetY=0)
    data['vertices'] = {'rawPosition': [-w/2, -h/2, 0, w/2, -h/2, 0, -w/2, h/2, 0, w/2, h/2, 0],
                        'indexes': [0, 1, 2, 2, 1, 3], 'uv': [0, h, w, h, 0, 0, w, 0],
                        'nuv': [0, 0, 1, 0, 0, 1, 1, 1], 'minPos': [-w/2, -h/2, 0], 'maxPos': [w/2, h/2, 0]}
    meta_path.write_text(json.dumps(meta, indent=2) + '\n')
    return new_uuid


def import_art():
    rows = []
    for item in json.loads(GEOMETRY.read_text())['objects']:
        for field in ['sprite', 'next']:
            source = ROOT / item[field]
            assert sha(source) == item[field + '_sha256']
            target = ROOT / 'assets/batch0/art' / source.name
            previous = sha(target) if target.exists() else None
            if target.exists():
                backup = BEFORE / target.relative_to(ROOT)
                backup.parent.mkdir(parents=True, exist_ok=True)
                if not backup.exists():
                    shutil.copyfile(target, backup)
            shutil.copyfile(source, target)
            uid = meta_for(target, Image.open(target).size)
            rows.append({'id': target.stem, 'candidate': str(source.relative_to(ROOT / 'preparation')),
                         'import_path': str(target.relative_to(ROOT)), 'sha256': sha(target),
                         'uuid': uid, 'meta_sha256': sha(Path(str(target) + '.meta')),
                         'kind': 'replacement' if previous else 'new', 'previous_sha256': previous})
    manifest = {'status': 'self_reviewed_candidate_pending_engine_and_user_visual_review',
                'geometry_manifest': 'design/batch1c/GEOMETRY.json', 'entries': rows}
    (ROOT / 'preparation/art/BATCH1C_IMPORT_MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    scene = ROOT / 'assets/batch0/scenes/HUD.scene'
    data = json.loads(scene.read_text())
    controller = next(row for row in data if 'approvedSounds' in row)
    bound = {row['__uuid__'] for row in controller['frames']}
    for row in rows:
        uid = row['uuid'] + '@f9941'
        if uid not in bound:
            controller['frames'].append({'__uuid__': uid, '__expectedType__': 'cc.SpriteFrame'})
            bound.add(uid)
    scene.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def append_objects():
    path = ROOT / 'assets/batch1/object-data.ts'
    old = (BEFORE / 'assets/batch1/object-data.ts.txt').read_text()
    # Use the existing body area/1024 mass convention; large artwork does not imply crushing mass.
    mass_and_friction = {'wooden_crate': (4.8, .68), 'sofa': (4.2, .8), 'burger': (3.2, .8),
                         'ice_block': (4.5, .3), 'slipper': (2.8, .8), 'whale': (6.8, .72)}
    entries = []
    parameters = []
    for row in json.loads(GEOMETRY.read_text())['objects']:
        slug = row['slug']; spec = row['geometry']
        mass, friction = mass_and_friction[slug]
        area = row['geometry_audit']['area_world_squared']
        density = round(mass * 1024 / area, 12)
        lines = [f"    {slug}: {{ kind: '{slug}', width: {spec['width']}, height: {spec['height']}, circle: false,",
                 f"        spriteWidth: {spec['spriteWidth']}, spriteHeight: {spec['spriteHeight']}, spriteOffset: {json.dumps(spec['spriteOffset'])},",
                 '        outline: [']
        points = [json.dumps(p, separators=(',', ':')) for p in spec['outline']]
        for i in range(0, len(points), 3):
            lines.append('            ' + ', '.join(points[i:i+3]) + ',')
        lines += ['        ],', f'        friction: {friction}, restitution: 0.01, density: {density},',
                  '        contactAngularDamping: 6, contactImpactSpeed: 2.4,', '    },']
        entries.append('\n'.join(lines))
        parameters.append({'kind': slug, 'target_mass': mass, 'area': area, 'density': density,
                           'friction': friction, 'restitution': .01, 'contactAngularDamping': 6, 'contactImpactSpeed': 2.4})
    kinds = ' | '.join("'" + r['kind'] + "'" for r in parameters)
    source = re.sub(r'(export type ObjectKind = [^;]+);', r'\1 | ' + kinds + ';', old)
    marker = '\n};\n// An explicit calibration sequence;'
    assert source.count(marker) == 1
    source = source.replace(marker, '\n' + '\n'.join(entries) + marker)
    sequence = ['cardboard_box', 'wood_plank', 'fridge', 'basketball', 'wood_plank', 'wooden_crate',
                'sofa', 'wood_plank', 'slipper', 'burger', 'wood_plank', 'whale', 'wood_plank',
                'toilet', 'fridge', 'dumbbell', 'ice_block', 'wood_plank']
    source = re.sub(r'export const CALIBRATION_SEQUENCE:[^\n]+',
                    'export const CALIBRATION_SEQUENCE: readonly ObjectKind[] = ' + json.dumps(sequence) + ';', source)
    source = source.replace('// An explicit calibration sequence; the risk director is a later batch.',
                            '// Batch 1C base sequence: friendly opening, twelve kinds, with boards offered as real turns.\n// A risk-aware or randomized director remains a later batch.')
    path.write_text(source)
    (ROOT / 'preparation/design/batch1c/PARAMETERS.json').write_text(json.dumps({
        'status': 'candidates_pending_engine', 'unchanged': 'Previous six ObjectSpec values',
        'sequence': sequence, 'parameters': parameters}, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    assert not (ROOT / 'preparation/art/BATCH1C_IMPORT_MANIFEST.json').exists(), 'Do not overwrite initial import evidence'
    import_art()
    append_objects()
    print('Imported six shape candidates and their exact silhouettes; prior six specs retained.')
