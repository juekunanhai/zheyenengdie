"""Build three audition-only human-voice candidates from saved public downloads.

No synthesized layers, pitch/speed changes, runtime imports, or game writes.
Run with the bundled Python runtime (numpy required). Downloads remain byte-exact.
"""
from pathlib import Path
import hashlib
import json
import math
import re
import subprocess
import wave
import zipfile
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'preparation/audio/cheerful-r2/voice'
SRC = OUT / 'sources'
FF = '/opt/homebrew/bin/ffmpeg'
SR = 44100


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rel(path):
    return str(path.relative_to(ROOT))


def loudness(path):
    result = subprocess.run([FF, '-hide_banner', '-i', str(path), '-af',
                             'loudnorm=I=-18:TP=-3:LRA=11:print_format=json',
                             '-f', 'null', '-'], capture_output=True, check=True)
    data = json.loads(re.findall(r'\{[^{}]+\}', result.stderr.decode())[-1])
    return {'integrated_lufs': float(data['input_i']), 'true_peak_dbtp': float(data['input_tp'])}


def wav(path, signal):
    with wave.open(str(path), 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(np.rint(np.clip(signal, -1, 1)*32767).astype('<i2').tobytes())


with zipfile.ZipFile(SRC / 'cicifyre-bright-female.zip') as z:
    for name in ['01-hey.wav', '01-laughter.wav', 'readme.txt']:
        (SRC / ('cicifyre-' + name)).write_bytes(z.read('Free Voice Clips Pack - Bright Female/' + name))
with zipfile.ZipFile(SRC / 'fiftysounds-wow3.zip') as z:
    (SRC / 'fiftysounds-wow3.mp3').write_bytes(z.read('sfx-wow3.mp3'))

assert 'CC0' in (SRC / 'cicifyre-page.html').read_text()
assert 'Attribution is optional for sound effects' in (SRC / 'fiftysounds-license.html').read_text()

rows = [
    {'id': 'voice_wow', 'title': 'Wow · 惊喜短音（试听候选）', 'source': 'fiftysounds-wow3.mp3',
     'source_title': 'Sfx Strong Wow', 'author': 'FiftySounds',
     'source_page': 'https://www.fiftysounds.com/royalty-free-music/sfx-wow3.html',
     'download_url': 'https://www.fiftysounds.com/music/sfx-wow3.zip',
     'archive': 'fiftysounds-wow3.zip', 'archive_member': 'sfx-wow3.mp3',
     'license': 'FiftySounds License — free commercial game use; SFX attribution optional',
     'license_url': 'https://www.fiftysounds.com/music-license.html',
     'source_evidence': ['fiftysounds-wow.html', 'fiftysounds-license.html'],
     'description': '网站归类为人声 Wow；去掉约两秒尾部静音，保留完整感叹。',
     'human_voice_evidence': 'FiftySounds Human Sounds / Wow category and the individual Strong Wow item.',
     'source_quality': 'Author-provided original downloadable MP3 (320 kbps), not a captured stream.',
     'source_boundary': 'Website does not publish the original recording or prior processing chain; this is not claimed to be an unprocessed dry recording.',
     'trim_start_s': .02, 'trim_end_s': .90},
    {'id': 'voice_hey', 'title': 'Hey · 明快招呼（试听候选）', 'source': 'cicifyre-01-hey.wav',
     'source_title': 'Free Voice Clips Pack - Bright Female / 01-hey.wav', 'author': 'cicifyre',
     'source_page': 'https://opengameart.org/content/voice-clip-packs-for-visual-novels-and-rpgs',
     'download_url': 'https://opengameart.org/sites/default/files/Free%20Voice%20Clips%20Pack%20-%20Bright%20Female_0.zip',
     'archive': 'cicifyre-bright-female.zip', 'archive_member': 'Free Voice Clips Pack - Bright Female/01-hey.wav',
     'license': 'CC0-1.0', 'license_url': 'https://creativecommons.org/publicdomain/zero/1.0/',
     'source_evidence': ['cicifyre-page.html', 'cicifyre-readme.txt'],
     'description': '独立录制的 Hey 女声，保留原速度和音高，先试听语气是否贴合游戏。',
     'human_voice_evidence': 'Author-tagged Voice Acting / female pack, 2019 release; filename explicitly labels the spoken word.',
     'source_quality': 'Original author WAV (32-bit float) from the downloadable archive.',
     'source_boundary': 'Metadata establishes voice acting and the word, not a completed subjective listening review.',
     'trim_start_s': 0, 'trim_end_s': None},
    {'id': 'voice_chuckle', 'title': '俏皮短笑（试听候选）', 'source': 'cicifyre-01-laughter.wav',
     'source_title': 'Free Voice Clips Pack - Bright Female / 01-laughter.wav', 'author': 'cicifyre',
     'source_page': 'https://opengameart.org/content/voice-clip-packs-for-visual-novels-and-rpgs',
     'download_url': 'https://opengameart.org/sites/default/files/Free%20Voice%20Clips%20Pack%20-%20Bright%20Female_0.zip',
     'archive': 'cicifyre-bright-female.zip', 'archive_member': 'Free Voice Clips Pack - Bright Female/01-laughter.wav',
     'license': 'CC0-1.0', 'license_url': 'https://creativecommons.org/publicdomain/zero/1.0/',
     'source_evidence': ['cicifyre-page.html', 'cicifyre-readme.txt'],
     'description': '独立短笑表演，用于比较画面的趣味感；尚未赋予赞许、失败或任何游戏触发语义。',
     'human_voice_evidence': 'Author-tagged Voice Acting / female pack, 2019 release; filename explicitly labels laughter.',
     'source_quality': 'Original author WAV (32-bit float) from the downloadable archive.',
     'source_boundary': 'Whether the laugh feels friendly or mocking must be decided by listening; it is not assigned to failure feedback.',
     'trim_start_s': 0, 'trim_end_s': None},
]

for row in rows:
    source = SRC / row.pop('source')
    raw = subprocess.check_output([FF, '-v', 'error', '-i', str(source), '-ar', str(SR), '-ac', '1', '-f', 'f32le', '-'])
    full = np.frombuffer(raw, '<f4').astype(float)
    end = row['trim_end_s'] if row['trim_end_s'] is not None else len(full)/SR
    signal = full[round(row['trim_start_s']*SR):round(end*SR)].copy()
    dc = float(np.mean(signal)); signal -= dc
    signal[:round(.002*SR)] *= np.linspace(0, 1, round(.002*SR))
    signal[-round(.012*SR):] *= np.linspace(1, 0, round(.012*SR))
    master = OUT / (row['id'] + '.wav')
    encoded = OUT / (row['id'] + '.mp3')
    wav(master, signal)
    before = loudness(master)
    gain_db = min(-18 - before['integrated_lufs'], -3 - before['true_peak_dbtp'], 6)
    signal *= 10**(gain_db/20)
    wav(master, signal)
    subprocess.run([FF, '-v', 'error', '-y', '-i', str(master), '-c:a', 'libmp3lame', '-b:a', '192k', '-write_xing', '1', str(encoded)], check=True)
    subprocess.run([FF, '-v', 'error', '-i', str(encoded), '-f', 'null', '-'], check=True)
    metrics = loudness(encoded)
    assert metrics['true_peak_dbtp'] < -2
    assert .4 <= len(signal)/SR <= 1.5
    row.update({'file': rel(encoded), 'master': rel(master), 'duration_s': round(len(signal)/SR, 6),
                'bytes': encoded.stat().st_size, 'sha256': sha(encoded), 'master_sha256': sha(master),
                'source_file': rel(source), 'source_sha256': sha(source),
                'source_archive': rel(SRC / row['archive']), 'source_archive_sha256': sha(SRC / row['archive']),
                'source_evidence': [{'file': rel(SRC / x), 'sha256': sha(SRC / x)} for x in row['source_evidence']],
                'metrics': metrics, 'sample_rate': SR, 'channels': 1,
                'processing': {'trim_start_s': row['trim_start_s'], 'trim_end_s': round(end, 6),
                               'source_decoded_duration_s': round(len(full)/SR, 6),
                               'resample_hz': SR, 'mono_downmix': True, 'dc_removed': dc,
                               'fade_in_s': .002, 'fade_out_s': .012, 'gain_db': round(gain_db, 4),
                               'target_lufs': -18, 'true_peak_ceiling_dbtp': -3,
                               'upward_gain_cap_db': 6, 'speed_ratio': 1, 'pitch_shift_semitones': 0,
                               'compression': False, 'synthesized_layers': False},
                'status': 'audition_candidate', 'listening_status': 'not_reviewed', 'imported_into_game': False})

manifest = {'revision': '2026-09-14-cheerful-voice-r2', 'path_base': 'project_root',
            'status': 'audition_candidates_only', 'imported_into_game': False,
            'listening_status': 'not_reviewed', 'download_date': '2026-09-14',
            'technical_checks': 'All three MP3s decode successfully; measured LUFS and true peaks are recorded per item.',
            'boundary': 'Source descriptions, licenses, duration and encoding were checked. No subjective audio quality, tone or in-game timing is claimed verified.',
            'excluded_research_downloads': ['sources/kenney_voiceover-pack.zip'],
            'research_note': 'Freesound candidates were not used because the site returned temporary busy/502/503 responses. No login-only original downloads were attempted.',
            'items': rows}
(OUT / 'MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(json.dumps([{'id': r['id'], 'file': r['file'], 'duration_s': r['duration_s'], **r['metrics']} for r in rows], ensure_ascii=False, indent=2))
