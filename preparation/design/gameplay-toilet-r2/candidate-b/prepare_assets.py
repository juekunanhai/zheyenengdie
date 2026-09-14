"""Local alpha cleanup and NEXT derivation; original generated pixels retained separately."""
from pathlib import Path
import hashlib
import json
import shutil
from PIL import Image, ImageFilter, ImageDraw

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / 'assets'
ASSETS.mkdir(exist_ok=True)
SOURCES = json.loads((ROOT / 'SOURCE.json').read_text())
rows = []
for source in SOURCES['sources']:
    if not source['selected']:
        continue
    slug = source['slug']
    original = Path(source['generated_path'])
    copied = ASSETS / f'object_{slug}.generated.png'
    shutil.copy2(original, copied)
    im = Image.open(copied).convert('RGBA')
    alpha = im.getchannel('A')
    # A solid seed inside each subject excludes detached alpha specks. Median
    # smooths only sub-pixel-at-game-scale generated edge noise; RGB is retained.
    binary = alpha.point(lambda v: 255 if v >= 160 else 0).filter(ImageFilter.MedianFilter(7))
    seed = (int(im.width * .5), int(im.height * (.65 if slug == 'toilet' else .5)))
    if binary.getpixel(seed) != 255:
        raise ValueError(f'{slug}: foreground seed missing')
    ImageDraw.floodfill(binary, seed, 128, thresh=0)
    subject = binary.point(lambda v: 255 if v == 128 else 0)
    mask = subject.filter(ImageFilter.GaussianBlur(.7))
    im.putalpha(mask)
    box = mask.getbbox()
    crop = im.crop(box)
    # Same maximum raster dimension, never anisotropic scaling.
    scale = min(1, 768 / max(crop.size))
    out_size = (round(crop.width * scale), round(crop.height * scale))
    crop = crop.resize(out_size, Image.Resampling.LANCZOS)
    output = Image.new('RGBA', (crop.width + 16, crop.height + 16))
    output.paste(crop, (8, 8))
    sprite = ASSETS / f'object_{slug}.png'
    output.save(sprite)
    silhouette = Image.new('RGBA', output.size, (216, 231, 248, 255))
    silhouette.putalpha(output.getchannel('A'))
    next_path = ASSETS / f'next_{slug}.png'
    silhouette.save(next_path)
    alpha128 = output.getchannel('A').point(lambda v: 255 if v >= 128 else 0).getbbox()
    rows.append({
        'slug': slug,
        'source': str(copied.relative_to(ROOT)),
        'source_sha256': hashlib.sha256(copied.read_bytes()).hexdigest(),
        'source_size': list(Image.open(copied).size),
        'crop_source_px': list(box),
        'uniform_raster_scale': scale,
        'sprite': str(sprite.relative_to(ROOT)),
        'sprite_sha256': hashlib.sha256(sprite.read_bytes()).hexdigest(),
        'next': str(next_path.relative_to(ROOT)),
        'next_sha256': hashlib.sha256(next_path.read_bytes()).hexdigest(),
        'size_px': list(output.size),
        'alpha_bounds_px': list(output.getchannel('A').getbbox()),
        'alpha128_bounds_px': list(alpha128),
        'status': 'complete_generated_candidate_self_checked_not_user_approved_or_runtime_verified',
    })
(ROOT / 'ASSET_MANIFEST.json').write_text(json.dumps({'processing': 'alpha threshold 160, 7px median, seed flood-fill component, 0.7px alpha feather, uniform Lanczos resize to max 768, 8px margin; RGB material retained; NEXT constant RGB with same alpha', 'assets': rows}, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(rows, ensure_ascii=False, indent=2))
