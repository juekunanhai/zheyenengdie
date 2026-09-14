"""A3: local edits of attributed CC0 foley. Does not import or overwrite A2/runtime audio."""
from pathlib import Path
import hashlib, html, json, subprocess, wave
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'audio/foley-a3'
SR = 44100
FFMPEG = '/opt/homebrew/bin/ffmpeg'
K = ROOT / 'audio/sources/kenney/impact'
F = ROOT / 'audio/sources/foley-a3'
STATUS = 'authorized_for_current_use'
rows = []


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def decode(path):
    result = subprocess.run([FFMPEG, '-v', 'error', '-i', str(path), '-ar', str(SR),
        '-ac', '1', '-f', 'f32le', '-'], check=True, capture_output=True)
    return np.frombuffer(result.stdout, '<f4').astype(float)


sources = json.loads((F/'SOURCES.json').read_text())
source_by_name = {Path(row['file']).name: row for row in sources}
for source in sources:
    assert digest(ROOT.parent/source['file']) == source['sha256'], source['id']
kenney_license = K/'License.txt'
assert 'Creative Commons Zero, CC0' in kenney_license.read_text()
protected = {str(path): digest(path) for path in (ROOT.parent/'assets/batch1/audio').glob('impact_*.mp3')
    if any(path.stem.startswith('impact_'+material+'_') for material in ('paper', 'wood', 'rubber', 'metal'))}
assert len(protected) == 12
if (OUT/'MANIFEST.json').exists() and json.loads((OUT/'MANIFEST.json').read_text()).get('imported_into_game'):
    raise SystemExit('A3 已接入；进一步改声请建立新修订，不覆盖已集成音频。')


