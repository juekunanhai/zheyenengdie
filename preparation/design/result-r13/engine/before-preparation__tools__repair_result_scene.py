"""Rebuild Result composition only, using preserved component templates and imported art.

Run after the three approved supplementary images have been imported locally.
Never reads an old UI screenshot as a runtime image or changes another scene.
"""
from pathlib import Path
import copy
import json
import uuid

ROOT = Path(__file__).resolve().parents[2]
SCENE = ROOT / 'assets/batch0/scenes/Result.scene'
BASE = ROOT / 'preparation/review/evidence/result-repair-r1/before/assets__batch0__scenes__Result.scene'
SOURCE = json.loads(BASE.read_text())
HOME = json.loads((ROOT / 'assets/batch0/scenes/Home.scene').read_text())
NAMESPACE = uuid.UUID(json.loads((ROOT / 'package.json').read_text())['uuid'])
SPRITE = next(item for item in SOURCE if item.get('__type__') == 'cc.Sprite')
LABEL = next(item for item in SOURCE if item.get('__type__') == 'cc.Label')
REQUIRED = ['result_title_sticker', 'result_close', 'result_confetti']
for name in REQUIRED:
    assert (ROOT / f'assets/batch0/art/{name}.png.meta').exists(), f'Import {name}.png first'


def uid(name):
    return str(uuid.uuid5(NAMESPACE, 'result-repair-r1:' + name))


def ref(index):
    return {'__id__': index}


def color(rgb):
    return dict(__type__='cc.Color', r=rgb[0], g=rgb[1], b=rgb[2], a=rgb[3] if len(rgb) == 4 else 255)


def compressed_uuid(value):
    value = value.replace('-', '')
    alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    return value[:5] + ''.join(alphabet[int(value[i:i + 3], 16) >> 6] + alphabet[int(value[i:i + 3], 16) & 63] for i in range(5, 32, 3))


# The initial 19 records contain Scene, Canvas, Camera, Globals and SafeArea only.
data = copy.deepcopy(SOURCE[:19])
data[2]['_children'] = [ref(3)]
data[2]['_components'] = [ref(5), ref(6), ref(7)]
data[15]['_children'] = []


def component(node, values):
    index = len(data)
    values = copy.deepcopy(values)
    values.pop('node', None)
    values.pop('_id', None)
    record = dict(_name='', _objFlags=0, node=ref(node), _enabled=True, __prefab=None,
                  _id=uid(f'component:{index}'))
    record.update(values)
    data.append(record)
    data[node]['_components'].append(ref(index))
    return index


def node(name, parent, width, height, x=0, y=0):
    index = len(data)
    value = copy.deepcopy(SOURCE[2])
    value.update(_name=name, _parent=ref(parent), _children=[], _components=[], _id=uid(name))
    value['_lpos'].update(x=x, y=y, z=0)
    data.append(value)
    data[parent]['_children'].append(ref(index))
    component(index, dict(__type__='cc.UITransform', _contentSize=dict(__type__='cc.Size', width=width, height=height),
                          _anchorPoint=dict(__type__='cc.Vec2', x=.5, y=.5)))
    return index


def image(name, asset, parent, left, top, width, height, parent_height=560, sliced=False):
    meta = json.loads((ROOT / f'assets/batch0/art/{asset}.png.meta').read_text())
    source = meta['subMetas']['f9941']['userData']
    if height is None:
        height = width * source['rawHeight'] / source['rawWidth']
    parent_width = next(data[c['__id__']]['_contentSize']['width'] for c in data[parent]['_components'] if data[c['__id__']]['__type__'] == 'cc.UITransform')
    index = node(name, parent, width, height, left + width / 2 - parent_width / 2, parent_height / 2 - top - height / 2)
    frame = meta['uuid'] + '@f9941'
    value = copy.deepcopy(SPRITE)
    value.update(_spriteFrame=dict(__uuid__=frame, __expectedType__='cc.SpriteFrame'), _type=1 if sliced else 0,
                 _sizeMode=0, _isTrimmedMode=False)
    component(index, value)
    return index


def text(name, value, parent, left, top, width, height, size, rgb, outline=0, outline_rgb=(11, 63, 141)):
    parent_size = next(data[c['__id__']]['_contentSize'] for c in data[parent]['_components'] if data[c['__id__']]['__type__'] == 'cc.UITransform')
    index = node(name, parent, width, height, left + width / 2 - parent_size['width'] / 2, parent_size['height'] / 2 - top - height / 2)
    label = copy.deepcopy(LABEL)
    label.update(_string=value, _fontSize=size, _actualFontSize=size, _lineHeight=size + 24,
                 _fontFamily='Arial', _isBold=True, _color=color(rgb), _enableWrapText=False, _overflow=2,
                 _enableOutline=outline > 0, _outlineWidth=outline, _outlineColor=color(outline_rgb))
    component(index, label)
    return index


