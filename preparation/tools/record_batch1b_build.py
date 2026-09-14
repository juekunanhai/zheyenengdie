"""Record a completed Batch 1B Creator build using actual caller-supplied exit codes.

Importing this module only exposes read-only checks; only main writes BUILD_REPORT.json.
"""
from pathlib import Path
from datetime import datetime
from types import SimpleNamespace
import argparse
import copy
import hashlib
import json
import re
import runpy
import sys
import wave

PROJECT = Path(__file__).resolve().parents[2]
EVIDENCE = PROJECT / 'preparation/review/evidence/batch1b'
BEFORE = EVIDENCE / 'BEFORE.json'
BUILD = PROJECT / 'build/web-desktop'
LOG = PROJECT / 'temp/batch1b-build.stdout.log'
OUT = EVIDENCE / 'BUILD_REPORT.json'
R13 = PROJECT / 'preparation/design/result-r13'
AUDIO_IMPORT = PROJECT / 'preparation/audio/BATCH1B_AUDIO_IMPORT_MANIFEST.json'
HAS_A3_AUDIO = AUDIO_IMPORT.exists()
AUDIO_REPLACEMENTS = {'claw_grip', 'claw_open', 'rotate_90', 'next_handoff', 'stable', 'run_end'}
AUDIO_ADDITIONS = {'star_lost', 'impact_ceramic_1', 'impact_ceramic_2', 'impact_ceramic_3'}
ALLOWED_SOURCE_CHANGES = {
    'assets/batch1/game-controller.ts', 'assets/batch1/tower-world.ts',
    'assets/batch1/play-view.ts', 'assets/batch1/object-data.ts',
    'assets/batch0/presentation/HeightBackdrop.ts', 'assets/batch0/scenes/HUD.scene',
}
ADDED_FILES = {'assets/batch1/incident-state.ts', 'assets/batch1/incident-state.ts.meta'}
EXPECTED_COUNTS = {'.ts': 11, '.scene': 4, '.png': 85, '.mp3': 18}
if HAS_A3_AUDIO:
    ALLOWED_SOURCE_CHANGES.add('assets/batch1/game-audio.ts')
    ALLOWED_SOURCE_CHANGES.update(f'assets/batch1/audio/{name}.mp3' for name in AUDIO_REPLACEMENTS)
    ADDED_FILES.update(f'assets/batch1/audio/{name}.mp3{suffix}' for name in AUDIO_ADDITIONS for suffix in ('', '.meta'))
    EXPECTED_COUNTS['.mp3'] = 22


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def hashes(paths, base=PROJECT):
    return {str(path.relative_to(base)): sha(path) for path in sorted(paths)}


def baseline_text(relative, baseline):
    path = EVIDENCE / 'before' / (relative + '.txt')
    assert sha(path) == baseline[relative], f'Baseline source copy changed: {relative}'
    return path.read_text()


