"""Record the authorized local WeChat R2 build; no upload, device, or package-limit claim."""
from pathlib import Path
from datetime import datetime
from collections import Counter
import hashlib, json, re, sys

EVIDENCE = Path(__file__).resolve().parent
PROJECT = EVIDENCE.parents[2]
PREP = PROJECT / 'preparation'
BUILD = PROJECT / 'build/wechatgame'
BEFORE = EVIDENCE / 'BEFORE.json'
CONFIG = PREP / 'platform/wechat-build.json'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inventory(directory):
    return {str(p.relative_to(directory)): sha(p) for p in sorted(directory.rglob('*')) if p.is_file()}


def stamp(log, marker):
    matches = list(re.finditer(r'(\d{4}-\d{1,2}-\d{1,2} \d{2}:\d{2}:\d{2}) - [^\n]*' + marker, log))
    assert matches, 'Missing Creator log marker: ' + marker
    return datetime.strptime(matches[-1][1], '%Y-%m-%d %H:%M:%S').timestamp(), matches[-1].start()


def verify_scope():
    before = json.loads(BEFORE.read_text())
    assert before['revision'] == 'wechat-r2' and before['baseline_verification']['actual_exit_code'] == 0
    expected = before['runtime_file_sha256']
    paths = [p for d in ('assets', 'settings') for p in (PROJECT / d).rglob('*') if p.is_file()]
    paths += [PROJECT / 'package.json', PROJECT / 'tsconfig.json']
    actual = {str(p.relative_to(PROJECT)): sha(p) for p in sorted(paths)}
    assert actual == expected and len(actual) == 314, 'Runtime/meta/art/audio/physics/config content changed'
    for suffix, count in {'.ts': 12, '.scene': 4, '.png': 95, '.mp3': 38}.items():
        assert sum(n.startswith('assets/') and n.endswith(suffix) for n in actual) == count
    for name, row in before['snapshots'].items():
        assert sha(EVIDENCE / row['file']) == row['sha256'], 'Frozen source/config snapshot changed: ' + name
    for name, h in before['historical_reference_sha256'].items():
        assert sha(EVIDENCE / 'before' / name) == h == sha(PROJECT / name), 'Original historical evidence changed: ' + name
    assert inventory(EVIDENCE / 'before/build/wechatgame') == before['prior_wechat_output_sha256']
    web = inventory(PROJECT / 'build/web-desktop')
    assert web == before['web_output_sha256'] and len(web) == 214, 'Existing Web output changed'
    original = before['approved_configuration_before']
    assert sha(EVIDENCE / 'before' / original['file']) == original['sha256']
    old = json.loads((EVIDENCE / 'before' / original['file']).read_text()); assert old == original['value']
    delta = before['expected_authorized_configuration_delta']
    assert set(delta) == {'startScene', 'mainBundleCompressionType'}
    assert delta['mainBundleCompressionType'] == 'subpackage'
    assert delta['startScene'] == json.loads((PROJECT / 'assets/batch0/scenes/Home.scene.meta').read_text())['uuid']
    assert not set(delta).intersection(old)
    configuration = json.loads(CONFIG.read_text())
    assert configuration == {**old, **delta}, 'Configuration change exceeds the two approved additions'
    profiles = inventory(PROJECT / 'profiles')
    profiles = {'profiles/' + n: h for n, h in profiles.items()}
    profile_changes = {n: {'before': before['profiles_sha256'].get(n), 'after': profiles.get(n)}
                       for n in before['profiles_sha256'].keys() | profiles.keys() if before['profiles_sha256'].get(n) != profiles.get(n)}
    mtime_changes = {}
    for name, row in before['snapshots'].items():
        if not name.startswith('settings/'):
            continue
        old_mtime = (EVIDENCE / row['file']).stat().st_mtime; now = (PROJECT / name).stat().st_mtime
        if now != old_mtime:
            mtime_changes[name] = {'before': old_mtime, 'after': now, 'sha256_unchanged': actual[name]}
    return before, actual, configuration, profile_changes, mtime_changes


