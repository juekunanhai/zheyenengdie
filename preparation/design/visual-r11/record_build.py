"""Record the R11 visual build and reject stale output or changes to accepted gameplay.

Run after Creator and typecheck finish; this script never builds or launches the game.
"""
from pathlib import Path
from datetime import datetime
import argparse
import hashlib
import json
import re
import sys

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
BUILD = PROJECT / 'build/web-desktop'
LOG = PROJECT / 'temp/visual-r11-build.stdout.log'
OUT = HERE / 'evidence/BUILD_REPORT.json'
ALLOWED_SOURCE_CHANGES = {
    'assets/batch1/scene-actions.ts',
    'assets/batch0/presentation/HeightBackdrop.ts',
    'assets/batch0/scenes/HUD.scene',
    'assets/batch0/scenes/Result.scene',
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def hashes(paths, base=PROJECT):
    return {str(p.relative_to(base)): sha(p) for p in sorted(paths)}


def stamp(log, marker):
    matches = re.findall(r'(\d{4}-\d{1,2}-\d{1,2} \d{2}:\d{2}:\d{2}) - [^\n]*' + marker, log)
    assert matches, f'Missing Creator log marker: {marker}'
    # Creator uses local wall time in this installed CLI; mtime uses the same host clock.
    return datetime.strptime(matches[-1], '%Y-%m-%d %H:%M:%S').timestamp()


def verify_images(image_hashes, old_images):
    manifest = json.loads((PROJECT / 'preparation/art/VISUAL_R11_IMPORT_MANIFEST.json').read_text())
    entries = manifest['entries']
    approved_images = {row['import_path'] for row in entries}
    for row in entries:
        target = row['import_path']
        assert image_hashes.get(target) == row['sha256'], f'Runtime PNG differs from import manifest: {target}'
        candidate = PROJECT / 'preparation' / row['candidate']
        assert sha(candidate) == row['sha256'], f'Candidate differs from manifest: {candidate}'
    assert not (set(old_images) - set(image_hashes)), 'Baseline runtime image was removed'
    changed = [name for name, digest in image_hashes.items() if old_images.get(name) != digest]
    assert set(changed) <= approved_images, 'Runtime image changed outside the R11 import manifest'
    return changed, len(entries)


def record(args):
    before = json.loads((HERE / 'BEFORE.json').read_text())
    log = LOG.read_text()
    started = stamp(log, r'Start build task, options:')
    completed = stamp(log, r'build task\(web-desktop\) in \d+!')
    assert completed >= started, 'Completion marker predates the last build start'
    assert args.exit_code in (None, 0, 36), 'Caller reported a failing Creator exit code'
    assert args.typecheck_exit_code in (None, 0), 'Caller reported a failing typecheck'
    scripts = sorted((PROJECT / 'assets').rglob('*.ts'))
    scenes = sorted((PROJECT / 'assets').rglob('*.scene'))
    configs = sorted((PROJECT / 'settings').rglob('*.json')) + [PROJECT / 'package.json', PROJECT / 'tsconfig.json']
    images = sorted((PROJECT / 'assets').rglob('*.png'))
    metas = sorted((PROJECT / 'assets').rglob('*.meta'))
    sources = scripts + scenes + configs + images
    assert len(images) == 67, f'Expected 67 runtime PNGs, found {len(images)}'
    latest_source = max(sources, key=lambda p: p.stat().st_mtime)
    # Log timestamps have only whole seconds. An edit after build start requires a new build.
    assert latest_source.stat().st_mtime < started + 1, f'Build predates input: {latest_source.relative_to(PROJECT)}'
    bundle = BUILD / 'assets/main/index.js'
    assert bundle.stat().st_mtime >= max(p.stat().st_mtime for p in scripts), 'Compiled main bundle predates TypeScript'
    assert started - 1 <= bundle.stat().st_mtime <= completed + 1, 'Main bundle does not belong to the logged build'
    assert LOG.stat().st_mtime >= completed, 'Log mtime is inconsistent with its completion marker'
    current = hashes(scripts + scenes + configs)
    protected = {name: digest for name, digest in before['sha256'].items() if name not in ALLOWED_SOURCE_CHANGES}
    changed_protected = [name for name, digest in protected.items() if current.get(name) != digest]
    assert not changed_protected, f'Protected gameplay/Home/Settings/config changed: {changed_protected}'
    image_hashes = hashes(images)
    old_images = before['source_assets_sha256']
    changed_images, verified_entries = verify_images(image_hashes, old_images)
    manifests = sorted((PROJECT / 'preparation/art').glob('*MANIFEST*.json')) + sorted(HERE.glob('*.json'))
    outputs = [p for p in BUILD.rglob('*') if p.is_file()]
    assert outputs and (BUILD / 'src/settings.json').is_file(), 'Missing final web build output'
    return {
        'status': 'success', 'revision': 'visual-r11', 'engine': '3.8.8', 'platform': 'web-desktop',
        'recorded_at': datetime.now().astimezone().isoformat(),
        'exit_code': args.exit_code, 'typecheck_exit_code': args.typecheck_exit_code,
        'execution_result_source': 'Exit codes are caller-supplied; null means not recorded. Creator completion is independently required in the saved log.',
        'command': f"CocosCreator --project {PROJECT} --build 'platform=web-desktop;debug=true'",
        'log': str(LOG.relative_to(PROJECT)), 'log_sha256': sha(LOG),
        'freshness': {'build_started_local': datetime.fromtimestamp(started).astimezone().isoformat(),
                      'build_completed_local': datetime.fromtimestamp(completed).astimezone().isoformat(),
                      'latest_input': str(latest_source.relative_to(PROJECT)),
                      'latest_input_mtime': latest_source.stat().st_mtime,
                      'main_bundle_mtime': bundle.stat().st_mtime,
                      'timestamp_tolerance_seconds': 1,
                      'note': 'All TS/scenes/settings/PNG input edits precede build start; the main bundle is newer than TS and belongs to the logged interval. Importer-managed .meta files are hashed separately.'},
        'output_sha256': hashes(outputs, BUILD),
        'code_and_settings_sha256': hashes(scripts + configs),
        'scene_source_sha256': {p.name: sha(p) for p in scenes},
        'runtime_image_count': len(images), 'runtime_image_sha256': image_hashes,
        'asset_meta_sha256': hashes(metas), 'manifest_sha256': hashes(manifests),
        'protected_unchanged_sha256': protected,
        'changed_existing_sources': [name for name, digest in current.items()
                                     if name in before['sha256'] and before['sha256'][name] != digest],
        'new_runtime_scripts': [str(p.relative_to(PROJECT)) for p in scripts if str(p.relative_to(PROJECT)) not in before['sha256']],
        'changed_or_added_runtime_images': changed_images,
        'new_runtime_images': sorted(set(image_hashes) - set(old_images)),
        'import_manifest_entries_verified': verified_entries,
        'not_proven': ['Engine visual restoration or interactions; see separate R11 runtime evidence',
                       'Human visual acceptance', 'WeChat build/device performance', 'Publication readiness'],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exit-code', type=int, help='Actual Creator process exit code, normally 36')
    parser.add_argument('--typecheck-exit-code', type=int, help='Actual preceding TypeScript check exit code')
    args = parser.parse_args()
    try:
        report = record(args)
    except (AssertionError, OSError, KeyError, ValueError) as error:
        report = {'status': 'failed', 'revision': 'visual-r11', 'recorded_at': datetime.now().astimezone().isoformat(),
                  'error': str(error), 'exit_code': args.exit_code, 'typecheck_exit_code': args.typecheck_exit_code}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': report['status'], 'report': str(OUT), 'error': report.get('error')}, ensure_ascii=False))
    return 0 if report['status'] == 'success' else 1


if __name__ == '__main__':
    sys.exit(main())