def verify_audio_imports(baseline):
    """Keep the twelve A2 recordings and all old metas; verify the ten explicitly authorized Foley changes."""
    if not HAS_A3_AUDIO:
        return None
    imported = json.loads(AUDIO_IMPORT.read_text())
    assert imported['status'] == 'authorized_for_current_use' and imported['approval_text'].strip()
    assert imported['candidate_manifest'] == 'audio/foley-a3/MANIFEST.json'
    candidate = json.loads((PROJECT / 'preparation' / imported['candidate_manifest']).read_text())
    assert candidate['revision'] == '2026-09-14-A3' and candidate['status'] == 'authorized_for_current_use'
    assert candidate['listening_status'] == 'not_reviewed', 'Website-use authorization is not a listening review'
    assert candidate['script_sha256'] == sha(PROJECT / 'preparation/tools/build_audio_foley_a3.py')
    assert candidate['license_files'], 'A3 must preserve the source license evidence'
    for license_file in candidate['license_files']:
        assert sha(PROJECT / 'preparation' / license_file['file']) == license_file['sha256']
    rows = imported['entries']
    expected_ids = AUDIO_REPLACEMENTS | AUDIO_ADDITIONS
    assert len(rows) == 10 and {row['id'] for row in rows} == expected_ids
    assert len(candidate['entries']) == 10 and {row['id'] for row in candidate['entries']} == expected_ids
    sources = {row['id']: row for row in candidate['entries']}
    historical = json.loads((PROJECT / 'preparation/audio/BATCH1A_IMPORT_MANIFEST.json').read_text())
    old = {row['id']: row for row in historical['entries']}
    assert historical['status'] == 'approved_for_current_use' and len(old) == 18
    kept = set(old) - AUDIO_REPLACEMENTS
    assert kept == {f'impact_{material}_{index}' for material in ('paper', 'wood', 'rubber', 'metal') for index in (1, 2, 3)}
    assert {row['file']: row['sha256'] for row in candidate['unchanged_materials']} == \
        {old[name]['import_path']: old[name]['sha256'] for name in kept}
    for name, row in old.items():
        assert sha(PROJECT / 'preparation' / row['candidate']) == row['sha256'], 'Historical A2 candidate changed: ' + name
        path = row['import_path']
        assert baseline[path] == row['sha256'], 'A2 import differs from the R13 baseline: ' + name
        assert sha(PROJECT / (path + '.meta')) == baseline[path + '.meta'], 'An old audio UUID/meta changed: ' + name
        if name in kept:
            assert sha(PROJECT / path) == row['sha256'], 'A retained material recording changed: ' + name
    all_uuids = []
    for row in rows:
        name = row['id']; entry = sources[name]
        assert row['candidate'] == entry['file'] == f'audio/foley-a3/encoded/{name}.mp3', name
        assert row['import_path'] == f'assets/batch1/audio/{name}.mp3', name
        target = PROJECT / row['import_path']
        assert row['sha256'] == entry['sha256'] == sha(PROJECT / 'preparation' / row['candidate']) == sha(target), name
        assert target.stat().st_size == entry['bytes'] and entry['duration_s'] > 0, name
        assert entry['channels'] == 1 and entry['sample_rate'] == 44100, name
        master = PROJECT / 'preparation' / entry['master']
        assert sha(master) == entry['master_sha256'], name
        with wave.open(str(master), 'rb') as audio:
            assert audio.getnchannels() == entry['channels'] and audio.getframerate() == entry['sample_rate'], name
            assert audio.getsampwidth() == 2 and abs(audio.getnframes() / audio.getframerate() - entry['duration_s']) < .001, name
        assert entry['sources_and_edits'], name + ' needs actual recording provenance'
        for recipe in entry['sources_and_edits']:
            assert sha(PROJECT / 'preparation' / recipe['file']) == recipe['sha256'], name
            assert recipe['rate'] == 1 and recipe['duration_s'] > 0 and recipe['start_s'] >= 0, name
            assert recipe['author'].strip() and recipe['page_url'].startswith('https://') and 'CC0' in recipe['license'], name
        meta_path = Path(str(target) + '.meta')
        assert sha(meta_path) == row['meta_sha256'], name
        meta = json.loads(meta_path.read_text())
        assert meta['uuid'] == row['uuid'] and meta['importer'] == 'audio-clip' and meta['imported'] is True, name
        assert re.fullmatch(r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}', row['uuid']), name
        all_uuids.append(row['uuid'])
        if name in AUDIO_REPLACEMENTS:
            assert row['kind'] == 'replacement' and row['previous_sha256'] == old[name]['sha256'] != row['sha256'], name
            assert row['meta_sha256'] == baseline[row['import_path'] + '.meta'], name
        else:
            assert row['kind'] == 'new' and row['previous_sha256'] is None and row['import_path'] not in baseline, name
    assert len(set(all_uuids)) == 10, 'A3 audio UUIDs must be unique'
    existing_uuids = {json.loads((PROJECT / name).read_text()).get('uuid') for name in baseline if name.endswith('.meta')}
    for row in rows:
        if row['kind'] == 'new':
            assert row['uuid'] not in existing_uuids, 'New A3 audio UUID collides with a baseline asset'
    return imported


