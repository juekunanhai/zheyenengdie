"""Offline 1C acoustic variations and material Foley; no runtime/scenes/config writes."""
from pathlib import Path
import hashlib, html, json, subprocess, wave
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'audio/batch1c'
SOURCES = ROOT / 'audio/sources/batch1c'
KENNEY = ROOT / 'audio/sources/kenney/impact'
FF = '/opt/homebrew/bin/ffmpeg'
SR = 44100
STATUS = 'authorized_for_current_use'
ROWS = []


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def relative(path):
    return str(path.relative_to(ROOT))


def decode(path, channels=2):
    raw = subprocess.check_output([FF, '-v', 'error', '-i', str(path), '-ar', str(SR),
                                   '-ac', str(channels), '-f', 'f32le', '-'])
    return np.frombuffer(raw, '<f4').astype(float).reshape(-1, channels)


def filt(signal, high, low):
    channels = signal.shape[1]
    raw = subprocess.run([FF, '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', str(channels),
                          '-i', '-', '-af', f'highpass=f={high},lowpass=f={low}', '-f', 'f32le', '-'],
                         input=signal.astype('<f4').tobytes(), check=True, capture_output=True).stdout
    return np.frombuffer(raw, '<f4').astype(float).reshape(-1, channels)


def db(value):
    return round(float(20*np.log10(max(float(value), 1e-12))), 3)


def wav(path, signal):
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), 'wb') as stream:
        stream.setnchannels(signal.shape[1]); stream.setsampwidth(2); stream.setframerate(SR)
        stream.writeframes(np.rint(np.clip(signal, -1, 1)*32767).astype('<i2').tobytes())


def save(name, title, desc, signal, recipes, loop=False, peak=.32):
    signal = signal.copy()
    assert np.isfinite(signal).all() and np.max(abs(signal)) > .001
    dc = np.mean(signal, axis=0); signal -= dc
    gain = peak / np.max(abs(signal)); signal *= gain
    if not loop:
        signal[:22] *= np.linspace(0, 1, 22)[:, None]
        signal[-441:] *= np.linspace(1, 0, 441)[:, None]
    master = OUT/'masters'/f'{name}.wav'; encoded = OUT/'encoded'/f'{name}.mp3'
    encoded.parent.mkdir(parents=True, exist_ok=True)
    wav(master, signal)
    subprocess.run([FF, '-v', 'error', '-y', '-i', str(master), '-c:a', 'libmp3lame',
                    '-b:a', '128k' if loop else '96k', '-write_xing', '1', str(encoded)], check=True)
    decoded = decode(encoded, signal.shape[1])
    subprocess.run([FF, '-v', 'error', '-i', str(encoded), '-f', 'null', '-'], check=True)
    assert np.isfinite(decoded).all() and np.max(abs(decoded)) < .8
    assert abs(len(decoded)-len(signal)) < .002*SR
    row = {'id': name, 'title': title, 'description': desc, 'kind': 'music' if loop else 'impact',
           'status': STATUS, 'listening_status': 'not_reviewed', 'master': relative(master),
           'master_sha256': digest(master), 'file': relative(encoded), 'sha256': digest(encoded),
           'bytes': encoded.stat().st_size, 'duration_s': round(len(signal)/SR, 6),
           'sample_rate': SR, 'channels': signal.shape[1], 'decode_peak_dbfs': db(np.max(abs(decoded))),
           'decode_rms_dbfs': db(np.sqrt(np.mean(decoded**2))), 'dc_removed': dc.tolist(),
           'final_gain': float(gain), 'sources_and_edits': recipes}
    if loop:
        jump = np.max(abs(decoded[0]-decoded[-1]))
        edge_rms = [np.sqrt(np.mean(decoded[:2205]**2)), np.sqrt(np.mean(decoded[-2205:]**2))]
        row['loop_check'] = {'decoded_sample_count': len(decoded), 'decoded_seam_jump_dbfs': db(jump),
                             'first_50ms_rms_dbfs': db(edge_rms[0]), 'last_50ms_rms_dbfs': db(edge_rms[1]),
                             'edge_rms_delta_db': db(edge_rms[0])-db(edge_rms[1]),
                             'note': 'PCM continuity only; actual engine MP3 looping and subjective musical seam need playback verification.'}
        assert jump < .025
    ROWS.append(row)
    return signal