backdrop = image('ResultHomeBackdrop', 'home_r10_background', 2, 0, 0, 750, 1334, parent_height=1334)
home_art = node('ResultHomeArt', 2, 750, 1334)


def clone_home(source_index, parent):
    original = HOME[source_index]
    index = len(data)
    value = copy.deepcopy(original)
    value.update(_parent=ref(parent), _components=[], _children=[], _id=uid('home:' + original['_name']))
    data.append(value)
    data[parent]['_children'].append(ref(index))
    for item in original['_components']:
        component(index, HOME[item['__id__']])
    for item in original['_children']:
        clone_home(item['__id__'], index)
    return index


source_content = next(item for item in HOME if item.get('_name') == 'Content_1230')
for child in source_content['_children']:
    if HOME[child['__id__']]['_name'] not in ['btn_start', 'btn_settings_icon']:
        clone_home(child['__id__'], home_art)
node('ResultDim', 2, 750, 1334)
data[2]['_children'].append(ref(15))
content = node('Content_1230', 15, 750, 720)
card = node('ResultCard', content, 750, 560)
component(card, dict(__type__='cc.UIOpacity', _opacity=255))
image('panel_9slice_light', 'panel_9slice_light', card, 54, 0, 642, 560, sliced=True)
image('ResultConfetti', 'result_confetti', card, 67, 17, 616, None)
image('ResultHero', 'home_r9_hero', card, 453, 40, 220, 330)
image('ResultSlipper', 'home_r9_slipper', card, 502, 8, 112, 112 * 257 / 340)
image('ResultTitleSticker', 'result_title_sticker', card, 80, 23, 344, None)
title = text('Text:本次叠到了', '本次叠到了', card, 93, 47, 318, 66, 43, (18, 56, 122))
data[title]['_euler']['z'] = 4
data[title]['_lrot'].update(z=.0348994967, w=.999390827)
# One local group keeps the four layers on the same baseline and tilted as a unit.
height_group = node('HeightTreatment', card, 386, 173, -102, 49.5)
data[height_group]['_euler']['z'] = 5
data[height_group]['_lrot'].update(z=.0436193874, w=.999048222)
score_layers = [
    text('HeightDepth', '0.0 m', height_group, 2, 9, 386, 173, 120, (8, 45, 107), 14, (8, 45, 107)),
    text('HeightRim', '0.0 m', height_group, 0, 0, 386, 173, 120, (0, 99, 207), 11, (0, 99, 207)),
    text('HeightHighlight', '0.0 m', height_group, 0, -1, 386, 173, 120, (255, 239, 145), 2, (255, 239, 145)),
    text('Text:88.6 m', '0.0 m', height_group, 0, 3, 386, 173, 120, (255, 205, 36), 2, (255, 205, 36)),
]
for index in score_layers:
    label = next(data[c['__id__']] for c in data[index]['_components'] if data[c['__id__']]['__type__'] == 'cc.Label')
    label['_isItalic'] = True
image('ResultBubble', 'bubble_plain', card, 464, 224, 160, None)
text('Text:这也能叠！', '这也能叠！', card, 475, 243, 137, 54, 22, (18, 56, 122))
image('result_btn_retry', 'result_btn_retry', card, 145, 355, 460, None)
close = node('result_btn_close', card, 104, 104, 317, 266)
image('CloseVisual', 'result_close', close, 10, 10, 84, 84, parent_height=104)

# Preserve the existing end sound and action component metadata, with new child targets.
action = next(item for item in SOURCE if 'resultSound' in item)
component(2, action)
script_path = ROOT / 'assets/batch0/presentation/ResultPresentation.ts.meta'
if not script_path.exists():
    script_path.write_text(json.dumps(dict(ver='4.0.24', importer='typescript', imported=False,
                                         uuid=uid('ResultPresentation.ts'), files=[], subMetas={}, userData={}), indent=2) + '\n')
component(2, dict(__type__=compressed_uuid(json.loads(script_path.read_text())['uuid'])))
SCENE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'scene': str(SCENE.relative_to(ROOT)), 'records': len(data),
                  'supplementary_art': REQUIRED, 'component': 'ResultPresentation',
                  'runtimeScore': 'runResult.height', 'card': [642, 560]}, ensure_ascii=False))
