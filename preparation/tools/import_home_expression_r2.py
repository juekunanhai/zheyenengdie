"""Copy only reviewed R2 inputs and bind them to Home; never transform source pixels."""
from copy import deepcopy
from pathlib import Path
import hashlib
import json
import shutil
import struct
import uuid

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'preparation/design/home-expression-r2'
TARGET = ROOT / 'assets/batch0/home-expression-r2'
TEMPLATE = ROOT / 'assets/batch0/art/home_arm_grip_r1.png.meta'


def uid(path):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, 'zhynd:home-expression-r2:' + str(path.relative_to(ROOT))))


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def directory(path):
    if path == ROOT / 'assets/batch0':
        return
    directory(path.parent)
    path.mkdir(exist_ok=True)
    meta = Path(str(path) + '.meta')
    if not meta.exists():
        write_json(meta, {'ver': '1.2.0', 'importer': 'directory', 'imported': True,
                         'uuid': uid(path), 'files': [], 'subMetas': {}, 'userData': {}})


def image(source, target):
    directory(target.parent)
    shutil.copyfile(source, target)
    data = source.read_bytes()
    width, height = struct.unpack('>II', data[16:24])
    meta_path = Path(str(target) + '.meta')
    meta = json.loads((meta_path if meta_path.exists() else TEMPLATE).read_text())
    old = meta['uuid']
    identity = old if meta_path.exists() else uid(target)
    meta = json.loads(json.dumps(meta).replace(old, identity))
    for sub in meta['subMetas'].values():
        sub['displayName'] = target.stem
    frame = meta['subMetas']['f9941']['userData']
    frame.update(width=width, height=height, rawWidth=width, rawHeight=height,
                 trimType='none', trimX=0, trimY=0, offsetX=0, offsetY=0)
    frame['vertices'] = {
        'rawPosition': [-width/2, -height/2, 0, width/2, -height/2, 0,
                        -width/2, height/2, 0, width/2, height/2, 0],
        'indexes': [0, 1, 2, 2, 1, 3], 'uv': [0, height, width, height, 0, 0, width, 0],
        'nuv': [0, 0, 1, 0, 0, 1, 1, 1],
        'minPos': [-width/2, -height/2, 0], 'maxPos': [width/2, height/2, 0],
    }
    write_json(meta_path, meta)
    return {'file': str(target.relative_to(TARGET)), 'source': str(source.relative_to(ROOT)),
            'uuid': identity, 'sha256': hashlib.sha256(data).hexdigest(),
            'bytes': len(data), 'rgbaBytes': width * height * 4}


def import_home():
    sequence = json.loads((SOURCE / 'sequence.json').read_text())
    files = sorted({frame['file'] for layer in sequence['layers']
                    for frame in layer['frames'] if frame['file']})
    frames = [image(SOURCE / file, TARGET / file) for file in files]
    sky = json.loads((SOURCE / 'cloud/manifest.json').read_text())
    skies = [image(SOURCE / 'cloud' / sky[key]['file'], TARGET / 'cloud' / sky[key]['file'])
             for key in ['background', 'foreground']]
    imported = deepcopy(sequence)
    imported['status'] = 'cocos-source-integration-awaiting-engine-validation'
    for layer in imported['layers']:
        for frame in layer['frames']:
            frame['frame'] = files.index(frame['file']) if frame['file'] else -1
    imported['sky'] = {'width': sky['source']['width'], 'height': sky['source']['height'],
                       'layers': [{key: row[key] for key in ['rect', 'opacity', 'speed']}
                                  for row in sky['layers']]}
    imported['files'] = files
    sequence_path = TARGET / 'sequence.json'
    write_json(sequence_path, imported)
    write_json(Path(str(sequence_path) + '.meta'), {
        'ver': '1.0.0', 'importer': 'json', 'imported': True, 'uuid': uid(sequence_path),
        'files': ['.json'], 'subMetas': {}, 'userData': {},
    })
    scene_path = ROOT / 'assets/batch0/scenes/Home.scene'
    scene = json.loads(scene_path.read_text())
    presentation = next(row for row in scene if 'characterFrames' in row)
    reference = lambda value: {'__uuid__': value + '@f9941', '__expectedType__': 'cc.SpriteFrame'}
    presentation['characterFrames'] = [reference(row['uuid']) for row in frames]
    presentation['homeSequence'] = {'__uuid__': uid(sequence_path), '__expectedType__': 'cc.JsonAsset'}
    presentation['cityForeground'] = reference(skies[1]['uuid'])
    background = next(row for row in scene if row.get('_name') == 'HomeBackdrop')
    sprite = next(scene[ref['__id__']] for ref in background['_components']
                  if scene[ref['__id__']]['__type__'] == 'cc.Sprite')
    sprite['_spriteFrame'] = reference(skies[0]['uuid'])
    write_json(scene_path, scene)
    report = {'status': 'source-import-only-no-engine-build', 'frames': frames, 'sky': skies,
              'frameCount': len(frames), 'frameBytes': sum(row['bytes'] for row in frames),
              'frameRGBABytes': sum(row['rgbaBytes'] for row in frames),
              'allPNGBytes': sum(row['bytes'] for row in frames + skies),
              'allPNGRGBABytes': sum(row['rgbaBytes'] for row in frames + skies)}
    write_json(ROOT / 'preparation/design/home-expression-r2/COCOS_IMPORT.json', report)
    print(json.dumps({key: value for key, value in report.items() if key not in ('frames', 'sky')}))


if __name__ == '__main__':
    import_home()
