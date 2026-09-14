"""Traceable alpha-only cleanup for generated R7 candidates; source files stay intact."""
from pathlib import Path
import hashlib
import json

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / 'assets'
QA = ROOT / 'qa'
QA.mkdir(exist_ok=True)


def expand(mask, radius):
    """Keep a generous rectangular envelope around the connected material and shadow."""
    padded = np.pad(mask, ((0, 0), (radius, radius)))
    horizontal = np.zeros_like(mask)
    for dx in range(radius * 2 + 1):
        horizontal |= padded[:, dx:dx + mask.shape[1]]
    padded = np.pad(horizontal, ((radius, radius), (0, 0)))
    result = np.zeros_like(mask)
    for dy in range(radius * 2 + 1):
        result |= padded[dy:dy + mask.shape[0], :]
    return result


def clean(name):
    source = ASSETS / f'{name}.png'
    target = ASSETS / f'{name}-clean.png'
    original = Image.open(source).convert('RGBA')
    data = np.array(original)
    alpha = data[:, :, 3]
    marker = Image.fromarray(np.uint8(alpha >= 32) * 255).copy()
    ImageDraw.floodfill(marker, (marker.width // 2, marker.height // 2), 128)
    connected = np.array(marker) == 128
    assert connected.sum() > alpha.size / 2, 'Expected one connected main body'
    envelope = expand(connected, 32)
    rgb = data[:, :, :3]
    near_white_residue = (rgb.min(axis=2) >= 242) & (alpha <= 7) & ~connected
    remove = (~envelope | near_white_residue) & (alpha > 0)
    cleaned = data.copy()
    cleaned[remove, 3] = 0
    cleaned[cleaned[:, :, 3] == 0, :3] = 0
    Image.fromarray(cleaned).save(target)
    assert np.array_equal(data[connected], cleaned[connected]), 'Material core must be byte-identical'
    visible = cleaned[:, :, 3] > 0
    assert np.array_equal(data[visible, :3], cleaned[visible, :3]), 'All visible RGB values must remain unchanged'
    changed_alpha = alpha[remove]
    statistics = {
        'changed_pixel_count': int(remove.sum()),
        'removed_near_white_low_alpha_pixel_count': int((near_white_residue & (alpha > 0)).sum()),
        'changed_pixel_fraction': float(remove.mean()),
        'changed_alpha_max': int(changed_alpha.max()) if len(changed_alpha) else 0,
        'preserved_core_pixel_count': int(connected.sum()),
        'preserved_core_rgba_identical': True,
        'all_visible_rgb_identical': True,
        'hidden_rgb_zeroed_pixel_count': int(((cleaned[:, :, 3] == 0) & (data[:, :, :3].max(axis=2) > 0)).sum()),
        'original_alpha_bbox': list(original.getchannel('A').getbbox()),
        'clean_alpha_bbox': list(Image.fromarray(cleaned[:, :, 3]).getbbox()),
        'original_alpha_mass': int(alpha.astype(np.uint64).sum()),
        'clean_alpha_mass': int(cleaned[:, :, 3].astype(np.uint64).sum()),
        'remaining_partial_alpha_pixel_count': int(((cleaned[:, :, 3] > 0) & (cleaned[:, :, 3] < 255)).sum()),
    }
    qa_files = []
    # Separate QA images only; backgrounds are never baked into the sprite.
    for label, color in [('light-blue', '#bfdcf0'), ('dark-blue', '#12304d')]:
        page = Image.new('RGB', (1040, 950), color)
        draw = ImageDraw.Draw(page)
        draw.text((30, 20), f'{name} | {label} | before / alpha cleaned', fill='#ffffff' if label == 'dark-blue' else '#12304d')
        for index, sprite in enumerate([original, Image.fromarray(cleaned)]):
            display = sprite.copy()
            display.thumbnail((480, 790), Image.Resampling.LANCZOS)
            x = 20 + index * 520 + (480 - display.width) // 2
            y = 85 + (790 - display.height) // 2
            page.paste(display, (x, y), display)
            draw.text((30 + index * 520, 55), 'ORIGINAL' if index == 0 else 'CLEANED', fill='#ffffff' if label == 'dark-blue' else '#12304d')
        qa_file = QA / f'{name}-{label}-edges.png'
        page.save(qa_file)
        qa_files.append(str(qa_file.relative_to(ROOT)))
    metadata_file = ASSETS / f'{name}.source.json'
    metadata = json.loads(metadata_file.read_text())
    metadata['derived'] = {
        'file': target.name,
        'path': str(target),
        'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
        'size': list(original.size),
        'mode': 'RGBA',
        'method': 'Edge cleanup: seed-connected alpha>=32 identifies the complete material; preserve all RGBA there and original soft shadows within a 32px dilation; remove disconnected exterior residue and near-white alpha<=7 fringe. All visible RGB unchanged, original alpha levels retained everywhere else. Zero hidden RGB only at fully transparent pixels to remove white matte residues. No crop, no resize, no opaque backdrop.',
        'script': '../clean_candidate_edges.py',
        'statistics': statistics,
        'qa_files': qa_files,
        'status': 'edge_cleaned_candidate_pending_visual_direction_approval_and_engine_import',
    }
    metadata_file.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'asset': name, **statistics}, ensure_ascii=False))


for asset in ['inventory-vertical-r7', 'panel-soft-r7']:
    clean(asset)