def record():
    before, runtime, configuration, profiles, mtimes = verify_scope()
    process_path = EVIDENCE / 'PROCESS_RESULT.json'; command_path = EVIDENCE / 'COMMAND.json'
    process = json.loads(process_path.read_text()); command = json.loads(command_path.read_text())
    assert process['creator_exit_code'] in (0, 36), 'Actual Creator process failed'
    assert process['exit_source'] == 'subprocess.run actual Creator returncode'
    assert command['argv'] == ['/Applications/CocosCreator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator',
                               '--project', str(PROJECT), '--build', 'configPath=' + str(CONFIG)]
    assert command['config'] == str(CONFIG.relative_to(PROJECT)) and command['config_sha256'] == sha(CONFIG)
    log_path = PROJECT / process['log']; assert log_path == EVIDENCE / 'BUILD.stdout.log'
    assert sha(log_path) == process['log_sha256']
    log = log_path.read_text()
    started, begin = stamp(log, r'Start build task, options:')
    completed, end = stamp(log, r'build task\(wechatgame\) in \d+!')
    assert end > begin and completed >= started
    assert datetime.fromisoformat(process['started_at']).timestamp() <= started + 1
    assert datetime.fromisoformat(process['completed_at']).timestamp() >= completed
    assert CONFIG.stat().st_mtime < started + 1
    # Runtime is byte-identical to the successful R4 Web build. Creator may rewrite
    # identical settings with a new mtime; this is reported without editing R4 evidence.
    sources = [p for p in (PROJECT / 'assets').rglob('*') if p.is_file() and p.suffix != '.meta']
    assert max(p.stat().st_mtime for p in sources) < started + 1, 'Build predates runtime source input'
    snapshot_path = EVIDENCE / 'CREATOR_OUTPUT_SNAPSHOT.json'; snapshot = json.loads(snapshot_path.read_text())
    assert snapshot['process_result_sha256'] == sha(process_path)
    assert not snapshot['files_newer_than_creator_end'], 'Post-process writes occurred before the initial snapshot'
    initial = snapshot['output_sha256']; current = inventory(BUILD)
    sizes_path = EVIDENCE / 'CREATOR_FILE_SIZES.json'; size_record = json.loads(sizes_path.read_text())
    assert size_record['output_snapshot_sha256'] == sha(snapshot_path)
    sizes = size_record['file_bytes']
    assert set(sizes) == set(initial) and sum(sizes.values()) == snapshot['unpacked_bytes']
    mutations = {n: {'post_creator': initial.get(n), 'current': current.get(n)}
                 for n in initial.keys() | current.keys() if initial.get(n) != current.get(n)}
    assert set(mutations) <= {'project.config.json', 'project.private.config.json'}, 'Unexpected generated output mutation after Creator'
    frozen = EVIDENCE / 'generated-after-creator'
    for path in frozen.rglob('*'):
        if path.is_file():
            assert sha(path) == initial[str(path.relative_to(frozen))]
    game = json.loads((frozen / 'game.json').read_text()); settings = json.loads((frozen / 'src/settings.json').read_text())
    project = json.loads((frozen / 'project.config.json').read_text())
    assert project['appid'] == configuration['packages']['wechatgame']['appid'] == 'wxc0360e0c829a3307'
    assert project['compileType'] == 'game' and project['setting']['minified'] is True
    assert game['deviceOrientation'] == configuration['packages']['wechatgame']['orientation'] == 'portrait'
    assert settings['CocosEngine'] == '3.8.8' and settings['engine']['platform'] == 'wechatgame' and settings['engine']['debug'] is True
    assert settings['launch']['launchScene'] == 'db://assets/batch0/scenes/Home.scene'
    assert settings['assets']['preloadBundles'] == [{'bundle': 'main'}]
    assert settings['assets']['server'] == '' and settings['assets']['remoteBundles'] == []
    packages = game['subpackages']
    assert {p['name'] for p in packages} == set(settings['assets']['subpackages']) == {'main', 'internal'}
    roots = {}
    for package in packages:
        name, root = package['name'], package['root']; assert root == f'subpackages/{name}/'
        folder = BUILD / root; assert folder.is_dir()
        data = json.loads((folder / 'config.json').read_text()); assert data['name'] == name
        roots[name] = root
    internal = json.loads((frozen / 'subpackages/internal/config.json').read_text())
    assert set(settings['engine']['builtinAssets']) <= set(internal['uuids'])
    main_script = BUILD / roots['main'] / 'game.js'
    assert sha(main_script) == sha(PROJECT / 'build/web-desktop/assets/main/index.js'), 'Compiled project/physics differs from current Web code'
    assert started - 1 <= main_script.stat().st_mtime <= completed + 1
    # Verify each declared AudioClip against its UUID-native file, including duplicate
    # B music payloads. Compare image hashes to used Web resources, not all unused art.
    audio_rows = []
    for path in sorted((PROJECT / 'assets').rglob('*.mp3')):
        identity = json.loads(Path(str(path) + '.meta').read_text())['uuid']
        native = BUILD / roots['main'] / 'native' / identity[:2] / (identity + '.mp3')
        assert native.is_file() and sha(native) == sha(path), 'Packaged audio mismatch: ' + path.name
        audio_rows.append({'source': str(path.relative_to(PROJECT)), 'packaged': str(native.relative_to(BUILD)), 'sha256': sha(path)})
    runtime_png = {sha(p) for p in (PROJECT / 'assets').rglob('*.png')}
    web_png = {sha(p) for p in (PROJECT / 'build/web-desktop').rglob('*.png')} & runtime_png
    wechat_png = {sha(p) for p in BUILD.rglob('*.png')} & runtime_png
    assert web_png == wechat_png and len(web_png) == 73, 'Used PNG payloads differ from current Web build'
    wasm = []
    old_wasm = {h for n, h in before['prior_wechat_output_sha256'].items() if n.endswith('.wasm')}
    for path in BUILD.rglob('*.wasm'):
        assert sha(path) in old_wasm, 'Physics WASM changed from prior WeChat output'
        wasm.append({'file': str(path.relative_to(BUILD)), 'sha256': sha(path), 'bytes': path.stat().st_size})
    assert len(wasm) == 1 and 'box2d' in wasm[0]['file']
    engine_configuration = json.loads((PROJECT / 'settings/v2/packages/engine.json').read_text())
    assert engine_configuration['modules']['configs']['defaultConfig']['cache']['physics-2d']['_option'] == 'physics-2d-box2d-wasm'
    by_package = {}
    for name, root in roots.items():
        names = [n for n in initial if n.startswith(root)]
        by_package[name] = {'root': root, 'files': len(names), 'unpacked_bytes': sum(sizes[n] for n in names)}
    non_packages = [n for n in initial if not any(n.startswith(root) for root in roots.values())]
    # Two possible DevTools config mutations must not alter the initial raw byte total.
    main_package_bytes = snapshot['unpacked_bytes'] - sum(p['unpacked_bytes'] for p in by_package.values())
    extensions = {}
    for name in initial:
        suffix = Path(name).suffix
        row = extensions.setdefault(suffix, {'files': 0, 'unpacked_bytes': 0}); row['files'] += 1
        row['unpacked_bytes'] += sizes[name]
    return {'status': 'local_creator_build_and_static_checks_passed', 'revision': 'wechat-r2',
            'recorded_at': datetime.now().astimezone().isoformat(), 'process': process,
            'freshness': {'creator_log_started_local': datetime.fromtimestamp(started).astimezone().isoformat(),
                          'creator_log_completed_local': datetime.fromtimestamp(completed).astimezone().isoformat(),
                          'latest_runtime_source_mtime': max(p.stat().st_mtime for p in sources),
                          'compiled_main_mtime': main_script.stat().st_mtime, 'timestamp_tolerance_seconds': 1},
            'process_result_sha256': sha(process_path), 'command_sha256': sha(command_path), 'baseline_sha256': sha(BEFORE),
            'recorder_sha256': sha(Path(__file__)), 'config_sha256': sha(CONFIG), 'configuration_delta': before['expected_authorized_configuration_delta'],
            'runtime_file_sha256': runtime, 'runtime_counts': {'.ts': 12, '.scene': 4, '.png': 95, '.mp3': 38},
            'existing_web_output_sha256': before['web_output_sha256'], 'existing_web_content_unchanged': True,
            'settings_identical_content_mtime_changes': mtimes, 'profiles_content_changes': profiles,
            'output_snapshot_sha256': sha(snapshot_path), 'post_creator_file_sizes_sha256': sha(sizes_path),
            'post_creator_output_sha256': initial, 'current_output_sha256': current,
            'developer_tools_config_side_effects': mutations,
            'generated': {'appid': project['appid'], 'orientation': game['deviceOrientation'], 'launch_scene': settings['launch']['launchScene'],
                          'subpackages': packages, 'preload_bundles': settings['assets']['preloadBundles'], 'remote_bundles': [],
                          'builtin_assets_verified_in_internal': len(settings['engine']['builtinAssets']),
                          'compiled_project_equals_current_web_sha256': sha(main_script)},
            'packaged_audio': audio_rows, 'used_runtime_png_sha256': sorted(web_png), 'unused_source_png_count': 95 - len(web_png),
            'physics_source_sha256': {n: h for n, h in runtime.items() if n.endswith(('/tower-world.ts', '/object-data.ts', '/incident-state.ts'))},
            'physics_wasm': wasm,
            'unpacked_size_observations': {'snapshot_stage': 'filesystem after Creator and before newer IDE writes',
                                         'all_files': snapshot['file_count'], 'total_bytes': snapshot['unpacked_bytes'],
                                         'wechat_main_package': {'files': len(non_packages), 'unpacked_bytes': main_package_bytes},
                                         'declared_subpackages': by_package, 'by_extension': extensions,
                                         'boundary': 'Raw filesystem bytes only; not DevTools packaged size, upload size, or package-limit acceptance.'},
            'log_warning_or_error_lines': [line for line in log.splitlines() if re.search(r'\b(?:warn(?:ing)?|[a-z]*error|failed)\b', line, re.I)],
            'not_proven': ['DevTools actual package statistics or running behavior', 'Real device, native background, touch, audio, WASM performance',
                           'Any upload, preview upload, remote hosting, or publication', 'New Web build or rerun of historical audio engine tests']}


if __name__ == '__main__':
    try:
        report = record()
    except (AssertionError, OSError, KeyError, ValueError, TypeError) as error:
        report = {'status': 'failed', 'revision': 'wechat-r2', 'error': str(error)}
    destination = EVIDENCE / 'BUILD_REPORT.json'
    destination.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': report['status'], 'report': str(destination), 'error': report.get('error')}, ensure_ascii=False))
    sys.exit(0 if report['status'] != 'failed' else 1)
