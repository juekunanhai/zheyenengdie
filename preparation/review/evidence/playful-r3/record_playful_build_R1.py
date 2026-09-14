"""Verify the approved B music/three voices revision without weakening frozen Batch 1C evidence."""
from pathlib import Path
from datetime import datetime
from types import SimpleNamespace
import argparse, copy, hashlib, json, re, runpy, subprocess, sys, uuid, wave
import numpy as np

PROJECT = Path(__file__).resolve().parents[2]
PREP = PROJECT / 'preparation'
EVIDENCE = PREP / 'review/evidence/playful-r3'
BEFORE = EVIDENCE / 'BEFORE.json'
FROZEN = EVIDENCE / 'before'
IMPORT = PREP / 'audio/PLAYFUL_R3_IMPORT_MANIFEST.json'
LOG = PROJECT / 'temp/playful-r3-build.stdout.log'
BUILD = PROJECT / 'build/web-desktop'
OUT = EVIDENCE / 'BUILD_REPORT.json'
MUSIC = {'bgm_city', 'bgm_cloud', 'bgm_space'}
VOICES = {'voice_wow', 'voice_hey', 'voice_chuckle'}
ALLOWED = {f'assets/batch1/{name}.ts' for name in ('game-controller', 'game-audio', 'game-music')}
ALLOWED.add('assets/batch1/scene-actions.ts')
ALLOWED |= {'assets/batch0/scenes/HUD.scene'} | {f'assets/batch1/audio/{name}.mp3' for name in MUSIC}
ADDED = {f'assets/batch1/audio/{name}.mp3{suffix}' for name in VOICES for suffix in ('', '.meta')}
COUNTS = {'.ts': 12, '.scene': 4, '.png': 95, '.mp3': 37}
FFMPEG = '/opt/homebrew/bin/ffmpeg'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def hashes(paths, base=PROJECT):
    return {str(p.relative_to(base)): sha(p) for p in sorted(paths)}


def previous_tools():
    return runpy.run_path(str(PREP / 'tools/record_batch1c_build.py'))


def verify_baseline():
    saved = json.loads(BEFORE.read_text())
    assert saved['revision'] == 'playful-r3' and saved['baseline_revision'] == 'batch1c-web-r7'
    assert saved['baseline_verification']['actual_exit_code'] == 0
    assert saved['baseline_verification']['status'] == 'passed_integrity_only'
    assert len(saved['files']) == 318
    for name, expected in saved['frozen_files'].items():
        assert expected == saved['files'][name] == sha(FROZEN / name), 'Frozen baseline input changed: ' + name
    for name, expected in saved['historical_audio_source_snapshots'].items():
        assert sha(FROZEN / name) == expected == sha(PROJECT / name), 'Historical audio provenance changed: ' + name
    for name, expected in saved['historical_references_sha256'].items():
        assert sha(FROZEN / name) == expected, 'Frozen historical reference changed: ' + name
        if name != 'preparation/tools/verify_preparation.py':
            assert sha(PROJECT / name) == expected, 'Historical record/tool changed: ' + name
    prior = json.loads((FROZEN / 'preparation/review/evidence/batch1c/BUILD_REPORT.json').read_text())
    assert prior['status'] == 'success' and prior['revision'] == 'batch1c'
    assert prior['exit_code'] in (0, 36) and prior['typecheck_exit_code'] == 0
    baseline = {name: value for name, value in saved['files'].items() if not name.startswith('profiles/')}
    assert len(baseline) == 306 and baseline == prior['runtime_file_sha256']
    assert sha(PROJECT / prior['log']) == prior['log_sha256']
    assert sha(PREP / 'review/evidence/batch1c/BEFORE.json') == prior['baseline_sha256']
    for key, name in [('art_import_manifest_sha256', 'art/BATCH1C_IMPORT_MANIFEST.json'),
                      ('geometry_manifest_sha256', 'design/batch1c/GEOMETRY.json'),
                      ('audio_import_manifest_sha256', 'audio/BATCH1C_AUDIO_IMPORT_MANIFEST.json'),
                      ('audio_source_manifest_sha256', 'audio/batch1c/MANIFEST.json')]:
        assert sha(PREP / name) == prior[key]
    for name, expected in prior['art_revision_evidence_sha256'].items():
        assert sha(PROJECT / name) == expected
    previous_tools()['verify_historical_chain']()
    return baseline