def verify_restricted_changes(baseline):
    relative = 'assets/batch1/object-data.ts'
    original, current = baseline_text(relative, baseline), (PROJECT / relative).read_text()
    pattern = r'^export type RunPhase = [^\n]+;$'
    before_lines, after_lines = re.findall(pattern, original, re.M), re.findall(pattern, current, re.M)
    assert len(before_lines) == len(after_lines) == 1, 'RunPhase must have one declaration'
    assert before_lines[0] == "export type RunPhase = 'entering' | 'planning' | 'falling' | 'observing' | 'ended';"
    assert after_lines[0] == "export type RunPhase = 'entering' | 'planning' | 'falling' | 'observing' | 'incident' | 'defeated' | 'ended';"
    assert re.sub(pattern, '', original, flags=re.M) == re.sub(pattern, '', current, flags=re.M), \
        'Batch 1B must not change object geometry, materials, difficulty or other object-data declarations'

    relative = 'assets/batch0/scenes/HUD.scene'
    original = json.loads(baseline_text(relative, baseline))
    current = json.loads((PROJECT / relative).read_text())
    assert len(original) == len(current), 'HUD scene records changed beyond frame references'
    controllers = [index for index, row in enumerate(original) if 'frames' in row and 'approvedSounds' in row]
    assert len(controllers) == 1, 'Expected one existing game controller in HUD'
    index = controllers[0]
    expected = copy.deepcopy(original[index]['frames'])
    for name in ('hud_star_full', 'hud_star_empty'):
        meta = json.loads((PROJECT / f'assets/batch0/art/{name}.png.meta').read_text())
        reference = {'__uuid__': meta['subMetas']['f9941']['uuid'], '__expectedType__': 'cc.SpriteFrame'}
        if reference not in expected:
            expected.append(reference)
    original_frames = original[index]['frames']
    current_frames = current[index]['frames']
    assert current_frames[:len(original_frames)] == original_frames, 'Existing HUD frame references changed'
    assert sorted(json.dumps(row, sort_keys=True) for row in current_frames[len(original_frames):]) == \
        sorted(json.dumps(row, sort_keys=True) for row in expected[len(original_frames):]), \
        'HUD may only append the existing full/empty star frames'
    normalized = copy.deepcopy(current)
    normalized[index]['frames'] = original[index]['frames']
    if HAS_A3_AUDIO:
        old_sounds = original[index]['approvedSounds']
        sounds = current[index]['approvedSounds']
        assert sounds[:len(old_sounds)] == old_sounds, 'Existing HUD audio UUID references changed'
        additions = []
        for name in AUDIO_ADDITIONS:
            meta = json.loads((PROJECT / f'assets/batch1/audio/{name}.mp3.meta').read_text())
            additions.append({'__uuid__': meta['uuid'], '__expectedType__': 'cc.AudioClip'})
        assert sorted(json.dumps(row, sort_keys=True) for row in sounds[len(old_sounds):]) == \
            sorted(json.dumps(row, sort_keys=True) for row in additions), 'HUD may only append star_lost and three ceramic clips'
        normalized[index]['approvedSounds'] = old_sounds
    assert normalized == original, 'HUD layout, Sprite sources, sounds or other component fields changed'

    if HAS_A3_AUDIO:
        relative = 'assets/batch1/game-audio.ts'
        old_audio, new_audio = baseline_text(relative, baseline), (PROJECT / relative).read_text()
        edits = [
            ("    // Trial reuses approved hard-surface sounds; dedicated ceramic audio remains pending.\n"
             "    impact_toilet: ['impact_metal_1', 'impact_metal_2', 'impact_metal_3'],",
             "    impact_toilet: ['impact_ceramic_1', 'impact_ceramic_2', 'impact_ceramic_3'],"),
            ('interface Voice { source: AudioSource; availableAt: number; collision: boolean }',
             'interface Voice { source: AudioSource; availableAt: number; collision: boolean; pairKey: string }'),
            ('            this.voices.push({ source, availableAt: 0, collision: false });',
             "            this.voices.push({ source, availableAt: 0, collision: false, pairKey: '' });"),
            ("        if (this.clock - (this.playedAt.get(pairKey) ?? -1) < .12) return false;\n", ''),
            ("        if (collision && this.voices.filter(v => v.collision && busy(v)).length >= 4) return false;\n"
             "        const voice = this.voices.find(v => !busy(v)) ?? (!collision ? this.voices.find(v => v.collision) : undefined);",
             "        const level = Math.max(0, Math.min(.9, volume));\n"
             "        const samePair = this.voices.filter(v => v.collision && v.pairKey === pairKey && busy(v))\n"
             "            .reduce<Voice | undefined>((a, v) => !a || v.source.volume > a.source.volume ? v : a, undefined);\n"
             "        const cooling = this.clock - (this.playedAt.get(pairKey) ?? -1) < .12;\n"
             "        // Keep a stronger hit from the same pair; weaker contact chatter stays in cooldown.\n"
             "        if (cooling && (!collision || !samePair || samePair.source.volume >= level)) return false;\n"
             "        const impacts = this.voices.filter(v => v.collision && busy(v));\n"
             "        const weakest = impacts.reduce<Voice | undefined>((a, v) => !a || v.source.volume < a.source.volume ? v : a, undefined);\n"
             "        // No deferred queue: when collapse fills the four impact slots, a stronger hit replaces\n"
             "        // the quietest one immediately. Operation/star cues retain their reserved capacity.\n"
             "        const voice = cooling ? samePair : collision && impacts.length >= 4\n"
             "            ? (weakest && level > weakest.source.volume ? weakest : undefined)\n"
             "            : this.voices.find(v => !busy(v)) ?? (!collision ? weakest : undefined);"),
            ('        voice.source.volume = Math.max(0, Math.min(.9, volume));',
             '        voice.source.volume = level;'),
            ('        voice.availableAt = this.clock + clip.getDuration() + .1; voice.collision = collision;',
             '        voice.availableAt = this.clock + clip.getDuration() + .1; voice.collision = collision; voice.pairKey = pairKey;'),
        ]
        expected_audio = old_audio
        for old, new in edits:
            assert expected_audio.count(old) == 1, 'Audio priority patch no longer matches its recorded baseline'
            expected_audio = expected_audio.replace(old, new, 1)
        assert new_audio == expected_audio, 'GameAudio changed beyond ceramic mapping and reviewed strong-impact voice priority'

    relative = 'assets/batch0/presentation/HeightBackdrop.ts'
    original, current = baseline_text(relative, baseline), (PROJECT / relative).read_text()
    # The only approved backdrop change is the near-ground world zoom. Keep all distant art,
    # height transitions, cloud motion and source imports byte-identical after this exact patch.
    edits = [
        ('    private pixelsPerMetre = 175;\n', '    private pixelsPerMetre = 175;\n    private worldZoom = 1;\n'),
        ('setViewHeight(heightM: number, immediate = false, pixelsPerMetre = 175): void {',
         'setViewHeight(heightM: number, immediate = false, pixelsPerMetre = 175, worldZoom = 1): void {'),
        ('        this.pixelsPerMetre = pixelsPerMetre;\n',
         '        this.pixelsPerMetre = pixelsPerMetre;\n        this.worldZoom = worldZoom;\n'),
        ('            ground.setPosition(0, (size.height - this.lastHeight) / 2 - this.shownHeight * this.pixelsPerMetre, 0);',
         '            ground.setScale(this.worldZoom, this.worldZoom, 1);\n'
         '            ground.setPosition(0, ((size.height - this.lastHeight) / 2 - this.shownHeight * this.pixelsPerMetre) * this.worldZoom, 0);'),
    ]
    expected = original
    for old, new in edits:
        assert expected.count(old) == 1, 'Near-ground zoom patch no longer matches its recorded baseline'
        expected = expected.replace(old, new, 1)
    assert current == expected, 'HeightBackdrop changed beyond the explicit near-ground presentation zoom'


