"""Reproduce generated drifting-cloud alpha cleanup and one HUD frame replacement."""
import copy
import json
import numpy as np
from PIL import Image
from process_assets import clean_image, digest, metadata, ROOT, HERE, ART


def main():
    name = 'fx_backdrop_cloud_r1'
    source = HERE / 'cloud-generated.png'
    output = ART / f'{name}.png'
    image, bounds = clean_image(source, (512, 192))
    image.save(output, optimize=True)
    meta = metadata(name, (512, 192))
    meta_path = output.with_suffix('.png.meta')
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n')
    alpha = np.array(image.getchannel('A'))
    assert alpha.min() == 0 and alpha.max() > 200
    assert not alpha[0, :].any() and not alpha[-1, :].any()
    assert not alpha[:, 0].any() and not alpha[:, -1].any()
    scene_path = ROOT / 'assets/batch0/scenes/HUD.scene'
    scene = json.loads(scene_path.read_text())
    before = copy.deepcopy(scene)
    component = next(item for item in scene if 'cloudFrame' in item)
    old_frame = copy.deepcopy(component['cloudFrame'])
    component['cloudFrame'] = {'__uuid__': meta['uuid'] + '@f9941', '__expectedType__': 'cc.SpriteFrame'}
    scene_path.write_text(json.dumps(scene, ensure_ascii=False, indent=2) + '\n')
    comparison = copy.deepcopy(scene)
    next(item for item in comparison if 'cloudFrame' in item)['cloudFrame'] = old_frame
    assert comparison == before, 'Cloud import changed unrelated scene data'
    generation = json.loads((HERE / 'cloud-generation.json').read_text())
    generation['reference_sha256'] = digest(ROOT / generation['reference'])
    manifest = dict(generation=generation, name=name, source=str(source.relative_to(ROOT)),
        source_sha256=digest(source), crop_bounds=bounds, runtime=str(output.relative_to(ROOT)),
        runtime_sha256=digest(output), size=[512, 192], meta_sha256=digest(meta_path),
        sprite_frame_uuid=meta['uuid'] + '@f9941', alpha_extrema=[int(alpha.min()), int(alpha.max())],
        transparent_pixel_fraction=float((alpha == 0).mean()),
        processing='Reuse process_assets.clean_image: largest alpha>=8 connected component plus 3px edge, '
                   'retain original RGBA, aspect-preserving Lanczos resize and transparent margins.',
        scene_change='Replace only HeightBackdrop.cloudFrame in HUD.scene; Home and original cloud remain unchanged.')
    (HERE / 'BACKGROUND_CLOUD_MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    preview = Image.new('RGBA', (512, 384), '#19384F')
    preview.alpha_composite(image, (0, 0))
    lower = Image.new('RGBA', image.size, '#62C6F0')
    lower.alpha_composite(image)
    preview.alpha_composite(lower, (0, 192))
    preview.convert('RGB').save(HERE / 'cloud-alpha-review.png')
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
