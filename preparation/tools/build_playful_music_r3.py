#!/usr/bin/env python3
"""Build the user-selected B theme's offline loop; never modify runtime assets.

Requirements: Python + numpy, ffmpeg/ffprobe. Source and audition remain immutable.
The join overlaps the source's continuous post-roll into the first 60 ms, without
shortening the 32-beat period or time-stretching/pitch-shifting the performance.
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
OUT = ROOT / 'preparation/audio/playful-r3'
SOURCE = ROOT / 'preparation/audio/cheerful-r2/music/sources/Happy Boy End Theme.mp3'
CANDIDATE = ROOT / 'preparation/audio/cheerful-r2/music/exports/music_b_happy_boy.mp3'
SOURCE_HASH = '3215d6630ae7d3ff9be86c7a610a973a78b2e3db0cd17ef4651453fc3c3a0f78'
CANDIDATE_HASH = 'a6e6a4546bf43c0b365cb8cb3fc71e734549416c71573051aafec8d31ae73107'
FFMPEG = '/opt/homebrew/bin/ffmpeg'
FFPROBE = '/opt/homebrew/bin/ffprobe'
SR = 44100
START_SECONDS = 15.55
LOCAL_BEAT_SECONDS = 60 / 134
BEATS = 32
JOIN_SECONDS = .060
TARGET_LUFS = -22.3
TRACKS = ('bgm_city', 'bgm_cloud', 'bgm_space')


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
    pcm = np.rint(samples * 32767).astype('<i2')
    with wave.open(str(path), 'wb') as stream:
        stream.setnchannels(2)
        stream.setsampwidth(2)
        stream.setframerate(SR)
        stream.writeframes(pcm.tobytes())


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
    """Measure local onset grid, independent of the author's whole-piece BPM tag."""
    mono = samples.mean(axis=1)[::2]
    rate, hop, size = SR / 2, 110, 1024
    frames = np.lib.stride_tricks.sliding_window_view(mono, size)[::hop]
    spectrum = np.abs(np.fft.rfft(frames * np.hanning(size)))
    flux = np.maximum(np.diff(np.log1p(spectrum * 10), axis=0), 0).mean(axis=1)
    found = []
    for beat in range(0, 32, 2):
        expected = 15.68 + beat * LOCAL_BEAT_SECONDS
        low = int((expected - .08) * rate / hop)
        high = int((expected + .08) * rate / hop)
        index = low + int(np.argmax(flux[low:high]))
        found.append((index * hop + size / 2) / rate)
    slope, intercept = np.polyfit(np.arange(len(found)) * 2, found, 1)
    return {'method': 'positive log-spectral flux; strongest local onset near each second beat',
            'onset_seconds': found, 'fitted_beat_seconds': float(slope),
            'fitted_bpm': float(60 / slope), 'grid_residual_max_ms': float(np.max(np.abs(
                np.asarray(found) - (intercept + slope * np.arange(len(found)) * 2))) * 1000),
            'caveat': 'Measures pulse timing only, not subjective musical phrasing or timbre.'}