def verify_scope():
    baseline = json.loads(BEFORE.read_text())
    assert len(baseline) == 250, 'Batch 1B must start with the full 250-file R13 runtime/config baseline'
    historical = json.loads((R13 / 'engine/BUILD_REPORT.json').read_text())
    assert historical['status'] == 'success' and historical['revision'] == 'result-r13'
    assert historical['exit_code'] in (0, 36) and historical['typecheck_exit_code'] == 0
    assert historical['runtime_file_sha256'] == baseline, 'Batch 1B baseline differs from the completed R13 build inputs'
    assert historical['baseline_sha256'] == sha(R13 / 'engine/BEFORE.json')
    assert historical['log'] == 'temp/result-r13-build.stdout.log'
    assert historical['log_sha256'] == sha(PROJECT / historical['log'])
    r13_tools = runpy.run_path(str(R13 / 'record_engine_build.py'))
    manifest = r13_tools['verify_imports']()
    assert historical['import_manifest_sha256'] == sha(PROJECT / 'preparation/art/RESULT_R13_IMPORT_MANIFEST.json')
    assert historical['approved_artifact_sha256'] == manifest['approved_artifact_sha256']
    assert historical['runtime_image_count'] == 85 and historical['import_manifest_entries_verified'] == 18
    assert historical['new_runtime_scripts'] == []
    assert set(historical['new_runtime_images']) == {row['import_path'] for row in manifest['entries']}

    files = [path for folder in ('assets', 'settings') for path in (PROJECT / folder).rglob('*') if path.is_file()]
    files += [PROJECT / 'package.json', PROJECT / 'tsconfig.json']
    current = hashes(files)
    assert set(current) - set(baseline) == ADDED_FILES, 'Unexpected new runtime files beyond the incident module and authorized A3 additions'
    assert not (set(baseline) - set(current)), 'An existing runtime/config file was removed'
    protected = {name: digest for name, digest in baseline.items() if name not in ALLOWED_SOURCE_CHANGES}
    changed_protected = [name for name, digest in protected.items() if current[name] != digest]
    assert not changed_protected, f'Protected art/audio/scenes/presentation/config changed: {changed_protected}'
    for suffix, expected in EXPECTED_COUNTS.items():
        assert sum(name.startswith('assets/') and name.endswith(suffix) for name in current) == expected, suffix
    assert not any(name.startswith('assets/') and name.endswith('.js') for name in current)
    verify_restricted_changes(baseline)
    verify_audio_imports(baseline)
    script_meta = json.loads((PROJECT / 'assets/batch1/incident-state.ts.meta').read_text())
    assert script_meta['importer'] == 'typescript' and script_meta['imported'] is True
    assert re.fullmatch(r'[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}', script_meta['uuid'])
    existing_uuids = {json.loads((PROJECT / name).read_text()).get('uuid') for name in baseline if name.endswith('.meta')}
    assert script_meta['uuid'] not in existing_uuids, 'Incident module UUID collides with a baseline asset'
    return baseline, current, protected, files


