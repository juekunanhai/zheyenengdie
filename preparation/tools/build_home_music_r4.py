#!/usr/bin/env python3
"""Prepare the approved Carefree home loop, without writing runtime assets/config.

Uses only existing local source/candidate/license files, numpy, and ffmpeg. No
network, time stretching, pitch shifting, synthesized layer, or generic framework.
"""
from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'preparation/audio/home-r4'
PRIOR = ROOT / 'preparation/audio/cheerful-r2/music'
SOURCE = PRIOR / 'sources/Carefree.mp3'
CANDIDATE = PRIOR / 'exports/music_a_carefree.mp3'
SOURCE_HASH = '8433b770a630d9b1594fd484442c677907ece899a4d149954cd2e74fd733e311'
CANDIDATE_HASH = '5ee6841787f20474e44dd65278675054c293cefffccbc77ce5bf71cf91789b87'
FFMPEG = '/opt/homebrew/bin/ffmpeg'
SR = 44100
START_SECONDS = 19.92
BPM = 96
BEATS = 64
JOIN_SECONDS = .060
TARGET_LUFS = -22.3


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def run(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(args, capture_output=True, text=True, check=True)


def decode(path: Path) -> np.ndarray:
    data = subprocess.check_output([FFMPEG, '-v', 'error', '-i', str(path),
                                    '-ar', str(SR), '-ac', '2', '-f', 'f32le', '-'])
    return np.frombuffer(data, dtype='<f4').reshape(-1, 2).astype(np.float64)


def save_wav(path: Path, samples: np.ndarray) -> None:
    assert np.max(np.abs(samples)) < 1, 'Do not silently clip the source.'
    with wave.open(str(path), 'wb') as stream:
        stream.setnchannels(2)
        stream.setsampwidth(2)
        stream.setframerate(SR)
        stream.writeframes(np.rint(samples * 32767).astype('<i2').tobytes())


def encode(source: Path, target: Path) -> None:
    run([FFMPEG, '-y', '-v', 'error', '-i', str(source), '-map_metadata', '-1',
         '-c:a', 'libmp3lame', '-b:a', '192k', '-ar', str(SR), '-ac', '2',
         '-write_xing', '1', str(target)])


def loudness(path: Path) -> dict:
    result = run([FFMPEG, '-hide_banner', '-nostats', '-i', str(path), '-af',
                  'loudnorm=I=-22.3:TP=-2.5:LRA=20:print_format=json', '-f', 'null', '-'])
    data = result.stderr
    value = json.loads(data[data.rfind('{'):data.rfind('}') + 1])
    return {'integrated_lufs': float(value['input_i']),
            'true_peak_dbfs': float(value['input_tp']), 'loudness_range_lu': float(value['input_lra'])}


def technical(samples: np.ndarray) -> dict:
    jump = float(np.max(np.abs(samples[0] - samples[-1])))
    delta = np.abs(np.diff(samples, axis=0))
    edge = np.concatenate((samples[-int(.1 * SR):], samples[:int(.1 * SR)]))
    blocks = samples[:len(samples) // 441 * 441].reshape(-1, 441, 2)
    rms = np.sqrt(np.mean(blocks ** 2, axis=(1, 2)))
    silent = rms < 10 ** (-60 / 20)
    longest = current = 0
    for item in silent:
        current = current + 1 if item else 0
        longest = max(longest, current)
    return {'sample_count': len(samples), 'decoded_duration_s': len(samples) / SR,
            'sample_rate_hz': SR, 'channels': 2, 'peak_sample': float(np.max(np.abs(samples))),
            'join_step_absolute': jump, 'ordinary_step_p99': float(np.quantile(delta, .99)),
            'join_within_ordinary_step_p99': bool(jump <= np.quantile(delta, .99)),
            'edge_200ms_rms_dbfs': float(20 * np.log10(np.sqrt(np.mean(edge ** 2)) + 1e-12)),
            'longest_below_minus60_dbfs_s': longest * .01,
            'finite': bool(np.isfinite(samples).all())}


def onset_evidence(samples: np.ndarray) -> dict:
    """Verify the source grid around the chosen phrase, not subjective phrasing."""
    mono = samples[:int(70 * SR)].mean(axis=1)[::2]
    rate, hop, size = SR / 2, 110, 1024
    frames = np.lib.stride_tricks.sliding_window_view(mono, size)[::hop]
    spectrum = np.abs(np.fft.rfft(frames * np.hanning(size)))
    flux = np.maximum(np.diff(np.log1p(spectrum * 10), axis=0), 0).mean(axis=1)
    found, beats = [], list(range(0, 68, 4))
    for beat in beats:
        expected = 20 + beat * 60 / BPM
        low = int((expected - .08) * rate / hop)
        high = int((expected + .08) * rate / hop)
        index = low + int(np.argmax(flux[low:high]))
        found.append((index * hop + size / 2) / rate)
    slope, intercept = np.polyfit(beats, found, 1)
    return {'method': 'positive log-spectral flux; strongest local onset near each 4-beat bar',
            'onset_seconds': found, 'fitted_beat_seconds': float(slope),
            'fitted_bpm': float(60 / slope), 'grid_residual_max_ms': float(np.max(np.abs(
                np.asarray(found) - (intercept + slope * np.asarray(beats)))) * 1000),
            'caveat': 'Measures pulse timing only, not subjective musical phrasing or timbre.'}


def main() -> None:
    assert sha(SOURCE) == SOURCE_HASH and sha(CANDIDATE) == CANDIDATE_HASH
    for name in ('masters', 'encoded', 'review', 'evidence'):
        (OUT / name).mkdir(parents=True, exist_ok=True)
    source = decode(SOURCE)
    start, length, join = round(START_SECONDS * SR), round(BEATS * 60 / BPM * SR), round(JOIN_SECONDS * SR)
    end = start + length
    loop = source[start:end].copy()
    # Exact 40-second period; blend continuous post-roll into the first 60 ms.
    # Start is 80 ms before the bar, so the short repair ends before its attack.
    ramp = (0.5 - 0.5 * np.cos(np.linspace(0, np.pi, join)))[:, None]
    loop[:join] = source[end:end + join] * (1 - ramp) + loop[:join] * ramp
    measure = OUT / 'masters/music_home_measure.wav'
    save_wav(measure, loop * .5)
    before = loudness(measure)
    gain_db = TARGET_LUFS - before['integrated_lufs'] + 20 * np.log10(.5)
    master, encoded = OUT / 'masters/music_home_loop.wav', OUT / 'encoded/bgm_home.mp3'
    save_wav(master, loop * 10 ** (gain_db / 20))
    encode(master, encoded)
    decoded = decode(encoded)
    assert len(decoded) == length, 'MP3 must retain the exact sample count via gapless metadata.'
    seam = np.concatenate((decoded[-3 * SR:], decoded[:3 * SR]))
    save_wav(OUT / 'review/loop_join_3s_before_after.wav', seam)
    encode(OUT / 'review/loop_join_3s_before_after.wav', OUT / 'review/loop_join_3s_before_after.mp3')
    save_wav(OUT / 'review/two_cycles.wav', np.tile(decoded, (2, 1)))
    encode(OUT / 'review/two_cycles.wav', OUT / 'review/two_cycles.mp3')
    master_check, mp3_check, after = technical(decode(master)), technical(decoded), loudness(encoded)
    assert mp3_check['finite'] and mp3_check['peak_sample'] < 1
    assert mp3_check['join_within_ordinary_step_p99']
    assert mp3_check['longest_below_minus60_dbfs_s'] == 0
    assert abs(after['integrated_lufs'] - TARGET_LUFS) < .5
    assert after['true_peak_dbfs'] < -2.5
    source_manifest = PRIOR / 'MANIFEST.json'
    approved = next(t for t in json.loads(source_manifest.read_text())['tracks'] if t['id'] == 'music_a_carefree')
    catalog = json.loads((PRIOR / 'evidence/pieces.json').read_text())
    catalog_item = next(t for t in catalog if t.get('isrc') == 'USUAN1400037')
    (OUT / 'evidence/catalog-item.json').write_text(json.dumps(catalog_item, ensure_ascii=False, indent=2) + '\n')
    for name in ('incompetech-license.html', 'cc-by-4.0.html'):
        shutil.copyfile(PRIOR / 'evidence' / name, OUT / 'evidence' / name)
    changes = ('64-beat / 16-bar mid-song excerpt; 60 ms periodic boundary overlap; '
               'constant-gain level adjustment; MP3 re-encoding. No tempo/pitch change, no added '
               'instruments, no stem separation, compressor, limiter or end fade.')
    credit = ('"Carefree" — Kevin MacLeod (incompetech.com). Licensed under Creative Commons Attribution 4.0: '
              'https://creativecommons.org/licenses/by/4.0/ '
              'Source: https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400037 '
              f'Changes: {changes}')
    (OUT / 'CREDITS.txt').write_text(credit + '\n')
    output = {'id': 'bgm_home', 'file': rel(encoded), 'sha256': sha(encoded), 'bytes': encoded.stat().st_size,
              'duration_s': length / SR, 'master': rel(master), 'master_sha256': sha(master),
              'sample_rate': SR, 'channels': 2, 'sample_count': length, 'loop_check': mp3_check,
              'sources_and_edits': [{'file': rel(SOURCE), 'sha256': sha(SOURCE),
                                     'license': approved['license'], 'license_url': approved['license_url'],
                                     'changes': changes}]}
    manifest = {
        'revision': 'home-r4', 'file_base': 'project_root',
        'status': 'approved_home_theme_A_offline_loop_prepared_for_runtime_import',
        'approval': {'user_decision_summary': 'User confirmed earlier candidate A Carefree for Home, distinct from gameplay B; prepare a loop and integrate.',
                     'candidate_file': rel(CANDIDATE), 'candidate_sha256': CANDIDATE_HASH,
                     'scope': 'Home music only. Gameplay music B is preserved; this script does not change runtime gains.'},
        'source': {key: approved[key] for key in ('source_title', 'source_page', 'source_url', 'author',
                                                 'license', 'license_url', 'source_instruments', 'instrumentation_caveat')},
        'original': {'file': rel(SOURCE), 'sha256': sha(SOURCE), 'bytes': SOURCE.stat().st_size,
                     'format': 'Author full downloadable MP3; not lossless studio stems'},
        'source_manifest': {'file': rel(source_manifest), 'sha256': sha(source_manifest)},
        'source_evidence': [{'file': rel(path), 'sha256': sha(path), 'bytes': path.stat().st_size}
                            for path in sorted((OUT / 'evidence').iterdir())],
        'credits': {'file': rel(OUT / 'CREDITS.txt'), 'sha256': sha(OUT / 'CREDITS.txt')},
        'loop': {'start_sample': start, 'end_sample_exclusive': end, 'source_start_s': start / SR,
                 'source_end_s': end / SR, 'sample_count': length, 'duration_s': length / SR,
                 'source_tempo_bpm': BPM, 'beat_count': BEATS, 'bar_count_4_4': BEATS // 4,
                 'seam_overlap_samples': join, 'seam_overlap_s': join / SR,
                 'method': 'continuous source post-roll wrapped into head with complementary raised-cosine weights',
                 'no_period_shortening': True, 'speed': 1.0, 'pitch_changed': False,
                 'constant_gain_db': float(gain_db), 'loop_intro_or_end_fade': False,
                 'selection': '19.92–59.92 s mid-song phrase, starting 80 ms before the nominal bar and retaining source orchestration.'},
        'tracks': [output], 'attribution': credit,
        'master': {'file': rel(master), 'sha256': sha(master)},
        'checks': {'master': master_check, 'encoded': mp3_check, 'loudness': after,
                   'onset_grid': onset_evidence(source)},
        'review': ['preparation/audio/home-r4/review/loop_join_3s_before_after.mp3',
                   'preparation/audio/home-r4/review/two_cycles.mp3'],
        'listening_boundary': 'Technical boundary checks passed; subjective join and actual Cocos/WeChat decoder looping require runtime review.',
        'generator': {'file': rel(Path(__file__)), 'sha256': sha(Path(__file__)),
                       'ffmpeg': run([FFMPEG, '-version']).stdout.splitlines()[0]},
    }
    (OUT / 'MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    (OUT / 'REVIEW.md').write_text(f'''# 首页配乐 A 运行循环 R4

本轮用户已确认首页使用此前候选 A“Carefree”，与对局 B“Happy Boy End Theme”区分。此离线包未导入 assets，不调整对局音量。

- 来源为 Kevin MacLeod 官网完整 MP3，CC BY 4.0。原始文件、获批候选、许可证据、母版和输出 SHA-256 均记录在 MANIFEST 中；没有新增下载。
- 原曲 {start / SR:.2f}–{end / SR:.2f} 秒，中段连续 16 小节/64 拍，{length / SR:.2f} 秒、{length:,} 个采样点、44.1 kHz 双声道。来源标注与局部节拍测量均约 96 BPM，原速原调。
- 保留源文件完整乐器编配，没有新增电子音色、分轨重写、压缩器或限制器。起点位于小节前约 80 ms，前 60 ms 将连续的原始尾音渐变到片段开头，不缩短乐句、不在结尾淡出。
- 实际 MP3 大小 {encoded.stat().st_size:,} 字节，解码 LUFS {after['integrated_lufs']:.2f}、真峰值 {after['true_peak_dbfs']:.2f} dBFS；没有削波、NaN 或低于 −60 dBFS 的 10 ms 静音帧。边界采样差 {mp3_check['join_step_absolute']:.6f}，低于普通相邻采样差第 99 百分位 {mp3_check['ordinary_step_p99']:.6f}。

[接缝前后三秒](review/loop_join_3s_before_after.mp3)的中点为实际 MP3 解码接缝；[连续两圈](review/two_cycles.mp3)用于复核乐句重复与衔接。技术检查不等于主观听感或实际引擎/手机解码循环验收。

重建脚本：`preparation/tools/build_home_music_r4.py`。完整署名见 [CREDITS.txt](CREDITS.txt)。
''')
    print(json.dumps({'file': rel(encoded), 'sha256': sha(encoded), 'bytes': encoded.stat().st_size,
                      'loudness': after, 'encoded_checks': mp3_check}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