def verify_prior_audio():
    """Run the unchanged 1C verifier on its frozen audio originals, with live source recipes.

    Only that function's explicit PROJECT root is set to the frozen snapshot. Its PREP root
    remains live, so candidate/master/recipe/license evidence is still checked on every run.
    The successor's scope check separately protects all retained runtime audio bytes.
    """
    verify_baseline()
    old = previous_tools()
    baseline = old['verify_historical_chain']()
    function = old['verify_audio_imports']
    function.__globals__['PROJECT'] = FROZEN
    return function(baseline)


def verify_voice_source(row):
    source_path = PREP / row['source_manifest']
    assert source_path == PREP / 'audio/cheerful-r2/voice/MANIFEST.json'
    item = next(v for v in json.loads(source_path.read_text())['items'] if v['id'] == row['id'])
    assert PROJECT / item['file'] == PREP / row['candidate']
    assert item['sha256'] == row['sha256']
    for path_key, hash_key in [('master', 'master_sha256'), ('source_file', 'source_sha256'),
                                ('source_archive', 'source_archive_sha256')]:
        assert sha(PROJECT / item[path_key]) == item[hash_key]
    for evidence in item['source_evidence']:
        assert sha(PROJECT / evidence['file']) == evidence['sha256']
    assert item['author'] and item['source_page'].startswith('https://') and item['license']
    assert item['processing']['speed_ratio'] == 1 and item['processing']['pitch_shift_semitones'] == 0
    assert item['processing']['synthesized_layers'] is False
    assert item['sample_rate'] == 44100 and item['channels'] == 1
    return item


def verify_music_source():
    path = PREP / 'audio/playful-r3/MANIFEST.json'; music = json.loads(path.read_text())
    assert music['revision'] == 'playful-r3' and music['file_base'] == 'project_root'
    assert music['status'] == 'approved_theme_B_offline_loop_prepared_for_runtime_import'
    candidate = music['approval']
    assert candidate['candidate_file'] == 'preparation/audio/cheerful-r2/music/exports/music_b_happy_boy.mp3'
    assert sha(PROJECT / candidate['candidate_file']) == candidate['candidate_sha256'] == 'a6e6a4546bf43c0b365cb8cb3fc71e734549416c71573051aafec8d31ae73107'
    for field in ('original', 'source_manifest', 'credits', 'master', 'generator'):
        row = music[field]; assert sha(PROJECT / row['file']) == row['sha256'], 'Music provenance changed: ' + field
    assert music['generator']['file'] == 'preparation/tools/build_playful_music_r3.py'
    assert music['source_manifest']['file'] == 'preparation/audio/cheerful-r2/music/MANIFEST.json'
    prior = json.loads((PROJECT / music['source_manifest']['file']).read_text())
    selected = next(row for row in prior['tracks'] if row['id'] == 'music_b_happy_boy')
    assert selected['sha256'] == candidate['candidate_sha256']
    assert selected['source_record']['sha256'] == music['original']['sha256'] == '3215d6630ae7d3ff9be86c7a610a973a78b2e3db0cd17ef4651453fc3c3a0f78'
    assert selected['source_record']['file'] == music['original']['file']
    for key in ('source_title', 'source_page', 'source_url', 'author', 'license', 'license_url'):
        assert music['source'][key] == selected[key], 'Music source identity changed: ' + key
    assert music['source']['license'] == 'CC BY 4.0'
    assert len(music['source_evidence']) >= 3
    for row in music['source_evidence']:
        assert sha(PROJECT / row['file']) == row['sha256']
    assert music['attribution'] in (PROJECT / music['credits']['file']).read_text()
    assert 'Kevin MacLeod' in music['attribution'] and 'https://creativecommons.org/licenses/by/4.0/' in music['attribution']
    loop = music['loop']; assert loop['speed'] == 1 and loop['pitch_changed'] is False
    assert loop['beat_count'] == 32 and loop['no_period_shortening'] is True and loop['loop_intro_or_end_fade'] is False
    assert loop['sample_count'] == loop['end_sample_exclusive'] - loop['start_sample']
    assert loop['sample_count'] == round(loop['beat_count'] * 60 / loop['source_local_tempo_bpm'] * 44100)
    assert abs(loop['duration_s'] - loop['sample_count'] / 44100) < 1e-9
    assert {row['id'] for row in music['tracks']} == MUSIC and len(music['tracks']) == 3
    assert len({row['sha256'] for row in music['tracks']}) == 1
    assert music['height_variants']['all_instruments_retained'] is True
    assert music['height_variants']['audible_change_at_height_boundary'] is False
    with wave.open(str(PROJECT / music['master']['file']), 'rb') as wav:
        assert wav.getframerate() == 44100 and wav.getnchannels() == 2 and wav.getsampwidth() == 2
        assert wav.getnframes() == loop['sample_count']
    return music