def stamp(log, marker):
    matches = list(re.finditer(r'(\d{4}-\d{1,2}-\d{1,2} \d{2}:\d{2}:\d{2}) - [^\n]*' + marker, log))
    assert matches, f'Missing Creator log marker: {marker}'
    match = matches[-1]
    return datetime.strptime(match[1], '%Y-%m-%d %H:%M:%S').timestamp(), match.start()


def record(args):
    assert args.exit_code in (0, 36), 'Caller reported a failing Creator exit code'
    assert args.typecheck_exit_code == 0, 'Caller reported a failing TypeScript exit code'
    log = LOG.read_text()
    started, start_index = stamp(log, r'Start build task, options:')
    completed, completion_index = stamp(log, r'build task\(web-desktop\) in \d+!')
    assert completion_index > start_index and completed >= started, 'Completion predates the latest build start'
    baseline, current, protected, files = verify_scope()
    inputs = [path for path in files if path.suffix != '.meta']
    latest = max(inputs, key=lambda path: path.stat().st_mtime)
    assert latest.stat().st_mtime < started + 1, f'Build predates current input: {latest.relative_to(PROJECT)}'
    scripts = sorted((PROJECT / 'assets').rglob('*.ts'))
    scenes = sorted((PROJECT / 'assets').rglob('*.scene'))
    configs = [path for path in files if str(path.relative_to(PROJECT)).startswith('settings/')]
    configs += [PROJECT / 'package.json', PROJECT / 'tsconfig.json']
    bundle = BUILD / 'assets/main/index.js'
    assert bundle.stat().st_mtime >= max(path.stat().st_mtime for path in scripts), 'Main bundle predates current TypeScript'
    assert started - 1 <= bundle.stat().st_mtime <= completed + 1, 'Main bundle is not from the logged build'
    assert LOG.stat().st_mtime >= completed, 'Log mtime predates completion'
    outputs = [path for path in BUILD.rglob('*') if path.is_file()]
    assert outputs and (BUILD / 'src/settings.json').is_file(), 'Missing final web build output'
    return {
        'status': 'success', 'revision': 'batch1b', 'engine': '3.8.8', 'platform': 'web-desktop',
        'recorded_at': datetime.now().astimezone().isoformat(),
        'exit_code': args.exit_code, 'typecheck_exit_code': args.typecheck_exit_code,
        'execution_result_source': 'Required caller-supplied actual process exits, independently checked against latest Creator completion and current input/output timestamps.',
        'command': f"CocosCreator --project {PROJECT} --build 'platform=web-desktop;debug=true'",
        'log': str(LOG.relative_to(PROJECT)), 'log_sha256': sha(LOG),
        'log_warning_or_error_lines': [line for line in log.splitlines() if re.search(r'\b(?:warn(?:ing)?|error)\b', line, re.I)],
        'freshness': {
            'build_started_local': datetime.fromtimestamp(started).astimezone().isoformat(),
            'build_completed_local': datetime.fromtimestamp(completed).astimezone().isoformat(),
            'latest_input': str(latest.relative_to(PROJECT)), 'latest_input_mtime': latest.stat().st_mtime,
            'main_bundle_mtime': bundle.stat().st_mtime, 'timestamp_tolerance_seconds': 1,
            'note': 'Non-meta runtime/config inputs precede the build. Existing metas are byte-identical; the sole new TypeScript meta is checked semantically and hashed after import.',
        },
        'output_sha256': hashes(outputs, BUILD), 'code_and_settings_sha256': hashes(scripts + configs),
        'scene_source_sha256': {path.name: sha(path) for path in scenes},
        'runtime_file_sha256': current, 'runtime_counts': EXPECTED_COUNTS,
        'runtime_image_count': 85, 'runtime_audio_count': EXPECTED_COUNTS['.mp3'],
        'runtime_image_sha256': {name: digest for name, digest in current.items() if name.endswith('.png')},
        'asset_meta_sha256': {name: digest for name, digest in current.items() if name.endswith('.meta')},
        'baseline_sha256': sha(BEFORE), 'historical_r13_build_report_sha256': sha(R13 / 'engine/BUILD_REPORT.json'),
        'r13_import_manifest_sha256': sha(PROJECT / 'preparation/art/RESULT_R13_IMPORT_MANIFEST.json'),
        'a3_audio_import_manifest_sha256': sha(AUDIO_IMPORT) if HAS_A3_AUDIO else None,
        'a3_audio_source_manifest_sha256': sha(PROJECT / 'preparation/audio/foley-a3/MANIFEST.json') if HAS_A3_AUDIO else None,
        'recorder_sha256': sha(Path(__file__)),
        'protected_unchanged_sha256': protected,
        'changed_existing_sources': sorted(name for name in baseline if current[name] != baseline[name]),
        'new_runtime_scripts': ['assets/batch1/incident-state.ts'], 'new_runtime_images': [],
        'new_runtime_audio': sorted(f'assets/batch1/audio/{name}.mp3' for name in AUDIO_ADDITIONS) if HAS_A3_AUDIO else [],
        'replaced_runtime_audio': sorted(f'assets/batch1/audio/{name}.mp3' for name in AUDIO_REPLACEMENTS) if HAS_A3_AUDIO else [],
        'restricted_change_checks': ['object-data: RunPhase declaration only', 'HUD: append existing full/empty star frame references only',
                                     'HeightBackdrop: explicit near-ground presentation zoom only', 'R13 imports and approved visual hashes retained'] +
                                    (['A3: preserve twelve A2 material recordings and every old audio meta; verify six replacements and four additions',
                                      'HUD audio: append four approved-scope new clips; GameAudio: ceramic mapping and exact strong-impact priority patch only'] if HAS_A3_AUDIO else []),
        'not_proven': ['Real Cocos incident/contact/physics/camera/audio behavior; see separate runtime evidence',
                       'Subjective listening acceptance of the authorized website Foley sources', 'WeChat device performance', 'Publication readiness'],
    }


