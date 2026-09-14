"""Record an actual R13 Creator build without building or launching the project.

Run after Creator and TypeScript finish, passing their actual process exit codes.
"""
from pathlib import Path
from datetime import datetime
import argparse
import hashlib
import json
import re
import sys
from PIL import Image

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
BUILD = PROJECT / 'build/web-desktop'
LOG = PROJECT / 'temp/result-r13-build.stdout.log'
OUT = HERE / 'engine/BUILD_REPORT.json'
MANIFEST = PROJECT / 'preparation/art/RESULT_R13_IMPORT_MANIFEST.json'
BEFORE = HERE / 'engine/BEFORE.json'
ALLOWED_SOURCE_CHANGES = {
    'assets/batch0/presentation/ResultPresentation.ts',
    'assets/batch0/scenes/Result.scene',
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def hashes(paths, base=PROJECT):
    return {str(p.relative_to(base)): sha(p) for p in sorted(paths)}


def verify_imports():
    """Shared by the build recorder and the preparation integrity check."""
    manifest = json.loads(MANIFEST.read_text())
    assert manifest['revision'] == 'result-r13'
    assert manifest['status'] == 'approved_visual_runtime_integration'
    qa = json.loads((HERE / 'QA.json').read_text())
    review = qa['user_visual_review']
    assert review['status'] == 'approved' and review['user_reply'].strip()
    approved_hash = review['approved_artifact_sha256']
    assert manifest['approved_artifact_sha256'] == approved_hash == sha(HERE / review['approved_artifact'])
    candidates = {
        'panel': 'result_panel_decorated', 'tower': 'result_character_tower',
        'title': 'result_title', 'bubble': 'result_bubble',
        'retry': 'result_retry', 'close': 'result_close',
        **{f'height_{key}': f'height_{key}' for key in [*map(str, range(10)), 'dot', 'm']},
    }
    expected = {'result_r13_' + key: f'design/result-r13/assets/{value}.png'
                for key, value in candidates.items()}
    rows = manifest['entries']
    assert len(rows) == 18 and {r['id'] for r in rows} == set(expected)
    assert len({r['uuid'] for r in rows}) == 18, 'R13 image UUIDs must be unique'
    reviewed_assets = {r['file']: r for r in qa['assets']}
    for row in rows:
        name = row['id']
        assert row['kind'] == 'new' and row['candidate'] == expected[name], name
        assert row['import_path'] == f'assets/batch0/art/{name}.png', name
        candidate = PROJECT / 'preparation' / row['candidate']
        target = PROJECT / row['import_path']
        reviewed = reviewed_assets[str(candidate.relative_to(HERE))]
        assert reviewed['sha256'] == row['sha256'] == sha(candidate) == sha(target), name
        assert re.fullmatch(r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}', row['uuid']), name
        meta = json.loads(Path(str(target) + '.meta').read_text())
        assert meta['uuid'] == row['uuid'] and meta['importer'] == 'image', name
        texture = meta['subMetas']['6c48a']
        frame = meta['subMetas']['f9941']
        assert texture['uuid'] == row['uuid'] + '@6c48a' and texture['importer'] == 'texture', name
        assert frame['uuid'] == row['uuid'] + '@f9941' and frame['importer'] == 'sprite-frame', name
        data = frame['userData']
        assert texture['userData']['imageUuidOrDatabaseUri'] == row['uuid'], name
        assert data['imageUuidOrDatabaseUri'] == texture['uuid'], name
        with Image.open(candidate) as im:
            im.load()
            assert im.format == 'PNG' and im.mode == reviewed['mode'] == 'RGBA', name
            assert list(im.size) == reviewed['size'], name
            assert im.getchannel('A').getextrema() == (0, 255), name + ' needs real transparent alpha'
            assert (data['rawWidth'], data['rawHeight']) == (data['width'], data['height']) == im.size, name
            assert data['trimType'] == 'none' and not data['rotated'], name
            assert all(data[key] == 0 for key in ('offsetX', 'offsetY', 'trimX', 'trimY')), name
    return manifest


def verify_scope(manifest):
    before = json.loads(BEFORE.read_text())
    files = [p for folder in ('assets', 'settings') for p in (PROJECT / folder).rglob('*') if p.is_file()]
    files += [PROJECT / 'package.json', PROJECT / 'tsconfig.json']
    current = hashes(files)
    old_images = {name: digest for name, digest in before.items() if name.endswith('.png')}
    assert len(old_images) == 67, 'R13 baseline must contain all 67 existing PNGs'
    new_images = {r['import_path'] for r in manifest['entries']}
    assert not new_images.intersection(before), 'R13 imports must not replace baseline files'
    expected_added = new_images | {name + '.meta' for name in new_images}
    assert set(current) - set(before) == expected_added, 'Only the 18 R13 PNGs and their metas may be added'
    assert not (set(before) - set(current)), 'Baseline assets/settings/config file was removed'
    protected = {name: digest for name, digest in before.items() if name not in ALLOWED_SOURCE_CHANGES}
    changed_protected = [name for name, digest in protected.items() if current.get(name) != digest]
    assert not changed_protected, f'Protected gameplay/Home/HUD/Settings/assets/config changed: {changed_protected}'
    expected_counts = {'.ts': 10, '.scene': 4, '.png': 85, '.mp3': 18}
    for suffix, count in expected_counts.items():
        assert sum(name.startswith('assets/') and name.endswith(suffix) for name in current) == count, suffix
    assert not any(name.endswith('.js') for name in current if name.startswith('assets/'))
    all_image_uuids = [json.loads(Path(str(PROJECT / name) + '.meta').read_text())['uuid']
                       for name in current if name.endswith('.png')]
    assert len(set(all_image_uuids)) == 85, 'R13 UUID collides with another runtime image'
    return before, current, protected, files


def stamp(log, marker):
    matches = list(re.finditer(r'(\d{4}-\d{1,2}-\d{1,2} \d{2}:\d{2}:\d{2}) - [^\n]*' + marker, log))
    assert matches, f'Missing Creator log marker: {marker}'
    match = matches[-1]
    return datetime.strptime(match[1], '%Y-%m-%d %H:%M:%S').timestamp(), match.start()


def record(args):
    log = LOG.read_text()
    started, start_index = stamp(log, r'Start build task, options:')
    completed, completion_index = stamp(log, r'build task\(web-desktop\) in \d+!')
    assert completion_index > start_index and completed >= started, 'Completion predates the last build start'
    assert args.exit_code in (0, 36), 'Caller reported a failing Creator exit code'
    assert args.typecheck_exit_code == 0, 'Caller reported a failing typecheck'
    manifest = verify_imports()
    before, current, protected, files = verify_scope(manifest)
    # Only the newly imported metas may gain Creator-managed standard fields.
    # Their semantic UUID, dimensions, alpha and no-trim settings are checked above.
    inputs = [p for p in files if p.suffix != '.meta']
    latest = max(inputs, key=lambda p: p.stat().st_mtime)
    assert latest.stat().st_mtime < started + 1, f'Build predates input: {latest.relative_to(PROJECT)}'
    scripts = sorted((PROJECT / 'assets').rglob('*.ts'))
    scenes = sorted((PROJECT / 'assets').rglob('*.scene'))
    configs = [p for p in files if str(p.relative_to(PROJECT)).startswith('settings/')]
    configs += [PROJECT / 'package.json', PROJECT / 'tsconfig.json']
    bundle = BUILD / 'assets/main/index.js'
    assert bundle.stat().st_mtime >= max(p.stat().st_mtime for p in scripts), 'Compiled main bundle predates TypeScript'
    assert started - 1 <= bundle.stat().st_mtime <= completed + 1, 'Main bundle does not belong to the logged build'
    assert LOG.stat().st_mtime >= completed, 'Log mtime is inconsistent with completion'
    outputs = [p for p in BUILD.rglob('*') if p.is_file()]
    assert outputs and (BUILD / 'src/settings.json').is_file(), 'Missing final web build output'
    return {
        'status': 'success', 'revision': 'result-r13', 'engine': '3.8.8', 'platform': 'web-desktop',
        'recorded_at': datetime.now().astimezone().isoformat(),
        'exit_code': args.exit_code, 'typecheck_exit_code': args.typecheck_exit_code,
        'execution_result_source': 'Exit codes are required and caller-supplied. Creator completion and output freshness are independently required in the saved log and filesystem.',
        'command': f"CocosCreator --project {PROJECT} --build 'platform=web-desktop;debug=true'",
        'log': str(LOG.relative_to(PROJECT)), 'log_sha256': sha(LOG),
        'log_warning_or_error_lines': [line for line in log.splitlines() if re.search(r'\b(?:warn(?:ing)?|error)\b', line, re.I)],
        'freshness': {
            'build_started_local': datetime.fromtimestamp(started).astimezone().isoformat(),
            'build_completed_local': datetime.fromtimestamp(completed).astimezone().isoformat(),
            'latest_input': str(latest.relative_to(PROJECT)), 'latest_input_mtime': latest.stat().st_mtime,
            'main_bundle_mtime': bundle.stat().st_mtime, 'timestamp_tolerance_seconds': 1,
            'note': 'All non-meta runtime/config inputs precede the build. Existing metas remain byte-identical; new R13 metas are checked semantically and hashed after import.',
        },
        'output_sha256': hashes(outputs, BUILD),
        'code_and_settings_sha256': hashes(scripts + configs),
        'scene_source_sha256': {p.name: sha(p) for p in scenes},
        'runtime_file_sha256': current,
        'runtime_image_count': 85,
        'runtime_image_sha256': {name: digest for name, digest in current.items() if name.endswith('.png')},
        'asset_meta_sha256': {name: digest for name, digest in current.items() if name.endswith('.meta')},
        'baseline_sha256': sha(BEFORE), 'import_manifest_sha256': sha(MANIFEST),
        'approved_artifact_sha256': manifest['approved_artifact_sha256'],
        'protected_unchanged_sha256': protected,
        'changed_existing_sources': sorted(name for name in before if current[name] != before[name]),
        'new_runtime_scripts': [],
        'new_runtime_images': sorted(r['import_path'] for r in manifest['entries']),
        'import_manifest_entries_verified': 18,
        'not_proven': ['Engine visual appearance or interactions; see separate R13 runtime evidence',
                       'Human acceptance of the engine assembly', 'WeChat build/device performance', 'Publication readiness'],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exit-code', type=int, required=True, help='Actual Creator process exit code (0 or 36 on success)')
    parser.add_argument('--typecheck-exit-code', type=int, required=True, help='Actual preceding TypeScript check exit code')
    args = parser.parse_args()
    try:
        report = record(args)
    except (AssertionError, OSError, KeyError, ValueError, TypeError) as error:
        report = {
            'status': 'failed', 'revision': 'result-r13', 'recorded_at': datetime.now().astimezone().isoformat(),
            'error': str(error), 'exit_code': args.exit_code, 'typecheck_exit_code': args.typecheck_exit_code,
            'log': str(LOG.relative_to(PROJECT)), 'log_sha256': sha(LOG) if LOG.is_file() else None,
            'execution_result_source': 'Exit codes are caller-supplied; verification failed and no successful build is claimed.',
        }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': report['status'], 'report': str(OUT), 'error': report.get('error')}, ensure_ascii=False))
    return 0 if report['status'] == 'success' else 1


if __name__ == '__main__':
    sys.exit(main())
