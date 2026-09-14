"""Verify Home music A and the approved gameplay gain change against immutable R3 evidence."""
from pathlib import Path
from datetime import datetime
from types import SimpleNamespace
import argparse, copy, hashlib, json, re, runpy, subprocess, sys, uuid, wave
import numpy as np

PROJECT = Path(__file__).resolve().parents[2]
PREP = PROJECT / 'preparation'
EVIDENCE = PREP / 'review/evidence/home-r4'
FROZEN = EVIDENCE / 'before'
BEFORE = EVIDENCE / 'BEFORE.json'
IMPORT = PREP / 'audio/HOME_R4_IMPORT_MANIFEST.json'
LOG = PROJECT / 'temp/home-r4-build.stdout.log'
BUILD = PROJECT / 'build/web-desktop'
OUT = EVIDENCE / 'BUILD_REPORT.json'
ALLOWED = {'assets/batch1/game-music.ts', 'assets/batch1/scene-actions.ts', 'assets/batch0/scenes/Home.scene'}
ADDED = {'assets/batch1/audio/bgm_home.mp3', 'assets/batch1/audio/bgm_home.mp3.meta'}
COUNTS = {'.ts': 12, '.scene': 4, '.png': 95, '.mp3': 38}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def hashes(paths, base=PROJECT):
    return {str(p.relative_to(base)): sha(p) for p in sorted(paths)}


def prior_tools():
    return runpy.run_path(str(PREP / 'tools/record_playful_build.py'))


def frozen_path(name):
    return FROZEN / (name + '.txt' if name.endswith('.ts') else name)


def verify_frozen_r3():
    saved = json.loads(BEFORE.read_text())
    assert saved['revision'] == 'home-r4' and saved['baseline_revision'] == 'playful-r3-build-R3'
    assert saved['baseline_verification'] == {'actual_exit_code': 0, 'status': 'passed_existing_build_integrity',
                                             'input_hashes_checked': 312, 'output_hashes_checked': 213, 'new_build_recorded': False}
    baseline = saved['runtime_file_sha256']
    assert len(saved['files']) == 324 and len(baseline) == 312
    assert baseline == {n: h for n, h in saved['files'].items() if not n.startswith('profiles/')}
    for name, row in saved['snapshots'].items():
        assert sha(EVIDENCE / row['file']) == row['sha256'] == saved['files'][name], 'Frozen R3 input changed: ' + name
    for name, expected in saved['historical_references_sha256'].items():
        assert sha(FROZEN / name) == expected, 'Frozen R3 history changed: ' + name
        if name != 'preparation/tools/verify_preparation.py':
            assert sha(PROJECT / name) == expected, 'Original R3 evidence/tool changed: ' + name
    prior = json.loads((FROZEN / 'preparation/review/evidence/playful-r3/BUILD_REPORT.json').read_text())
    assert prior['status'] == 'success' and prior['revision'] == 'playful-r3'
    assert prior['exit_code'] in (0, 36) and prior['typecheck_exit_code'] == 0
    assert prior['runtime_file_sha256'] == baseline and prior['runtime_counts'] == {'.ts': 12, '.scene': 4, '.png': 95, '.mp3': 37}
    assert sha(PREP / 'tools/record_playful_build.py') == prior['recorder_sha256']
    assert sha(FROZEN / prior['log']) == prior['log_sha256'] == sha(PROJECT / prior['log'])
    assert sha(PREP / 'review/evidence/playful-r3/BEFORE.json') == prior['baseline_sha256']
    for name, expected in prior['audio_provenance_sha256'].items():
        assert sha(PROJECT / name) == expected, 'Prior audio provenance changed: ' + name
    # Mutable R4 sources are read from immutable text snapshots; all retained art/audio
    # must still equal R3. There is no second compilable source tree in preparation.
    for name, expected in baseline.items():
        path = frozen_path(name) if name in ALLOWED else PROJECT / name
        assert sha(path) == expected, 'R3 source/retained asset changed: ' + name
    outputs = FROZEN / 'build/web-desktop'
    assert hashes([p for p in outputs.rglob('*') if p.is_file()], outputs) == prior['output_sha256']
    archive = json.loads((EVIDENCE / 'FROZEN_R3_OUTPUTS.json').read_text())
    assert archive['output_sha256'] == prior['output_sha256'] and archive['count'] == 213
    # Run the unchanged prior source/license/loop/decode checks. Only its current
    # change-scope check is superseded by this narrower approved successor scope.
    tools = prior_tools()
    tools['verify_baseline']()
    tools['verify_audio_imports']()
    return baseline