def foley(filename, duration, low=5600, high=60):
    path = KENNEY/'Audio'/filename
    signal = decode(path, 1)[:round(duration*SR)].copy()
    gain = .6/max(np.max(abs(signal)), .001); signal *= gain
    signal = filt(signal, high, low)
    signal[:22] *= np.linspace(0, 1, 22)[:, None]
    tail = min(1102, len(signal)//3)
    signal[-tail:] *= np.linspace(1, 0, tail)[:, None]
    return signal, {'file': relative(path), 'sha256': digest(path), 'author': 'Kenney',
                    'page_url': 'https://kenney.nl/assets/impact-sounds', 'license': 'CC0-1.0',
                    'source_quality': 'Original downloaded OGG Foley pack; not subject-specific live capture',
                    'start_s': 0, 'duration_s': len(signal)/SR, 'rate': 1,
                    'highpass_hz': high, 'lowpass_hz': low, 'pre_filter_gain': float(gain),
                    'attack_fade_s': 22/SR, 'tail_fade_s': tail/SR}


def mix(parts, duration):
    signal = np.zeros((round(duration*SR), 1)); recipes = []
    for (part, recipe), at, gain in parts:
        start = round(at*SR); count = min(len(part), len(signal)-start)
        signal[start:start+count] += part[:count]*gain
        recipes.append({**recipe, 'at_s': at, 'gain': gain})
    return signal, recipes


assert 'Creative Commons Zero, CC0' in (KENNEY/'License.txt').read_text()
if (OUT/'MANIFEST.json').exists() and json.loads((OUT/'MANIFEST.json').read_text()).get('imported_into_game'):
    raise SystemExit('1C audio already imported; create a new revision before altering adopted files.')
protected = {str(p): digest(p) for p in (ROOT.parent/'assets/batch1/audio').glob('*') if p.is_file()}

# The supplied 17-second recording is not a clean whole-file musical loop.
# Its repeated phrase is approximately 8.91 s (envelope correlation 0.7892).
# Keep natural timing/pitch. Replace the first 60ms with a crossfade from the following phrase,
# so the preceding tail continues into the next iteration without an artificial silent gap.
uke = SOURCES/'ukulele-hq.mp3'; source = decode(uke)
start = round(.8*SR); period = round(8.91*SR); fade = round(.06*SR)
phrase = source[start:start+period].copy()
progress = np.linspace(0, 1, fade)[:, None]
phrase[:fade] = source[start+period:start+period+fade]*(1-progress)+phrase[:fade]*progress
base = np.tile(phrase, (4, 1)); length = len(base)
# Filter three copies and retain the middle one, preserving steady-state loop boundaries.
base = filt(np.tile(base, (3, 1)), 110, 6100)[length:2*length]
uke_recipe = {'file': relative(uke), 'sha256': digest(uke), 'author': 'muri_kuri',
              'page_url': 'https://freesound.org/people/muri_kuri/sounds/682461/', 'license': 'CC0-1.0',
              'source_quality': 'Public HQ MP3 preview, not original lossless WAV',
              'start_s': .8, 'phrase_duration_s': 8.91, 'phrase_repetitions': 4,
              'head_crossfade_from_next_phrase_s': .06, 'pitch_or_speed_change': False,
              'highpass_hz': 110, 'lowpass_hz': 6100,
              'note': 'Same recorded phrase in all three offline arrangements; not three unrelated songs.'}
wood_a = foley('impactWood_light_000.ogg', .14, low=2800, high=180)
wood_b = foley('impactWood_light_002.ogg', .14, low=2500, high=180)
music_signals = []
for theme, title, dry, taps, rhythm in [
    ('city', '城市 · 轻木节奏', 1, [(0.037, .06), (0.079, .035)], [1.11, 2.77, 5.29, 6.97]),
    ('cloud', '云层 · 轻弹余韵', .96, [(0.043, .09), (0.097, .075), (.183, .045)], [1.11, 5.29]),
    ('space', '太空 · 原声留白', .90, [(0.037, .1), (.079, .095), (.143, .075), (.239, .055), (.391, .025)], []),
]:
    result = base*dry
    for delay, level in taps:
        # Circular offline reflections, no oscillator, synth layer, pitched notes or speed changes.
        result[:, 0] += np.roll(base[:, 0], round(delay*SR))*level
        result[:, 1] += np.roll(base[:, 1], round((delay+.007)*SR))*level
    recipes = [{**uke_recipe, 'dry_gain': dry,
                'offline_reflections_s_gain': taps, 'right_reflection_offset_s': .007}]
    for cycle in range(4):
        for j, at in enumerate(rhythm):
            # Follow actual strum positions, rather than quantizing a live performance to a rigid beat.
            part, recipe = wood_a if j % 2 == 0 else wood_b
            at_total = cycle*8.91+at; pos = round(at_total*SR)
            gain = (.055 if theme == 'city' else .027) * (1 if cycle % 2 == 0 else .86)
            result[pos:pos+len(part)] += part*gain
            recipes.append({**recipe, 'at_s': at_total, 'gain': gain})
    music_signals.append(save('bgm_'+theme, title,
        '同一尤克里里实录乐句，保持原速原调；'+('轻木敲随弹弦节奏。' if theme == 'city' else
        '减半木敲，增加少量短反射。' if theme == 'cloud' else '移除木敲，保留弹弦并拉开短反射空间；不加电子铺底。'),
        result, recipes, True, .28))

for i in range(3):
    signal, recipes = mix([(foley(f'impactSoft_medium_00{i}.ogg', .27, low=3700, high=65), 0, 1)], .29)
    save(f'impact_soft_{i+1}', f'软体碰撞 {i+1}', '软物拟音，短促闷弹；供沙发、汉堡与拖鞋使用。', signal, recipes)
    signal, recipes = mix([(foley(f'impactGlass_light_00{i}.ogg', .32, low=6000, high=160), 0, 1)], .35)
    save(f'impact_ice_{i+1}', f'冰块碰撞 {i+1}', '轻玻璃敲击作为冰块清脆硬质碰撞代理，不是碎冰专门实录。', signal, recipes, peak=.29)
    signal, recipes = mix([(foley(f'impactSoft_heavy_00{i}.ogg', .43, low=2600, high=45), 0, 1),
                            (foley(f'impactWood_heavy_00{i}.ogg', .31, low=1800, high=55), .015, .32)], .48)
    save(f'impact_heavy_{i+1}', f'重物碰撞 {i+1}', '重软物与少量厚木碰撞混音，提供鲸鱼重量感；无动物叫声或合成低音。', signal, recipes, peak=.36)

# Phase-aligned 1-second transition demonstration. This verifies an offline edit, not engine crossfade.
demo = np.zeros_like(music_signals[0])
for i in range(length):
    t = i/SR
    if t < 11:
        demo[i] = music_signals[0][i]
    elif t < 12:
        a = t-11; demo[i] = music_signals[0][i]*(1-a)+music_signals[1][i]*a
    elif t < 23:
        demo[i] = music_signals[1][i]
    elif t < 24:
        a = t-23; demo[i] = music_signals[1][i]*(1-a)+music_signals[2][i]*a
    else:
        demo[i] = music_signals[2][i]
wav(OUT/'transition-listen.wav', demo)
fx = [decode(ROOT/row['file'], 1) for row in ROWS if row['kind'] == 'impact']
wav(OUT/'materials-listen.wav', np.concatenate([p for x in fx for p in [x, np.zeros((round(.55*SR), 1))]]))
manifest = {'revision': '2026-09-14-1C-acoustic-r1', 'status': STATUS, 'listening_status': 'not_reviewed',
            'authorization': '用户授权下一批开发，并要求从网站采集素材、所有声音避免电子音；本轮作为当前版本使用，主观试听仍待确认。',
            'source_manifests': ['audio/sources/batch1c/SOURCES.json', 'audio/sources/kenney/SOURCES.json'],
            'license_files': [{'file': relative(KENNEY/'License.txt'), 'sha256': digest(KENNEY/'License.txt')},
                              {'file': relative(SOURCES/'AUTHOR_AND_LICENSE_WEB_EVIDENCE.txt'),
                               'sha256': digest(SOURCES/'AUTHOR_AND_LICENSE_WEB_EVIDENCE.txt'),
                               'content': 'Freesound author and CC0 primary pages extracted by web tool; not raw HTML'}],
            'source_note': '一条原声尤克里里实录为三个阶段共同母体，加减网站木质拟音及离线短反射；不使用旧32秒合成音乐。三版是同主题编配混音，不是重新演奏或三首新作曲。',
            'music_transport': {'common_duration_s': 35.64, 'common_sample_count': length,
                                'crossfade_s': 1, 'align_playback_position': True,
                                'note': '新版本应从旧版本对应播放位置开始；不要每次高度切换都从曲首重新开始。'},
            'entries': ROWS, 'script_sha256': digest(Path(__file__)), 'imported_into_game': False,
            'demos': [{'file': relative(OUT/name), 'sha256': digest(OUT/name)}
                      for name in ['transition-listen.wav', 'materials-listen.wav']],
            'verified': ['12个MP3完整解码且采样有限', '解码峰值低于-1.94 dBFS', '母版/解码时长差小于2ms',
                         '三音乐同长度同乐句时相，循环采样跳变小于0.025', '全部来源及加工参数可追溯', '现有运行音频字节不变'],
            'not_proven': ['助理未实际试听', '用户主观听感', 'Cocos运行时循环/交叉淡化/首次交互播放', '微信真机与手机扬声器']}
assert all(digest(Path(p)) == sha for p, sha in protected.items())
(OUT/'MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({'files': len(ROWS), 'bytes': sum(r['bytes'] for r in ROWS),
                  'music': [{k: r[k] for k in ['id', 'duration_s', 'decode_peak_dbfs', 'loop_check']} for r in ROWS[:3]]}, ensure_ascii=False, indent=2))