def verify_recorded_build(saved):
    """Recheck a saved success report without writing; do not trust its booleans alone."""
    assert saved['status'] == 'success' and saved['revision'] == 'batch1b'
    fresh = record(SimpleNamespace(exit_code=saved['exit_code'], typecheck_exit_code=saved['typecheck_exit_code']))
    assert set(saved) == set(fresh), 'Batch 1B build report fields differ from the current recorder'
    for key in fresh:
        if key != 'recorded_at':
            assert saved[key] == fresh[key], f'Batch 1B build report no longer matches current files: {key}'
    return fresh


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exit-code', type=int, required=True, help='Actual Creator process exit code')
    parser.add_argument('--typecheck-exit-code', type=int, required=True, help='Actual preceding TypeScript process exit code')
    args = parser.parse_args()
    try:
        report = record(args)
    except (AssertionError, OSError, KeyError, ValueError, TypeError) as error:
        report = {
            'status': 'failed', 'revision': 'batch1b', 'recorded_at': datetime.now().astimezone().isoformat(),
            'error': str(error), 'exit_code': args.exit_code, 'typecheck_exit_code': args.typecheck_exit_code,
            'log': str(LOG.relative_to(PROJECT)), 'log_sha256': sha(LOG) if LOG.is_file() else None,
            'execution_result_source': 'Caller-supplied exits could not be validated; no successful build is claimed.',
        }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': report['status'], 'report': str(OUT), 'error': report.get('error')}, ensure_ascii=False))
    return 0 if report['status'] == 'success' else 1


if __name__ == '__main__':
    sys.exit(main())
