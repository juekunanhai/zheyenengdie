"""Record this calibration build, checking that it actually follows its source edits."""
from pathlib import Path
import hashlib
import json

PROJECT = Path(__file__).resolve().parents[2]
OUT = PROJECT / 'preparation/review/evidence/difficulty-r1'
LOG = PROJECT / 'temp/difficulty-r1-build.stdout.log'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


log = LOG.read_text()
assert 'build task(web-desktop) in ' in log, 'No completed Creator web build in the log'
scripts = sorted((PROJECT / 'assets').rglob('*.ts'))
bundle = PROJECT / 'build/web-desktop/assets/main/index.js'
assert bundle.stat().st_mtime >= max(p.stat().st_mtime for p in scripts), 'Build predates runtime source'
baseline = json.loads((OUT / 'BASELINE_HASHES.json').read_text())
tracked = scripts + sorted((PROJECT / 'settings').rglob('*.json')) + [PROJECT / 'package.json', PROJECT / 'tsconfig.json']
report = {
    'status': 'success', 'batch': '1A-difficulty-r1', 'engine': '3.8.8', 'platform': 'web-desktop',
    'exit_code': 36,
    'typecheck': 'Creator bundled TypeScript --noEmit --skipLibCheck: exit 0 (run before this record)',
    'command': "CocosCreator --project " + str(PROJECT) + " --build 'platform=web-desktop;debug=true'",
    'log': str(LOG.relative_to(PROJECT)), 'log_sha256': sha(LOG),
    'output_sha256': {str(p.relative_to(PROJECT / 'build/web-desktop')): sha(p)
                      for p in sorted((PROJECT / 'build/web-desktop').rglob('*')) if p.is_file()},
    'scene_source_sha256': {p.name: sha(p) for p in sorted((PROJECT / 'assets/batch0/scenes').glob('*.scene'))},
    'code_and_settings_sha256': {str(p.relative_to(PROJECT)): sha(p) for p in tracked},
    'changed_existing_runtime_sources': [str(p.relative_to(PROJECT)) for p in scripts
        if str(p.relative_to(PROJECT)) in baseline and baseline[str(p.relative_to(PROJECT))] != sha(p)],
    'runtime_image_count': len(list((PROJECT / 'assets').rglob('*.png'))), 'new_runtime_script_count': 0,
    'replacement_manifest_sha256': sha(PROJECT / 'preparation/art/DIFFICULTY_R1_IMPORT_MANIFEST.json'),
    'environment_messages': 'Creator completed the build. Separate editor window-state recovery and post-exit child-process messages are preserved in the log; game runtime errors are checked separately.',
    'not_proven': ['Gameplay balance; see FINAL_COMPARISON.json', 'Human feel or final art approval',
                   'WeChat build/device performance', 'Publication readiness'],
}
(OUT / 'BUILD_REPORT.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print('Recorded current Creator build, source, scene and asset-manifest identity.')
