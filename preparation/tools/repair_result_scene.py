"""Build the approved R13 Result card with image glyphs and implemented actions only.

Run after result-r13/import_engine_assets.py. Historical UI is reference-only.
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
REQUIRED = ['result_r13_' + name for name in ['panel', 'tower', 'title', 'bubble', 'retry', 'close']]
REQUIRED += ['result_r13_height_' + char for char in [*map(str, range(10)), 'dot', 'm']]
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
content = node('Content_1230', 15, 750, 820)
# Use the approved 298x336 art canvas in design units. All pieces share this scale.
R13_SCALE = 2.3
CARD_WIDTH, CARD_HEIGHT = 298 * R13_SCALE, 336 * R13_SCALE
card = node('ResultCard', content, CARD_WIDTH, CARD_HEIGHT)
component(card, dict(__type__='cc.UIOpacity', _opacity=255))

def r13_image(name, asset, rect, fill=False):
    left, top, width, height = rect
    meta = json.loads((ROOT / f'assets/batch0/art/result_r13_{asset}.png.meta').read_text())
    frame = meta['subMetas']['f9941']['userData']
    if not fill:
        ratio = min(width/frame['rawWidth'], height/frame['rawHeight'])
        fit_width, fit_height = frame['rawWidth']*ratio, frame['rawHeight']*ratio
        left += (width-fit_width)/2
        top += (height-fit_height)/2
        width, height = fit_width, fit_height
    return image(name, 'result_r13_' + asset, card, left*R13_SCALE, top*R13_SCALE,
                 width*R13_SCALE, height*R13_SCALE, parent_height=CARD_HEIGHT)


r13_image('ResultPanel', 'panel', [3, 20, 282, 311], fill=True)
r13_image('ResultHero', 'tower', [149, 20, 128, 128*1506/748])
r13_image('ResultTitleSticker', 'title', [42, 40, 116, 45])
height_group = node('HeightTreatment', card, 161*R13_SCALE, 66*R13_SCALE,
                    (13+161/2-149)*R13_SCALE, (168-90-66/2)*R13_SCALE)
data[height_group]['_euler']['z'] = 4
data[height_group]['_lrot'].update(z=.0348994967, w=.999390827)
r13_image('ResultBubble', 'bubble', [209, 152, 64, 39])
# No record, metric, percentile or share nodes: those features are not implemented.
retry = node('result_btn_retry', card, 233*R13_SCALE, 60*R13_SCALE,
             (27+233/2-149)*R13_SCALE, (168-266-60/2)*R13_SCALE)
retry_frame = json.loads((ROOT / 'assets/batch0/art/result_r13_retry.png.meta').read_text())['subMetas']['f9941']['userData']
retry_height = 233*retry_frame['rawHeight']/retry_frame['rawWidth']*R13_SCALE
image('RetryVisual', 'result_r13_retry', retry, 0, (60*R13_SCALE-retry_height)/2, 233*R13_SCALE, retry_height,
      parent_height=60*R13_SCALE)
close = node('result_btn_close', card, 112, 112,
             (254+41/2-149)*R13_SCALE, (168-(-1)-42/2)*R13_SCALE)
close_width, close_height = 41*R13_SCALE, 41*R13_SCALE*130/141
image('CloseVisual', 'result_r13_close', close, (112-close_width)/2, (112-close_height)/2,
      close_width, close_height, parent_height=112)

# Preserve the existing end sound and action component metadata, with new child targets.
action = next(item for item in SOURCE if 'resultSound' in item)
component(2, action)
script_path = ROOT / 'assets/batch0/presentation/ResultPresentation.ts.meta'
if not script_path.exists():
    script_path.write_text(json.dumps(dict(ver='4.0.24', importer='typescript', imported=False,
                                         uuid=uid('ResultPresentation.ts'), files=[], subMetas={}, userData={}), indent=2) + '\n')
glyph_frames = []
for char in [*map(str, range(10)), 'dot', 'm']:
    meta = json.loads((ROOT/f'assets/batch0/art/result_r13_height_{char}.png.meta').read_text())
    glyph_frames.append(dict(__uuid__=meta['uuid']+'@f9941', __expectedType__='cc.SpriteFrame'))
component(2, dict(__type__=compressed_uuid(json.loads(script_path.read_text())['uuid']), heightFrames=glyph_frames))
SCENE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'scene': str(SCENE.relative_to(ROOT)), 'records': len(data),
                  'supplementary_art': REQUIRED, 'component': 'ResultPresentation',
                  'runtimeScore': 'runResult.height', 'card': [CARD_WIDTH, CARD_HEIGHT]}, ensure_ascii=False))