def verify_audio_import():
    imported = json.loads(IMPORT.read_text())
    assert imported['revision'] == 'home-r4' and imported['status'] == 'approved_for_current_use'
    assert imported['listening_status'] == 'user_approved'
    assert imported['importer_sha256'] == sha(PREP / 'tools/import_home_audio_r4.py')
    assert len(imported['entries']) == 1
    row = imported['entries'][0]
    assert row['id'] == 'bgm_home' and row['kind'] == 'new'
    assert row['import_path'] == 'assets/batch1/audio/bgm_home.mp3'
    assert row['source_manifest'] == 'audio/home-r4/MANIFEST.json'
    assert sha(PREP / row['source_manifest']) == row['source_manifest_sha256']
    path = PROJECT / row['import_path']; meta_path = Path(str(path) + '.meta')
    assert sha(path) == row['sha256'] == sha(PREP / row['candidate'])
    meta = json.loads(meta_path.read_text())
    assert sha(meta_path) == row['meta_sha256'] and meta['uuid'] == row['uuid']
    assert meta['importer'] == 'audio-clip' and meta['imported'] is True
    uuid.UUID(meta['uuid'])
    music = json.loads((PREP / row['source_manifest']).read_text())
    assert music['revision'] == 'home-r4' and music['status'] == 'approved_home_theme_A_offline_loop_prepared_for_runtime_import'
    selected = music['approval']
    assert selected['candidate_file'] == 'preparation/audio/cheerful-r2/music/exports/music_a_carefree.mp3'
    assert sha(PROJECT / selected['candidate_file']) == selected['candidate_sha256'] == '5ee6841787f20474e44dd65278675054c293cefffccbc77ce5bf71cf91789b87'
    for field in ('original', 'source_manifest', 'credits', 'master', 'generator'):
        ref = music[field]; assert sha(PROJECT / ref['file']) == ref['sha256'], 'Home music provenance changed: ' + field
    assert music['source_manifest']['file'] == 'preparation/audio/cheerful-r2/music/MANIFEST.json'
    previous = json.loads((PROJECT / music['source_manifest']['file']).read_text())
    approved = next(r for r in previous['tracks'] if r['id'] == 'music_a_carefree')
    assert approved['sha256'] == selected['candidate_sha256']
    assert approved['source_record']['file'] == music['original']['file']
    assert approved['source_record']['sha256'] == music['original']['sha256'] == '8433b770a630d9b1594fd484442c677907ece899a4d149954cd2e74fd733e311'
    for key in ('source_title', 'source_page', 'source_url', 'author', 'license', 'license_url'):
        assert music['source'][key] == approved[key]
    assert music['source']['license'] == 'CC BY 4.0' and len(music['source_evidence']) >= 3
    for evidence in music['source_evidence']:
        assert sha(PROJECT / evidence['file']) == evidence['sha256']
    assert music['attribution'] in (PROJECT / music['credits']['file']).read_text()
    assert 'Carefree' in music['attribution'] and 'https://creativecommons.org/licenses/by/4.0/' in music['attribution']
    loop = music['loop']
    assert loop['speed'] == 1 and loop['pitch_changed'] is False and loop['no_period_shortening'] is True
    assert loop['loop_intro_or_end_fade'] is False and loop['beat_count'] == 64 and loop['bar_count_4_4'] == 16
    assert loop['sample_count'] == loop['end_sample_exclusive'] - loop['start_sample']
    assert loop['sample_count'] == round(loop['beat_count'] * 60 / loop['source_tempo_bpm'] * 44100)
    assert abs(loop['duration_s'] - loop['sample_count'] / 44100) < 1e-9
    track, = music['tracks']
    assert track['id'] == 'bgm_home' and PROJECT / track['file'] == PREP / row['candidate']
    assert track['sha256'] == row['sha256'] and track['bytes'] == path.stat().st_size
    assert track['sample_rate'] == 44100 and track['channels'] == 2
    assert track['sample_count'] == loop['sample_count'] and track['duration_s'] == loop['duration_s']
    assert sha(PROJECT / track['master']) == track['master_sha256'] == music['master']['sha256']
    with wave.open(str(PROJECT / track['master']), 'rb') as wav:
        assert wav.getnframes() == loop['sample_count'] and wav.getframerate() == 44100 and wav.getnchannels() == 2 and wav.getsampwidth() == 2
    generator = runpy.run_path(str(PROJECT / music['generator']['file']))
    decoded = generator['decode'](path)
    assert len(decoded) == track['sample_count'] and np.isfinite(decoded).all() and 0 < np.max(np.abs(decoded)) < .8
    actual = generator['technical'](decoded)
    assert actual == track['loop_check'] and actual['join_within_ordinary_step_p99']
    assert actual['longest_below_minus60_dbfs_s'] == 0
    for recipe in track['sources_and_edits']:
        assert recipe['file'] == music['original']['file'] and recipe['sha256'] == music['original']['sha256']
        assert recipe['license'] == music['source']['license']
    return imported


