"""Reproduce the approved local alpha cleanup and runtime downsampling only."""
from collections import deque
from pathlib import Path
import copy
import hashlib
import json
import uuid

import numpy as np
from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
ART = ROOT / 'assets/batch0/art'
TARGETS = [('dust', (256, 256)), ('ring', (256, 128))]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def clean_image(source, size):
    rgba = np.array(Image.open(source).convert('RGBA'))
    alpha = rgba[:, :, 3]
    remaining = alpha >= 8
    height, width = remaining.shape
    largest = []
    while remaining.any():
        y, x = np.argwhere(remaining)[0]
        queue = deque([(y, x)])
        remaining[y, x] = False
        points = []
        while queue:
            y, x = queue.popleft()
            points.append((y, x))
            for ny, nx in [(y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)]:
                if 0 <= ny < height and 0 <= nx < width and remaining[ny, nx]:
                    remaining[ny, nx] = False
                    queue.append((ny, nx))
        if len(points) > len(largest):
            largest = points
    mask = np.zeros_like(alpha)
    for y, x in largest:
        mask[y, x] = 255
    keep = np.array(Image.fromarray(mask).filter(ImageFilter.MaxFilter(7))) > 0
    rgba[~keep, 3] = 0
    rgba[rgba[:, :, 3] == 0, :3] = 0
    cleaned = Image.fromarray(rgba)
    bounds = cleaned.getchannel('A').getbbox()
    trimmed = cleaned.crop(bounds)
    trimmed.thumbnail((size[0] - 24, size[1] - 24), Image.Resampling.LANCZOS)
    result = Image.new('RGBA', size, (0, 0, 0, 0))
    result.alpha_composite(trimmed, ((size[0] - trimmed.width) // 2,
                                     (size[1] - trimmed.height) // 2))
    return result, list(bounds)


def metadata(name, size):
    template = json.loads((ART / 'cloud_large_01.png.meta').read_text())
    old_uuid = template['uuid']
    image_uuid = str(uuid.uuid5(uuid.NAMESPACE_URL, 'zheyenengdie/art/' + name))
    data = json.loads(json.dumps(template).replace(old_uuid, image_uuid)
                      .replace('cloud_large_01', name))
    width, height = size
    sf = data['subMetas']['f9941']['userData']
    sf.update(width=width, height=height, rawWidth=width, rawHeight=height)
    sf['vertices'].update(rawPosition=[-width / 2, -height / 2, 0,
                                      width / 2, -height / 2, 0,
                                      -width / 2, height / 2, 0,
                                      width / 2, height / 2, 0],
                          uv=[0, height, width, height, 0, 0, width, 0],
                          minPos=[-width / 2, -height / 2, 0],
                          maxPos=[width / 2, height / 2, 0])
    return data


def main():
    provenance = json.loads((HERE / 'generation.json').read_text())
    for item in provenance['assets']:
        item['reference_sha256'] = digest(ROOT / item['reference'])
    outputs = []
    frames = []
    for kind, size in TARGETS:
        name = f'fx_landing_{kind}_r1'
        source = HERE / f'{kind}-generated.png'
        output = ART / f'{name}.png'
        image, bounds = clean_image(source, size)
        image.save(output, optimize=True)
        meta = metadata(name, size)
        meta_path = output.with_suffix('.png.meta')
        meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n')
        alpha = np.array(image.getchannel('A'))
        assert alpha.min() == 0 and alpha.max() > 200
        assert not alpha[0, :].any() and not alpha[-1, :].any()
        assert not alpha[:, 0].any() and not alpha[:, -1].any()
        frames.append({'__uuid__': meta['uuid'] + '@f9941',
                       '__expectedType__': 'cc.SpriteFrame'})
        outputs.append(dict(name=name, source=str(source.relative_to(ROOT)),
                            source_sha256=digest(source), crop_bounds=bounds,
                            runtime=str(output.relative_to(ROOT)), size=list(size),
                            runtime_sha256=digest(output), meta_sha256=digest(meta_path),
                            transparent_pixel_fraction=float((alpha == 0).mean()),
                            alpha_extrema=[int(alpha.min()), int(alpha.max())],
                            sprite_frame_uuid=meta['uuid'] + '@f9941'))
    scene_path = ROOT / 'assets/batch0/scenes/HUD.scene'
    scene = json.loads(scene_path.read_text())
    before = copy.deepcopy(scene)
    controller = next(item for item in scene if item.get('_id') ==
                      '548c6146-1a8a-5ec1-bae4-54924ec3bade')
    added = [frame for frame in frames if frame not in controller['frames']]
    controller['frames'].extend(added)
    scene_path.write_text(json.dumps(scene, ensure_ascii=False, indent=2) + '\n')
    comparison = copy.deepcopy(scene)
    copied_controller = next(item for item in comparison if item.get('_id') ==
                             '548c6146-1a8a-5ec1-bae4-54924ec3bade')
    for frame in added:
        copied_controller['frames'].remove(frame)
    assert comparison == before, 'Scene mutation exceeded frame references'
    manifest = dict(generation=provenance, processing={
        'algorithm': 'Largest 4-connected alpha>=8 component, 3px edge dilation, '
                     'retain original RGBA within mask; clear isolated residual pixels; '
                     'alpha-bounds crop, aspect-preserving Lanczos resize, transparent pad.',
        'runtime_margin_pixels': 12,
        'source_pixels_redrawn': False,
        'scene_change': 'Append only the two StackGameController.frames references',
    }, assets=outputs)
    (HERE / 'ART_MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(outputs, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