def verify_audio_imports(baseline=None):
    baseline = baseline or verify_baseline()
    imported = json.loads(IMPORT.read_text())
    assert imported['revision'] == 'playful-r3' and imported['status'] == 'approved_for_current_use'
    assert imported['listening_status'] == 'user_approved'
    assert imported['importer_sha256'] == sha(PREP / 'tools/import_playful_audio_r3.py')
    assert len(imported['entries']) == 6 and {r['id'] for r in imported['entries']} == MUSIC | VOICES
    old = {r['id']: r for r in verify_prior_audio()['entries']}
    approved = json.loads((PREP / 'audio/cheerful-r2/MANIFEST.json').read_text())
    approved_voices = {r['id']: r for r in approved['voice']}
    music = verify_music_source()
    music_rows = {row['id']: row for row in music['tracks']}
    music_builder = runpy.run_path(str(PROJECT / music['generator']['file']))
    lengths = []
    for row in imported['entries']:
        name = row['id']; path = PROJECT / row['import_path']; meta_path = Path(str(path) + '.meta')
        assert row['import_path'] == f'assets/batch1/audio/{name}.mp3'
        assert sha(path) == row['sha256'] == sha(PREP / row['candidate'])
        assert sha(PREP / row['source_manifest']) == row['source_manifest_sha256']
        meta = json.loads(meta_path.read_text())
        assert sha(meta_path) == row['meta_sha256'] and meta['uuid'] == row['uuid']
        assert meta['importer'] == 'audio-clip' and meta['imported'] is True
        uuid.UUID(meta['uuid'])
        decoded = subprocess.run([FFMPEG, '-v', 'error', '-i', str(path), '-f', 'f32le', '-acodec', 'pcm_f32le',
                                  '-ar', '44100', '-ac', '2' if name in MUSIC else '1', 'pipe:1'],
                                 check=True, capture_output=True).stdout
        samples = np.frombuffer(decoded, dtype='<f4')
        assert samples.size and np.isfinite(samples).all() and 0 < np.max(np.abs(samples)) < .8
        if name in MUSIC:
            assert row['kind'] == 'replacement'
            assert row['previous_sha256'] == baseline[row['import_path']] == old[name]['sha256']
            assert row['uuid'] == old[name]['uuid'] and row['meta_sha256'] == old[name]['meta_sha256']
            assert row['source_manifest'] == 'audio/playful-r3/MANIFEST.json'
            track = music_rows[name]
            assert PROJECT / track['file'] == PREP / row['candidate'] and track['sha256'] == row['sha256']
            assert track['bytes'] == path.stat().st_size
            assert track['sample_rate'] == 44100 and track['channels'] == 2
            assert sha(PROJECT / track['master']) == track['master_sha256'] == music['master']['sha256']
            assert track['sample_count'] == samples.size // 2 == music['loop']['sample_count']
            assert track['duration_s'] == music['loop']['duration_s']
            actual_checks = music_builder['technical'](samples.reshape(-1, 2).astype(np.float64))
            assert actual_checks == track['loop_check'], 'Recorded MP3 seam/decode metrics no longer match'
            assert actual_checks['join_within_ordinary_step_p99'] and actual_checks['longest_below_minus60_dbfs_s'] == 0
            for recipe in track['sources_and_edits']:
                assert recipe['file'] == music['original']['file'] and recipe['sha256'] == music['original']['sha256']
                assert recipe['license'] == music['source']['license']
            lengths.append(samples.size // 2)
        else:
            assert row['kind'] == 'new' and row['import_path'] not in baseline
            assert row['sha256'] == approved_voices[name]['sha256']
            item = verify_voice_source(row)
            assert abs(samples.size / 44100 - item['duration_s']) < .002
    assert len(set(lengths)) == 1 and lengths[0] == music['loop']['sample_count'], 'Three phase music files must share transport length'
    return imported


def verify_scope():
    baseline = verify_baseline()
    files = [p for folder in ('assets', 'settings') for p in (PROJECT / folder).rglob('*') if p.is_file()]
    files += [PROJECT / 'package.json', PROJECT / 'tsconfig.json']
    current = hashes(files)
    assert set(current) - set(baseline) == ADDED, 'Unexpected new runtime/config files'
    assert not set(baseline) - set(current), 'Existing runtime/config input removed'
    protected = {name: value for name, value in baseline.items() if name not in ALLOWED}
    assert all(current[name] == value for name, value in protected.items()), 'Protected physics/art/scene/meta/config changed'
    for suffix, count in COUNTS.items():
        assert sum(name.startswith('assets/') and name.endswith(suffix) for name in current) == count, suffix
    assert not any(name.startswith('assets/') and name.endswith('.js') for name in current)
    imported = verify_audio_imports(baseline)
    original = json.loads((FROZEN / 'assets/batch0/scenes/HUD.scene').read_text())
    scene = json.loads((PROJECT / 'assets/batch0/scenes/HUD.scene').read_text())
    assert len(scene) == len(original)
    index, = [i for i, row in enumerate(original) if 'frames' in row and 'approvedSounds' in row]
    previous = original[index]['approvedSounds']; actual = scene[index]['approvedSounds']
    additions = [{'__uuid__': row['uuid'], '__expectedType__': 'cc.AudioClip'} for row in imported['entries'] if row['id'] in VOICES]
    assert actual[:len(previous)] == previous
    assert sorted(json.dumps(x, sort_keys=True) for x in actual[len(previous):]) == sorted(json.dumps(x, sort_keys=True) for x in additions)
    normalized = copy.deepcopy(scene); normalized[index]['approvedSounds'] = previous
    assert normalized == original, 'HUD changed beyond appending three audio references'
    old_actions = (FROZEN / 'assets/batch1/scene-actions.ts').read_text()
    actions = (PROJECT / 'assets/batch1/scene-actions.ts').read_text()
    match = re.search(r"(?<=\} else if \(scene === 'Settings'\) \{\n)([\s\S]*?)(?=            const keys =)", actions)
    assert match and 'new Node(\'MusicCredits\')' in match[0]
    assert all(text in match[0] for text in ('Happy Boy End Theme', 'Kevin MacLeod', 'incompetech.com',
                                           'CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0', '循环剪辑与音量调整'))
    assert not any(text in match[0] for text in ('bindAction(', 'director.', 'readSettings(', 'writeSettings(', 'GameAudio('))
    normalized_actions = actions[:match.start()] + actions[match.end():]
    for symbol in ('Color, ', 'Label, ', 'Node, ', 'UITransform, '):
        normalized_actions = normalized_actions.replace(symbol, '', 1)
    # UITransform is the final import in the current explicit cc import list.
    normalized_actions = normalized_actions.replace(', UITransform }', ' }', 1)
    assert normalized_actions == old_actions, 'Scene actions changed beyond static music attribution'
    old_ids = {json.loads((PROJECT / name).read_text()).get('uuid') for name in baseline if name.endswith('.meta')}
    new_ids = [json.loads((PROJECT / name).read_text())['uuid'] for name in ADDED if name.endswith('.meta')]
    assert len(new_ids) == len(set(new_ids)) == 3 and not old_ids.intersection(new_ids)
    return baseline, current, protected, files


def record(args, prior_input_hashes=None):
    assert args.exit_code in (0, 36), 'Actual Creator process failed'
    assert args.typecheck_exit_code == 0, 'Actual TypeScript process failed'
    log = LOG.read_text(); stamp = previous_tools()['stamp']
    started, start_index = stamp(log, r'Start build task, options:')
    completed, end_index = stamp(log, r'build task\(web-desktop\) in \d+!')
    assert end_index > start_index and completed >= started
    baseline, current, protected, files = verify_scope()
    inputs = [p for p in files if p.suffix != '.meta']; latest = max(inputs, key=lambda p: p.stat().st_mtime)
    if prior_input_hashes is not None:
        assert current == prior_input_hashes, 'Recorded input bytes changed'
    assert latest.stat().st_mtime < started + 1, 'Build predates current input: ' + str(latest.relative_to(PROJECT))
    bundle = BUILD / 'assets/main/index.js'
    assert started - 1 <= bundle.stat().st_mtime <= completed + 1
    assert bundle.stat().st_mtime >= max(p.stat().st_mtime for p in inputs if p.suffix == '.ts')
    assert LOG.stat().st_mtime >= completed and (BUILD / 'src/settings.json').is_file()
    outputs = [p for p in BUILD.rglob('*') if p.is_file()]
    imported = json.loads(IMPORT.read_text())
    provenance = {str(IMPORT.relative_to(PROJECT)): sha(IMPORT)}
    for row in imported['entries']:
        for name in (row['source_manifest'], row['candidate']):
            provenance['preparation/' + name] = sha(PREP / name)
    return {'status': 'success', 'revision': 'playful-r3', 'engine': '3.8.8', 'platform': 'web-desktop',
            'recorded_at': datetime.now().astimezone().isoformat(), 'exit_code': args.exit_code,
            'typecheck_exit_code': args.typecheck_exit_code,
            'execution_result_source': 'Caller-supplied actual process exits; current input/output hashes and Creator log timing independently checked.',
            'log': str(LOG.relative_to(PROJECT)), 'log_sha256': sha(LOG),
            'log_warning_or_error_lines': [line for line in log.splitlines() if re.search(r'\b(?:warn(?:ing)?|[a-z]*error|failed)\b', line, re.I)],
            'freshness': {'build_started_local': datetime.fromtimestamp(started).astimezone().isoformat(),
                          'build_completed_local': datetime.fromtimestamp(completed).astimezone().isoformat(),
                          'latest_input': str(latest.relative_to(PROJECT)), 'latest_input_mtime': latest.stat().st_mtime,
                          'main_bundle_mtime': bundle.stat().st_mtime, 'timestamp_tolerance_seconds': 1},
            'runtime_counts': COUNTS, 'runtime_file_sha256': current, 'output_sha256': hashes(outputs, BUILD),
            'protected_unchanged_sha256': protected, 'changed_existing_sources': sorted(n for n in baseline if current[n] != baseline[n]),
            'new_runtime_audio': sorted(f'assets/batch1/audio/{name}.mp3' for name in VOICES),
            'replaced_runtime_audio': sorted(f'assets/batch1/audio/{name}.mp3' for name in MUSIC),
            'baseline_sha256': sha(BEFORE), 'recorder_sha256': sha(Path(__file__)),
            'historical_batch1c_build_report_sha256': sha(PREP / 'review/evidence/batch1c/BUILD_REPORT.json'),
            'audio_provenance_sha256': provenance,
            'not_proven': ['Engine playback, reaction timing and pause/settings lifecycle require separate runtime evidence',
                           'WeChat or physical device behavior', 'Publication readiness']}


def verify_recorded_build(saved):
    assert saved['status'] == 'success' and saved['revision'] == 'playful-r3'
    assert saved['recorder_sha256'] == sha(Path(__file__)), 'Build recorder changed after recording'
    fresh = record(SimpleNamespace(exit_code=saved['exit_code'], typecheck_exit_code=saved['typecheck_exit_code']), saved['runtime_file_sha256'])
    assert set(fresh) == set(saved)
    for key in fresh:
        if key != 'recorded_at':
            assert saved[key] == fresh[key], 'Recorded build evidence changed: ' + key
    return {'status': 'passed_existing_build_integrity', 'new_build_recorded': False,
            'input_hashes_checked': len(fresh['runtime_file_sha256']), 'output_hashes_checked': len(fresh['output_sha256'])}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify-only', action='store_true')
    parser.add_argument('--exit-code', type=int)
    parser.add_argument('--typecheck-exit-code', type=int)
    args = parser.parse_args()
    if args.verify_only:
        _, current, protected, _ = verify_scope()
        print(json.dumps({'status': 'passed_inputs_only', 'runtime_files': len(current), 'protected_files': len(protected), 'counts': COUNTS}))
        return 0
    assert args.exit_code is not None and args.typecheck_exit_code is not None, 'Supply actual process exits'
    try:
        report = record(args)
    except (AssertionError, OSError, KeyError, ValueError, TypeError, subprocess.CalledProcessError) as error:
        report = {'status': 'failed', 'revision': 'playful-r3', 'error': str(error),
                  'exit_code': args.exit_code, 'typecheck_exit_code': args.typecheck_exit_code}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': report['status'], 'report': str(OUT), 'error': report.get('error')}, ensure_ascii=False))
    return 0 if report['status'] == 'success' else 1


if __name__ == '__main__':
    sys.exit(main())