def main() -> None:
    assert sha(SOURCE) == SOURCE_HASH and sha(CANDIDATE) == CANDIDATE_HASH
    for name in ('masters', 'encoded', 'review', 'evidence'):
        (OUT / name).mkdir(parents=True, exist_ok=True)
    source = decode(SOURCE)
    start = round(START_SECONDS * SR)
    length = round(BEATS * LOCAL_BEAT_SECONDS * SR)
    join = round(JOIN_SECONDS * SR)
    end = start + length
    loop = source[start:end].copy()
    # This fade preserves a fixed musical period. It is not an end fade or a
    # conventional overlap that shortens the clip and drifts the beat grid.
    ramp = (0.5 - 0.5 * np.cos(np.linspace(0, np.pi, join)))[:, None]
    loop[:join] = source[end:end + join] * (1 - ramp) + loop[:join] * ramp
    # Measurement before gain uses attenuation only because the full MP3 can
    # contain over-unity reconstructed peaks. No compression/limiter is applied.
    measure = OUT / 'masters/music_b_loop_measure.wav'
    save_wav(measure, loop * .5)
    before = loudness(measure)
    gain_db = TARGET_LUFS - before['integrated_lufs'] + 20 * np.log10(.5)
    master = OUT / 'masters/music_b_loop.wav'
    save_wav(master, loop * 10 ** (gain_db / 20))
    first = OUT / 'encoded/bgm_city.mp3'
    encode(master, first)
    for name in TRACKS[1:]:
        shutil.copyfile(first, OUT / f'encoded/{name}.mp3')
    # Decode the actual MP3 before making boundary audition files; this includes
    # the encoder/decoder behavior. Repeated-WAV checks do not prove device loops.
    decoded = decode(first)
    assert len(decoded) == length, 'Encoder padding must be represented by gapless metadata.'
    seam = np.concatenate((decoded[-3 * SR:], decoded[:3 * SR]))
    save_wav(OUT / 'review/loop_join_3s_before_after.wav', seam)
    encode(OUT / 'review/loop_join_3s_before_after.wav', OUT / 'review/loop_join_3s_before_after.mp3')
    save_wav(OUT / 'review/three_cycles.wav', np.tile(decoded, (3, 1)))
    encode(OUT / 'review/three_cycles.wav', OUT / 'review/three_cycles.mp3')
    master_check, mp3_check = technical(decode(master)), technical(decoded)
    after = loudness(first)
    assert mp3_check['finite'] and mp3_check['peak_sample'] < 1
    assert mp3_check['join_within_ordinary_step_p99']
    assert mp3_check['longest_below_minus60_dbfs_s'] == 0
    assert abs(after['integrated_lufs'] - TARGET_LUFS) < .5
    assert after['true_peak_dbfs'] < -2.5
    source_manifest_path = ROOT / 'preparation/audio/cheerful-r2/music/MANIFEST.json'
    approved = next(t for t in json.loads(source_manifest_path.read_text())['tracks']
                    if t['id'] == 'music_b_happy_boy')
    source_evidence = ROOT / 'preparation/audio/cheerful-r2/music/evidence'
    catalog = json.loads((source_evidence / 'pieces.json').read_text())
    catalog_item = next(t for t in catalog if t.get('isrc') == 'USUAN1100648')
    (OUT / 'evidence/catalog-item.json').write_text(json.dumps(catalog_item, ensure_ascii=False, indent=2) + '\n')
    for name in ('incompetech-license.html', 'cc-by-4.0.html'):
        shutil.copyfile(source_evidence / name, OUT / 'evidence' / name)
    changes = ('32-beat excerpt from first-tempo main orchestration; 60 ms periodic boundary overlap; '
               'constant-gain level adjustment; MP3 re-encoding. No tempo/pitch change, no added '
               'instruments, no stem separation, compressor, limiter or end fade.')
    credit = ('"Happy Boy End Theme" — Kevin MacLeod (incompetech.com). Licensed under Creative Commons '
              'Attribution 4.0: https://creativecommons.org/licenses/by/4.0/ '
              'Source: https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100648 '
              f'Changes: {changes}')
    (OUT / 'CREDITS.txt').write_text(credit + '\n')
    outputs = []
    for name in TRACKS:
        path = OUT / f'encoded/{name}.mp3'
        outputs.append({'id': name, 'file': rel(path), 'sha256': sha(path), 'bytes': path.stat().st_size,
                        'duration_s': length / SR, 'same_pcm_as': 'bgm_city',
                        'master': rel(master), 'master_sha256': sha(master),
                        'sample_rate': SR, 'channels': 2, 'sample_count': length,
                        'loop_check': mp3_check,
                        'sources_and_edits': [{'file': rel(SOURCE), 'sha256': sha(SOURCE),
                                               'license': approved['license'],
                                               'license_url': approved['license_url'], 'changes': changes}]})
    manifest = {
        'revision': 'playful-r3', 'file_base': 'project_root',
        'status': 'approved_theme_B_offline_loop_prepared_for_runtime_import',
        'approval': {'user_text': '确认，配乐选择b。其余音效均认可，尝试找到切入的地方，开始开发',
                     'candidate_file': rel(CANDIDATE), 'candidate_sha256': CANDIDATE_HASH,
                     'scope': 'User approved B music and runtime development. Loop cut is implementation, not a newly selected composition.'},
        'source': {key: approved[key] for key in ('source_title', 'source_page', 'source_url', 'author',
                                                 'license', 'license_url', 'source_instruments', 'instrumentation_caveat')},
        'original': {'file': rel(SOURCE), 'sha256': sha(SOURCE), 'bytes': SOURCE.stat().st_size,
                     'format': 'Author full downloadable MP3; not lossless studio stems'},
        'source_manifest': {'file': rel(source_manifest_path), 'sha256': sha(source_manifest_path)},
        'source_evidence': [{'file': rel(path), 'sha256': sha(path), 'bytes': path.stat().st_size}
                            for path in sorted((OUT / 'evidence').iterdir())],
        'credits': {'file': rel(OUT / 'CREDITS.txt'), 'sha256': sha(OUT / 'CREDITS.txt')},
        'loop': {'start_sample': start, 'end_sample_exclusive': end, 'source_start_s': start / SR,
                 'source_end_s': end / SR, 'sample_count': length, 'duration_s': length / SR,
                 'source_local_tempo_bpm': 134, 'beat_count': BEATS, 'catalog_whole_piece_bpm': 130,
                 'seam_overlap_samples': join, 'seam_overlap_s': join / SR,
                 'method': 'continuous source post-roll wrapped into head with complementary raised-cosine weights',
                 'no_period_shortening': True, 'speed': 1.0, 'pitch_changed': False,
                 'constant_gain_db': float(gain_db), 'loop_intro_or_end_fade': False,
                 'source_full_track_silence_removed': 'Original has roughly 32–34 s inter-variation near silence; selected loop does not include it.',
                 'selection_limit': 'Uses first-speed main orchestration, not entire two-tempo audition sequence.'},
        'height_variants': {'mode': 'three_byte_identical_imports_one_approved_arrangement',
                            'reason': 'Keep established 3-region clip IDs and phase-aligned crossfade without inventing unapproved arrangements.',
                            'audible_change_at_height_boundary': False,
                            'all_instruments_retained': True,
                            'bytes_three_imports': sum(t['bytes'] for t in outputs),
                            'bytes_unique_payload': first.stat().st_size,
                            'future_dedup_note': 'Runtime may alias one AudioClip if importer supports it; current preparation does not edit references.'},
        'tracks': outputs, 'attribution': credit,
        'master': {'file': rel(master), 'sha256': sha(master)},
        'checks': {'master': master_check, 'encoded': mp3_check, 'loudness': after,
                   'same_decoded_sample_count_all_regions': True, 'same_encoded_sha_all_regions': True,
                   'onset_grid': onset_evidence(source)},
        'review': ['preparation/audio/playful-r3/review/loop_join_3s_before_after.mp3',
                   'preparation/audio/playful-r3/review/three_cycles.mp3'],
        'listening_boundary': 'Technical boundary checks passed; subjective join and real Cocos/WeChat decoder looping require runtime review.',
        'generator': {'file': rel(Path(__file__)), 'sha256': sha(Path(__file__)),
                       'ffmpeg': run([FFMPEG, '-version']).stdout.splitlines()[0]},
    }
    (OUT / 'MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    (OUT / 'REVIEW.md').write_text(f'''# 配乐 B 运行循环 R3

用户已选择“B · 俏皮小乐队”（Happy Boy End Theme），此处只将选中曲目整理为运行循环，未导入 assets。

- 来源：Kevin MacLeod 官网完整 MP3，CC BY 4.0；原始文件和获批候选的 SHA-256 均在 MANIFEST 中锁定。未以网页标题冒称有无损母带或真人演奏分轨。
- 选段：原曲 {start / SR:.5f}–{end / SR:.5f} 秒，32 拍，{length / SR:.9f} 秒，44.1 kHz 双声道，共 {length} 个采样点。局部起音网格约 134 BPM，整曲官网标签为 130，原曲本身有两种速度；没有变速或变调。
- 仅在开头 {join / SR:.3f} 秒，将片段结束之后连续的原始尾音渐变到片段开头。保持原长度，结尾不淡出，不包含原曲约 32–34 秒的近静音段。
- 三个高度轨道为同一已选配器，字节完全一致，每项 {first.stat().st_size:,} 字节，总计 {first.stat().st_size * 3:,} 字节。保留现有三轨引用，相位一致；没有伪称三种新编曲，也不随高度抽走欢快节奏。
- 实际 MP3 解码 LUFS {after['integrated_lufs']:.2f}，真峰值 {after['true_peak_dbfs']:.2f} dBFS；未应用压缩器、限制器或新增音色。无削波、NaN、低于 −60 dBFS 的 10 ms 静音帧。边界差值 {mp3_check['join_step_absolute']:.6f}，低于普通相邻采样差值的第 99 百分位 {mp3_check['ordinary_step_p99']:.6f}。

## 边界试听

- [接缝前后三秒](review/loop_join_3s_before_after.mp3)：中点是实际解码 MP3 的循环边界。
- [连续三圈](review/three_cycles.mp3)：用于发现短乐句重复感和循环衔接。

数值检查只能证明没有明显静音断口或异常采样跳变，不能等同主观音乐性验收，也不证明手机/Cocos/微信解码器的实际循环行为。

重建：运行 `preparation/tools/build_playful_music_r3.py`。脚本不访问网络、不写 assets/配置/场景；保留原始候选。完整署名见 [CREDITS.txt](CREDITS.txt)。
''')
    print(json.dumps({'outputs': outputs, 'loudness': after, 'encoded_checks': mp3_check,
                      'duration_s': length / SR, 'gain_db': gain_db}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
