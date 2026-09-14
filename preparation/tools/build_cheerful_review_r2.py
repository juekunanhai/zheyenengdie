"""Build the five-candidate listening index and two offline combinations only."""
from pathlib import Path
import hashlib
import json
import subprocess
import wave
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'preparation/audio/cheerful-r2'
FF = '/opt/homebrew/bin/ffmpeg'
SR = 44100


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def decode(path):
    data = subprocess.check_output([FF, '-v', 'error', '-i', str(path), '-ar', str(SR),
                                    '-ac', '2', '-f', 'f32le', '-'])
    signal = np.frombuffer(data, '<f4').reshape(-1, 2).astype(float)
    assert np.isfinite(signal).all() and np.max(abs(signal)) > 0
    return signal


def prep_relative(path):
    return str(path.relative_to(ROOT / 'preparation'))


music_manifest = OUT / 'music/MANIFEST.json'
voice_manifest = OUT / 'voice/MANIFEST.json'
music = json.loads(music_manifest.read_text())['tracks']
voices = json.loads(voice_manifest.read_text())['items']
assert len(music) == 2 and len(voices) == 3


def listening_row(row, label):
    path = ROOT / row['file']
    assert path.is_file() and sha(path) == row['sha256']
    return {
        'id': row['id'], 'label': label, 'title': row['title'],
        'description': row['description'], 'duration_s': row['duration_s'],
        'file': prep_relative(path), 'sha256': row['sha256'],
        'source_page': row['source_page'], 'author': row['author'],
        'license': row['license'], 'license_url': row['license_url'],
        'note': row.get('loop_note', ''),
    }


voice_pcm = [decode(ROOT / row['file']) for row in voices]
positions = [5, 10, 15]
signals = []
for row in music:
    base = decode(ROOT / row['file'])[:20 * SR].copy()
    assert len(base) == 20 * SR
    envelope = np.ones(len(base))
    overlay = np.zeros_like(base)
    for sample, second in zip(voice_pcm, positions):
        start = second * SR
        end = start + len(sample)
        assert end + round(.25 * SR) < len(base)
        attack = round(.06 * SR)
        release = round(.25 * SR)
        envelope[start - attack:start] = np.linspace(1, .42, attack)
        envelope[start:end] = .42
        envelope[end:end + release] = np.linspace(.42, 1, release)
        overlay[start:end] += sample
    signal = base * envelope[:, None] + overlay
    signal[-SR:] *= np.linspace(1, 0, SR)[:, None]
    signals.append(signal)

# The same fixed gain on both demos keeps their relative levels comparable.
common_gain = min(1, .75 / max(np.max(abs(s)) for s in signals))
(OUT / 'mix').mkdir(exist_ok=True)
mixes = []
for label, signal, row in zip(['A', 'B'], signals, music):
    signal *= common_gain
    master = OUT / 'mix' / f'mix_{label.lower()}.wav'
    encoded = master.with_suffix('.mp3')
    with wave.open(str(master), 'wb') as stream:
        stream.setnchannels(2)
        stream.setsampwidth(2)
        stream.setframerate(SR)
        stream.writeframes(np.rint(signal * 32767).astype('<i2').tobytes())
    subprocess.run([FF, '-v', 'error', '-y', '-i', str(master), '-c:a', 'libmp3lame',
                    '-b:a', '192k', '-write_xing', '1', str(encoded)], check=True)
    decoded = decode(encoded)
    assert len(decoded) == len(signal) and np.max(abs(decoded)) < .89
    mixes.append({
        'id': 'mix_' + label.lower(), 'label': label + ' 组合',
        'title': '配乐 ' + label + ' ＋ 三个人声',
        'description': '按 V1 → V2 → V3 的顺序出现，比较人声与音乐的搭配。',
        'duration_s': len(decoded) / SR, 'file': prep_relative(encoded),
        'sha256': sha(encoded), 'master_sha256': sha(master),
        'source_page': None, 'author': None, 'license': 'See individual source licenses',
        'note': '离线混音示范；尚未接入游戏。',
        'processing': {'music': row['id'], 'voice_ids': [v['id'] for v in voices],
                       'voice_times_s': positions, 'music_duck_gain': .42,
                       'duck_attack_s': .06, 'duck_release_s': .25,
                       'common_output_gain': float(common_gain),
                       'end_fade_s': 1, 'pitch_or_speed_change': False},
        'decoded_peak_dbfs': float(20 * np.log10(np.max(abs(decoded)))),
    })

voice_credits = '\n\n'.join(v['title'] + ' — ' + v['author'] + '\n' +
                              v['source_page'] + '\n' + v['license'] for v in voices)
old_source = ROOT / 'preparation/audio/batch1c/encoded/bgm_city.mp3'
old_matched = OUT / 'mix/previous_level_matched.mp3'
# Old input measures -24.26 LUFS; both new music candidates measure about -22.3.
# This is an audition-only copy, with constant gain and no dynamics processing.
subprocess.run([FF, '-v', 'error', '-y', '-i', str(old_source), '-af', 'volume=1.96dB',
                '-c:a', 'libmp3lame', '-b:a', '192k', '-write_xing', '1', str(old_matched)], check=True)
decode(old_matched)
result = {
    'revision': 'cheerful-r2', 'status': 'audition_candidates_only',
    'imported_into_game': False, 'user_listening_status': 'pending',
    'file_base': 'preparation',
    'music': [listening_row(r, label) for r, label in zip(music, ['A', 'B'])],
    'voice': [listening_row(r, label) for r, label in zip(voices, ['V1', 'V2', 'V3'])],
    'mix': mixes,
    'reference': {'file': prep_relative(old_matched), 'sha256': sha(old_matched),
                  'source': prep_relative(old_source), 'source_sha256': sha(old_source),
                  'constant_gain_db': 1.96, 'runtime_source_unchanged': True},
    'credits': (OUT / 'music/CREDITS.txt').read_text() + '\n' + voice_credits +
               '\n\n组合示范改动：截取前 20 秒，与本页人声混合；人声期间音乐降低音量，末尾淡出。',
    'source_manifests': [{'file': prep_relative(p), 'sha256': sha(p)}
                         for p in [music_manifest, voice_manifest]],
    'builder_sha256': sha(Path(__file__)),
    'boundaries': ['No runtime audio or configuration changes',
                   'No subjective listening claim; user audition pending',
                   'Not loop-ready or engine-mix tested'],
}
(OUT / 'MANIFEST.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'candidates': 5, 'mixes': 2, 'mix_duration_s': 20,
                  'common_gain': float(common_gain)}, ensure_ascii=False))