def verify_scope():
    baseline = verify_frozen_r3()
    files = [p for folder in ('assets', 'settings') for p in (PROJECT / folder).rglob('*') if p.is_file()]
    files += [PROJECT / 'package.json', PROJECT / 'tsconfig.json']; current = hashes(files)
    assert set(current) - set(baseline) == ADDED, 'Unexpected new runtime/config files'
    assert not set(baseline) - set(current), 'Existing runtime/config input removed'
    protected = {n: h for n, h in baseline.items() if n not in ALLOWED}
    assert all(current[n] == h for n, h in protected.items()), 'Unapproved prior audio/art/physics/settings/scene changed'
    for suffix, count in COUNTS.items():
        assert sum(n.startswith('assets/') and n.endswith(suffix) for n in current) == count
    assert not any(n.startswith('assets/') and n.endswith('.js') for n in current)
    before_music = frozen_path('assets/batch1/game-music.ts').read_text()
    after_music = (PROJECT / 'assets/batch1/game-music.ts').read_text()
    assert before_music.count('incident || reacting ? .09 : .22') == 1
    assert before_music.replace('incident || reacting ? .09 : .22', 'incident || reacting ? .09 : .28') == after_music, 'Game music changed beyond approved normal gain'
    imported = verify_audio_import(); clip = imported['entries'][0]
    scene_name = 'assets/batch0/scenes/Home.scene'
    before = json.loads(frozen_path(scene_name).read_text()); after = json.loads((PROJECT / scene_name).read_text())
    assert len(before) == len(after)
    index, = [i for i, r in enumerate(before) if 'frames' in r and 'uiSound' in r]
    assert 'homeMusicClip' not in before[index]
    assert after[index]['homeMusicClip'] == {'__uuid__': clip['uuid'], '__expectedType__': 'cc.AudioClip'}
    normalized = copy.deepcopy(after); del normalized[index]['homeMusicClip']
    assert normalized == before, 'Home scene changed beyond one AudioClip reference'
    ids = {json.loads((PROJECT / n).read_text()).get('uuid') for n in baseline if n.endswith('.meta')}
    assert clip['uuid'] not in ids
    # Existing result actions and settings toggles must remain byte-for-byte intact.
    old = frozen_path('assets/batch1/scene-actions.ts').read_text(); now = (PROJECT / 'assets/batch1/scene-actions.ts').read_text()
    for begin, end in [("        } else if (scene === 'Result') {", "        } else if (scene === 'Settings') {"),
                       ("            const keys = ['music'", "    private go(scene: string)")]:
        assert old[old.index(begin):old.index(end)] == now[now.index(begin):now.index(end)], 'Unrelated scene actions changed'
    assert all(value in now for value in ('Carefree', 'Happy Boy End Theme', 'Kevin MacLeod', 'https://creativecommons.org/licenses/by/4.0', '循环剪辑与音量调整'))
    return baseline, current, protected, files


