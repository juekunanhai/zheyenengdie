"""Import the approved Carefree home loop; keep every existing sound and UUID."""
from pathlib import Path
import copy
import hashlib
import json
import shutil
import uuid

ROOT = Path(__file__).resolve().parents[2]
PREP = ROOT / 'preparation'
OUT = PREP / 'audio/HOME_R4_IMPORT_MANIFEST.json'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


if OUT.exists():
    raise SystemExit('Already imported; verify the existing record instead of overwriting provenance.')
baseline = json.loads((PREP / 'review/evidence/home-r4/BEFORE.json').read_text())['runtime_file_sha256']
source_manifest = PREP / 'audio/home-r4/MANIFEST.json'
tracks = json.loads(source_manifest.read_text())['tracks']
assert len(tracks) == 1 and tracks[0]['id'] == 'bgm_home'
row = tracks[0]
source = ROOT / row['file']
target = ROOT / 'assets/batch1/audio/bgm_home.mp3'
meta_path = Path(str(target) + '.meta')
assert sha(source) == row['sha256']
assert not target.exists() and not meta_path.exists()
scene_path = ROOT / 'assets/batch0/scenes/Home.scene'
assert sha(scene_path) == baseline[str(scene_path.relative_to(ROOT))]
scene = json.loads(scene_path.read_text())
actions = [r for r in scene if 'frames' in r and 'uiSound' in r]
assert len(actions) == 1 and 'homeMusicClip' not in actions[0]
meta = copy.deepcopy(json.loads((ROOT / 'assets/batch1/audio/bgm_city.mp3.meta').read_text()))
meta['uuid'] = str(uuid.uuid5(uuid.NAMESPACE_URL, 'zhynd/audio/home-r4/bgm_home'))
meta_path.write_text(json.dumps(meta, indent=2) + '\n')
shutil.copyfile(source, target)
actions[0]['homeMusicClip'] = {'__uuid__': meta['uuid'], '__expectedType__': 'cc.AudioClip'}
scene_path.write_text(json.dumps(scene, ensure_ascii=False, indent=2) + '\n')
result = {
    'revision': 'home-r4', 'status': 'approved_for_current_use', 'listening_status': 'user_approved',
    'approval': {'user_text': '确认', 'proposal': '对局正常配乐从0.22到0.28；首页采用候选A Carefree，独立播放并在开始游戏时切换B，沿用原音乐开关。'},
    'entries': [{'id': 'bgm_home', 'kind': 'new', 'candidate': str(source.relative_to(PREP)),
                 'import_path': str(target.relative_to(ROOT)), 'sha256': sha(target),
                 'uuid': meta['uuid'], 'meta_sha256': sha(meta_path),
                 'source_manifest': str(source_manifest.relative_to(PREP)),
                 'source_manifest_sha256': sha(source_manifest)}],
    'importer_sha256': sha(Path(__file__)),
    'runtime_credits': 'assets/batch1/scene-actions.ts / Settings MusicCredits',
    'validation_boundary': 'User selected the existing Carefree audition. Loop edit, scene transitions and engine mix are verified separately.',
}
OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'added': 1, 'audio_files': len(list((ROOT / 'assets/batch1/audio').glob('*.mp3')))}))