def sample(path, start, duration, low=5600, high=65):
    source = decode(path)
    assert start >= 0 and start < len(source)/SR
    end = min(len(source), round((start+duration)*SR))
    signal = source[round(start*SR):end].copy()
    assert len(signal) > 0 and np.isfinite(signal).all()
    # HQ MP3/OGG decoding can overshoot full scale. Keep float samples and reduce gain before filtering.
    normalize = .6/max(float(np.max(np.abs(signal))), .001)
    signal *= normalize
    result = subprocess.run([FFMPEG, '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
        '-af', f'highpass=f={high},lowpass=f={low}', '-f', 'f32le', '-'],
        input=signal.astype('<f4').tobytes(), check=True, capture_output=True)
    signal = np.frombuffer(result.stdout, '<f4').astype(float)
    attack = min(round(.0005*SR), len(signal))
    tail = min(round(.025*SR), len(signal)//3)
    signal[:attack] *= np.linspace(0, 1, attack)
    signal[-tail:] *= np.linspace(1, 0, tail)
    web = source_by_name.get(path.name)
    recipe = {'file': str(path.relative_to(ROOT)), 'sha256': digest(path), 'start_s': start,
        'duration_s': round(len(signal)/SR, 6), 'requested_duration_s': duration,
        'rate': 1, 'highpass_hz': high, 'lowpass_hz': low, 'pre_filter_gain': normalize,
        'attack_fade_s': attack/SR, 'tail_fade_s': tail/SR,
        'author': web['author'] if web else 'Kenney',
        'page_url': web['page_url'] if web else 'https://kenney.nl/assets/impact-sounds',
        'license': 'CC0-1.0',
        'source_quality': web['quality'] if web else 'OGG file from Kenney Impact Sounds 1.0 CC0 pack'}
    return signal, recipe


def mix(parts, duration):
    result = np.zeros(round(duration*SR)); recipes = []
    for (signal, recipe), at, gain in parts:
        start = round(at*SR); count = min(len(signal), len(result)-start)
        assert count > 0
        result[start:start+count] += signal[:count]*gain
        recipes.append({**recipe, 'at_s': at, 'gain': gain, 'used_samples': count})
    return result, recipes


def save(name, title, description, mixed, peak=.3):
    signal, recipes = mixed
    assert np.isfinite(signal).all() and np.max(np.abs(signal)) > .001
    # Remove DC without adding oscillators, pitched notes, artificial reverb or synthesized transients.
    dc = float(np.mean(signal)); signal -= dc
    final_gain = peak/float(np.max(np.abs(signal))); signal *= final_gain
    signal[:22] *= np.linspace(0, 1, 22)
    signal[-441:] *= np.linspace(1, 0, 441)
    master = OUT/'masters'/(name+'.wav'); encoded = OUT/'encoded'/(name+'.mp3')
    master.parent.mkdir(parents=True, exist_ok=True); encoded.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(master), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(np.rint(signal*32767).astype('<i2').tobytes())
    subprocess.run([FFMPEG, '-v', 'error', '-y', '-i', str(master), '-c:a', 'libmp3lame',
        '-b:a', '96k', '-ar', str(SR), '-write_xing', '1', str(encoded)], check=True)
    decoded = decode(encoded)
    assert np.isfinite(decoded).all() and 0 < np.max(np.abs(decoded)) < .8
    assert abs(len(decoded)-len(signal)) < .002*SR
    subprocess.run([FFMPEG, '-v', 'error', '-i', str(encoded), '-f', 'null', '-'], check=True)
    rows.append({'id': name, 'title': title, 'description': description, 'status': STATUS,
        'listening_status': 'not_reviewed', 'master': str(master.relative_to(ROOT)), 'master_sha256': digest(master),
        'file': str(encoded.relative_to(ROOT)), 'sha256': digest(encoded), 'bytes': encoded.stat().st_size,
        'duration_s': round(len(signal)/SR, 4), 'channels': 1, 'sample_rate': SR,
        'decode_peak_dbfs': round(float(20*np.log10(np.max(np.abs(decoded)))), 2),
        'decode_rms_dbfs': round(float(20*np.log10(np.sqrt(np.mean(decoded**2)))), 2),
        'dc_removed': dc, 'final_gain': final_gain, 'target_peak': peak,
        'final_attack_fade_s': 22/SR, 'final_tail_fade_s': .01,
        'sources_and_edits': recipes})


ratchet = F/'ratchet-hq.mp3'; suction = F/'suction-hq.mp3'
wood0 = K/'Audio/impactWood_light_000.ogg'; wood1 = K/'Audio/impactWood_light_001.ogg'
soft = K/'Audio/impactSoft_medium_000.ogg'
save('claw_grip', '抓手合拢', '棘轮工具实录的一小段卡扣动作；不使用电子开关音。',
    mix([(sample(ratchet, 4.410, .185, low=5400, high=110), 0, 1)], .20), .28)
save('claw_open', '抓手松开', '从棘轮录音提取单次机械卡嗒，保留短促实体动作。',
    mix([(sample(ratchet, 9.960, .115, low=5200, high=100), 0, 1)], .14), .26)
save('rotate_90', '旋转到位', '短棘轮转动与最后的自然卡扣，保持原录音速度。',
    mix([(sample(ratchet, 3.270, .245, low=5600, high=100), 0, 1)], .26), .27)
save('next_handoff', '下一件交接', '单次轻木敲，短而低存在感。',
    mix([(sample(wood0, 0, .155, low=5100), 0, 1)], .17), .20)
save('stable', '稳固提示', '两次轻木敲组成短节奏；没有合成音符，不逐件自动播放。',
    mix([(sample(wood0, 0, .15, low=5100), 0, .72),
         (sample(wood1, 0, .16, low=4900), .11, .55)], .29), .23)
pop = sample(suction, .205, .235, low=5900, high=65)
soft_hit = sample(soft, 0, .115, low=3500, high=55)
save('run_end', '本轮结束', '真实吸盘脱落后接一次软物落地，用短动作收尾；不含电子旋律。',
    mix([(pop, 0, .8), (soft_hit, .24, .85)], .40), .30)
save('star_lost', '掉星提示', '吸盘松脱叠一声轻软落物，作为单次事故提示；没有警报或音符。',
    mix([(pop, 0, 1), (soft_hit, .14, .32)], .29), .28)
for i in range(1, 4):
    save(f'impact_ceramic_{i}', f'盘器碰撞 {i}', 'Kenney 盘器敲击变体，保留硬质短共鸣；用作陶瓷材质代理，并非马桶专门实录，也非破碎音。',
        mix([(sample(K/f'Audio/impactPlate_light_00{i-1}.ogg', 0, .40, low=5700, high=85), 0, 1)], .42), .33)

assert len(rows) == 10 and len({row['id'] for row in rows}) == 10
assert all(digest(Path(path)) == expected for path, expected in protected.items())
segments = []; timeline = []; position = 0
for row in rows:
    signal = decode(ROOT/row['file'])
    timeline.append({'id': row['id'], 'start_s': round(position/SR, 4), 'duration_s': round(len(signal)/SR, 4)})
    segments.extend([signal, np.zeros(round(.65*SR))]); position += len(signal)+round(.65*SR)
montage = np.concatenate(segments)
with wave.open(str(OUT/'quick-listen.wav'), 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(np.rint(montage*32767).astype('<i2').tobytes())
manifest = {'revision': '2026-09-14-A3', 'status': STATUS, 'listening_status': 'not_reviewed',
    'authorization': '用户要求移除电子音，允许从音效网站收集适合的免费素材并直接采用；不等于已试听通过。',
    'scope': '7项操作/事件声音与3项盘器碰撞；12项现有纸/木/橡胶/金属实录材质保持原字节。',
    'source_manifests': ['audio/sources/foley-a3/SOURCES.json', 'audio/sources/kenney/SOURCES.json'],
    'license_files': [{'file': str(kenney_license.relative_to(ROOT)), 'sha256': digest(kenney_license)}],
    'source_note': '仅使用棘轮/吸盘实录和Kenney Impact Sounds foley。Freesound是公开HQ MP3预览，非原始无损WAV。未使用Interface、pluck或合成器；所有样本保持原速度。',
    'script_sha256': digest(Path(__file__)), 'entries': rows,
    'unchanged_materials': [{'file': str(Path(path).relative_to(ROOT.parent)), 'sha256': sha} for path, sha in protected.items()],
    'quick_listen': {'file': 'audio/foley-a3/quick-listen.wav', 'sha256': digest(OUT/'quick-listen.wav'), 'timeline': timeline},
    'verified': ['10个MP3完整解码通过', '浮点采样全有限、解码峰值低于-1.94dBFS', '母版与解码时长误差小于2ms', '源文件与编辑配方逐项可追溯', '12个现有材质音频字节未变'],
    'not_proven': ['助理未实际试听', '用户听感未单独验收', '引擎混音和触发时序', '手机扬声器和微信真机'],
    'imported_into_game': False}
(OUT/'MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')

cards = []
for row in rows:
    sources_html = '、'.join(f'<a href="{html.escape(source["page_url"])}">{html.escape(source["author"])}</a>' for source in
        {source['file']: source for source in row['sources_and_edits']}.values())
    cards.append(f'<article><h2>{html.escape(row["title"])}</h2><p>{html.escape(row["description"])}</p>'
        f'<audio controls preload="metadata" src="../{row["file"]}"></audio>'
        f'<small>{row["duration_s"]:.2f} 秒 · 来源：{sources_html} · CC0</small></article>')
page = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>这也能叠 · A3 实物音效</title><style>body{margin:0;background:#eef3f8;color:#173047;font:16px/1.65 system-ui}main{max-width:1120px;margin:auto;padding:24px}h1{font-size:28px}h2{font-size:19px;margin:0}p{margin:10px 0}section,article{background:white;padding:20px;border-radius:14px}section{margin:18px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:16px}audio{display:block;width:100%;margin:12px 0}a{color:#0875ba}small{color:#526c7d}article p{min-height:78px}</style><main>
<h1>A3 · 实物动作与材质声音</h1><p>按你的要求，将操作和事故声改为网站收集的实物录音与拟音素材。此次没有电子旋律或合成音符。原来的 12 个纸、木、橡胶、金属碰撞声保持。</p>
<section><h2>连续试听 · 10 项</h2><p>顺序：抓手合拢 → 松开 → 旋转 → 下一件 → 稳固 → 结束 → 掉星 → 盘器碰撞 1、2、3。</p><audio controls preload="metadata" src="../audio/foley-a3/quick-listen.wav"></audio><small>已获授权用于当前版本；听感仍可调整。此页不自动播放、不修改游戏音量设置。</small></section>
<div class="grid">'''+''.join(cards)+'''</div><section><h2>来源与验证</h2><p>棘轮来自 <a href="https://freesound.org/people/CapsLok/sounds/181634/">CapsLok / Freesound</a>；吸盘来自 <a href="https://freesound.org/people/michorvath/sounds/386885/">michorvath / Freesound</a>；木敲、软物落地、盘器敲击来自 <a href="https://kenney.nl/assets/impact-sounds">Kenney Impact Sounds</a>。以上来源标注 CC0；原文件与授权记录保留。</p><p>编辑仅包含裁切、滤波、淡入淡出、音量和少量混音。盘器声音用于陶瓷代理，并非马桶专门实录。Freesound 文件为公开 HQ MP3 预览，未称无损母源。</p><p>解码、时长、峰值和来源哈希检查已通过。助理没有实际试听；最终听感、引擎混音与手机播放仍以实际体验为准。</p><p><a href="../audio/foley-a3/MANIFEST.json">逐项来源、编辑配方与检测结果</a> · <a href="batch1b.html">Batch 1B 试玩</a></p></section></main><script>document.querySelectorAll('audio').forEach(a=>a.addEventListener('play',()=>document.querySelectorAll('audio').forEach(b=>{if(a!==b)b.pause()})));</script></html>'''
(ROOT/'review/audio-1b.html').write_text(page)
print(json.dumps({'revision': manifest['revision'], 'status': STATUS, 'files': len(rows),
    'encoded_bytes': sum(row['bytes'] for row in rows), 'peaks_dbfs': [row['decode_peak_dbfs'] for row in rows],
    'unchanged_materials': len(protected), 'listening_status': manifest['listening_status']}, ensure_ascii=False))