def record(args, prior_input_hashes=None):
    assert args.exit_code in (0, 36), 'Actual Creator process failed'
    assert args.typecheck_exit_code == 0, 'Actual project TypeScript process failed'
    log = LOG.read_text(); stamp = prior_tools()['previous_tools']()['stamp']
    started, start_index = stamp(log, r'Start build task, options:')
    completed, end_index = stamp(log, r'build task\(web-desktop\) in \d+!')
    assert end_index > start_index and completed >= started
    baseline, current, protected, files = verify_scope()
    if prior_input_hashes is not None:
        assert current == prior_input_hashes, 'Recorded build inputs changed'
    inputs = [p for p in files if p.suffix != '.meta']; latest = max(inputs, key=lambda p: p.stat().st_mtime)
    assert latest.stat().st_mtime < started + 1, 'Build predates current input: ' + str(latest.relative_to(PROJECT))
    bundle = BUILD / 'assets/main/index.js'
    assert started - 1 <= bundle.stat().st_mtime <= completed + 1
    assert bundle.stat().st_mtime >= max(p.stat().st_mtime for p in inputs if p.suffix == '.ts')
    assert LOG.stat().st_mtime >= completed and (BUILD / 'src/settings.json').is_file()
    outputs = [p for p in BUILD.rglob('*') if p.is_file()]
    return {'status': 'success', 'revision': 'home-r4', 'engine': '3.8.8', 'platform': 'web-desktop',
            'recorded_at': datetime.now().astimezone().isoformat(), 'exit_code': args.exit_code, 'typecheck_exit_code': args.typecheck_exit_code,
            'typecheck_command': 'Creator bundled TypeScript --noEmit --skipLibCheck',
            'execution_result_source': 'Caller-supplied actual process exits; log timing and all current input/output hashes independently checked.',
            'log': str(LOG.relative_to(PROJECT)), 'log_sha256': sha(LOG),
            'log_warning_or_error_lines': [line for line in log.splitlines() if re.search(r'\b(?:warn(?:ing)?|[a-z]*error|failed)\b', line, re.I)],
            'freshness': {'build_started_local': datetime.fromtimestamp(started).astimezone().isoformat(),
                          'build_completed_local': datetime.fromtimestamp(completed).astimezone().isoformat(),
                          'latest_input': str(latest.relative_to(PROJECT)), 'latest_input_mtime': latest.stat().st_mtime,
                          'main_bundle_mtime': bundle.stat().st_mtime, 'timestamp_tolerance_seconds': 1},
            'runtime_counts': COUNTS, 'runtime_file_sha256': current, 'output_sha256': hashes(outputs, BUILD),
            'code_and_settings_sha256': {n: h for n, h in current.items() if n.endswith('.ts') or n.startswith('settings/') or n in ('package.json', 'tsconfig.json')},
            'scene_source_sha256': {Path(n).name: h for n, h in current.items() if n.endswith('.scene')},
            'protected_unchanged_sha256': protected, 'changed_existing_sources': sorted(n for n in baseline if current[n] != baseline[n]),
            'new_runtime_audio': ['assets/batch1/audio/bgm_home.mp3'], 'replaced_runtime_audio': [],
            'baseline_sha256': sha(BEFORE), 'recorder_sha256': sha(Path(__file__)),
            'historical_r3_report_sha256': sha(FROZEN / 'preparation/review/evidence/playful-r3/BUILD_REPORT.json'),
            'historical_r3_outputs_manifest_sha256': sha(EVIDENCE / 'FROZEN_R3_OUTPUTS.json'),
            'audio_import_manifest_sha256': sha(IMPORT), 'audio_source_manifest_sha256': sha(PREP / 'audio/home-r4/MANIFEST.json'),
            'not_proven': ['First interaction, Home navigation and actual background audio lifecycle need separate new runtime evidence',
                           'Previous seven-case R3 audio evidence was not rerun by this integrity check', 'WeChat or phone behavior', 'Publication readiness']}


def verify_recorded_build(saved):
    assert saved['status'] == 'success' and saved['revision'] == 'home-r4'
    assert saved['recorder_sha256'] == sha(Path(__file__)), 'Recorder changed after build'
    fresh = record(SimpleNamespace(exit_code=saved['exit_code'], typecheck_exit_code=saved['typecheck_exit_code']), saved['runtime_file_sha256'])
    assert set(fresh) == set(saved)
    for key in fresh:
        if key != 'recorded_at':
            assert fresh[key] == saved[key], 'Recorded build evidence changed: ' + key
    return {'status': 'passed_existing_build_integrity', 'new_build_recorded': False,
            'input_hashes_checked': len(fresh['runtime_file_sha256']), 'output_hashes_checked': len(fresh['output_sha256'])}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify-only', action='store_true')
    parser.add_argument('--exit-code', type=int); parser.add_argument('--typecheck-exit-code', type=int)
    args = parser.parse_args()
    if args.verify_only:
        _, current, protected, _ = verify_scope()
        print(json.dumps({'status': 'passed_inputs_only', 'runtime_files': len(current), 'protected_files': len(protected), 'counts': COUNTS}))
        return 0
    assert args.exit_code is not None and args.typecheck_exit_code is not None, 'Supply actual process exits'
    try:
        report = record(args)
    except (AssertionError, OSError, KeyError, ValueError, TypeError, subprocess.CalledProcessError) as error:
        report = {'status': 'failed', 'revision': 'home-r4', 'error': str(error), 'exit_code': args.exit_code, 'typecheck_exit_code': args.typecheck_exit_code}
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': report['status'], 'report': str(OUT), 'error': report.get('error')}, ensure_ascii=False))
    return 0 if report['status'] == 'success' else 1


if __name__ == '__main__':
    sys.exit(main())
