"""Import the approved B loop and three approved voices, preserving old UUIDs."""
from pathlib import Path
import copy
import hashlib
import json
import shutil
import uuid

ROOT = Path(__file__).resolve().parents[2]
PREP = ROOT / 'preparation'
OUT = PREP / 'audio/PLAYFUL_R3_IMPORT_MANIFEST.json'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


if OUT.exists():
    raise SystemExit('Already imported; verify the recorded revision rather than overwriting provenance.')
baseline = json.loads((PREP / 'review/evidence/playful-r3/BEFORE.json').read_text())['files']
music_manifest = PREP / 'audio/playful-r3/MANIFEST.json'
voice_manifest = PREP / 'audio/cheerful-r2/voice/MANIFEST.json'
music = json.loads(music_manifest.read_text())['tracks']
voices = json.loads(voice_manifest.read_text())['items']
assert {r['id'] for r in music} == {'bgm_city', 'bgm_cloud', 'bgm_space'}
assert {r['id'] for r in voices} == {'voice_wow', 'voice_hey', 'voice_chuckle'}
entries = []
audio_meta = json.loads((ROOT / 'assets/batch1/audio/impact_soft_1.mp3.meta').read_text())
for rows, source_manifest, kind in [(music, music_manifest, 'replacement'), (voices, voice_manifest, 'new')]:
    for row in rows:
        source = ROOT / row['file']
        target = ROOT / 'assets/batch1/audio' / (row['id'] + '.mp3')
        relative = str(target.relative_to(ROOT))
        meta_path = Path(str(target) + '.meta')
        assert sha(source) == row['sha256']
        previous = None
        if kind == 'replacement':
            previous = sha(target)
            assert previous == baseline[relative]
            assert sha(meta_path) == baseline[relative + '.meta']
        else:
            assert not target.exists() and not meta_path.exists()
            meta = copy.deepcopy(audio_meta)
            meta['uuid'] = str(uuid.uuid5(uuid.NAMESPACE_URL, 'zhynd/audio/playful-r3/' + row['id']))
            meta_path.write_text(json.dumps(meta, indent=2) + '\n')
        shutil.copyfile(source, target)
        meta = json.loads(meta_path.read_text())
        entry = {'id': row['id'], 'kind': kind, 'candidate': str(source.relative_to(PREP)),
                 'import_path': relative, 'sha256': sha(target), 'uuid': meta['uuid'],
                 'meta_sha256': sha(meta_path), 'source_manifest': str(source_manifest.relative_to(PREP)),
                 'source_manifest_sha256': sha(source_manifest)}
        if previous:
            entry['previous_sha256'] = previous
        entries.append(entry)

scene_path = ROOT / 'assets/batch0/scenes/HUD.scene'
assert sha(scene_path) == baseline[str(scene_path.relative_to(ROOT))]
scene = json.loads(scene_path.read_text())
controllers = [r for r in scene if 'frames' in r and 'approvedSounds' in r]
assert len(controllers) == 1
for row in entries:
    if row['kind'] == 'new':
        controllers[0]['approvedSounds'].append({'__uuid__': row['uuid'], '__expectedType__': 'cc.AudioClip'})
scene_path.write_text(json.dumps(scene, ensure_ascii=False, indent=2) + '\n')
result = {'revision': 'playful-r3', 'status': 'approved_for_current_use', 'listening_status': 'user_approved',
          'approval': '确认，配乐选择b。其余音效均认可，尝试找到切入的地方，开始开发',
          'entries': entries, 'importer_sha256': sha(Path(__file__)),
          'music_arrangement': 'Three existing region references use the same approved B loop; all instruments retained',
          'runtime_credits': 'assets/batch1/scene-actions.ts / Settings MusicCredits',
          'validation_boundary': 'Approved candidate listening; loop edit and in-game triggering validated separately'}
OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'replaced': 3, 'added': 3, 'runtime_audio_count': 37}))
