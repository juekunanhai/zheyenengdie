"""Compare real Box2D manifold points with opaque pixels of the adopted PNGs."""
from pathlib import Path
import hashlib, json
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'preparation/review/evidence/batch1a'
runtime = json.loads((OUT / 'CONTACT_CAMERA.json').read_text())
assert runtime['status'] == 'passed_runtime_contact_and_camera'
cache, samples, profiles = {}, [], {}
for contact in runtime['contacts']:
    kind, spec = contact['kind'], contact['spec']
    if kind not in cache:
        file = ROOT / f'assets/batch0/art/object_{kind}.png'
        im = Image.open(file).convert('RGBA')
        cache[kind] = (im.size, np.argwhere(np.asarray(im)[:, :, 3] > 128))
        profiles[kind] = {**spec, 'source_sha256': hashlib.sha256(file.read_bytes()).hexdigest()}
    (width, height), opaque = cache[kind]
    scale_x, scale_y = spec['spriteWidth'] / width, spec['spriteHeight'] / height
    assert abs(scale_x / scale_y - 1) < .000002, kind
    offset_x, offset_y = spec.get('spriteOffset', [0, 0])
    for point in contact['points']:
        px = width / 2 + (point['local']['x'] - offset_x) / scale_x
        py = height / 2 - (point['local']['y'] - offset_y) / scale_y
        distance = float(np.sqrt(np.min(((opaque[:, 1] - px) * scale_x) ** 2 +
                                        ((opaque[:, 0] - py) * scale_y) ** 2)))
        samples.append({'kind': kind, 'angle': contact['requestedAngle'], 'other': contact['other'],
                        'world': point['world'], 'local': point['local'], 'distance_world': distance})

worst = max(sample['distance_world'] for sample in samples)
assert worst <= 1.5, f'Contact lies visibly outside artwork: {worst} world units'
expected = {'cardboard_box': [100, 100], 'wood_plank': [195, 28], 'fridge': [82, 145], 'basketball': [68, 68]}
for kind, profile in profiles.items():
    assert [profile['width'], profile['height']] == expected[kind]
    if profile.get('outline'):
        points = np.array(profile['outline'])
        assert np.allclose(np.ptp(points, axis=0), expected[kind]), kind
        edges = np.roll(points, -1, axis=0) - points
        following = np.roll(edges, -1, axis=0)
        assert np.all(edges[:, 0] * following[:, 1] - edges[:, 1] * following[:, 0] > 0), kind

report = {'status': 'passed_sampled_real_contact_pixels', 'contact_samples': len(samples),
          'max_distance_world': worst, 'max_distance_css_pixels_at_375x667': worst * .875,
          'threshold_world': 1.5, 'profiles': profiles, 'samples': samples,
          'limits': ['Measured contact cases, not all possible combinations or long-session balance.',
                     'A convex support outline is intentionally simpler than a pixel silhouette.']}
(OUT / 'CONTACT_PIXELS.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k: v for k, v in report.items() if k not in ['profiles', 'samples']}, ensure_ascii=False))
