"""Batch 1A revision 2: locally edit documented CC0 sources; never import candidates."""
from pathlib import Path
import hashlib, html, json, subprocess, wave
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'audio/batch1a-v2'
if (OUT/'MANIFEST.json').exists() and json.loads((OUT/'MANIFEST.json').read_text()).get('status') == 'approved_for_current_use':
    raise SystemExit('A2 已采用；请为后续调整建立新修订目录，避免覆盖已采用音频。')
SR = 44100
FFMPEG = '/opt/homebrew/bin/ffmpeg'
K = ROOT / 'audio/sources/kenney'
F = ROOT / 'audio/sources/freesound'
rows = []

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def decode(path):
    result = subprocess.run([FFMPEG, '-v', 'error', '-i', str(path), '-ar', str(SR),
        '-ac', '1', '-f', 'f32le', '-'], check=True, capture_output=True)
    return np.frombuffer(result.stdout, '<f4').astype(float)

def sample(path, start=0, duration=.4, rate=1, low=5200, high=65):
    signal = decode(path)[round(start * SR):round((start + duration) * SR)]
    signal /= max(np.max(np.abs(signal)), .001)
    # Float input prevents decoder overshoot from clipping before gain reduction.
    result = subprocess.run([FFMPEG, '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1',
        '-i', '-', '-af', f'highpass=f={high},lowpass=f={low},asetrate={round(SR*rate)},aresample={SR}',
        '-f', 'f32le', '-'], input=(signal * .65).astype('<f4').tobytes(), check=True, capture_output=True)
    signal = np.frombuffer(result.stdout, '<f4').astype(float)
    # Sub-millisecond attack retains the material transient; tail never clicks at a cut.
    attack = min(30, len(signal)); tail = min(round(.025 * SR), len(signal) // 3)
    signal[:attack] *= np.linspace(0, 1, attack)
    signal[-tail:] *= np.linspace(1, 0, tail)
    recipe = {'file': str(path.relative_to(ROOT)), 'sha256': digest(path), 'start_s': start,
        'duration_s': duration, 'rate': rate, 'highpass_hz': high, 'lowpass_hz': low}
    return signal, recipe

def mix(parts, duration):
    result = np.zeros(round(duration * SR)); recipes = []
    for (signal, recipe), at, gain in parts:
        start = round(at * SR); size = min(len(signal), len(result) - start)
        result[start:start+size] += signal[:size] * gain
        recipes.append({**recipe, 'at_s': at, 'gain': gain})
    return result, recipes

def save(name, title, description, mixed, peak=.36):
    signal, recipes = mixed
    signal -= np.mean(signal)
    signal *= peak / max(float(np.max(np.abs(signal))), .001)
    signal[:30] *= np.linspace(0, 1, 30)
    signal[-441:] *= np.linspace(1, 0, 441)
    master = OUT / 'masters' / (name + '.wav')
    encoded = OUT / 'encoded' / (name + '.mp3')
    master.parent.mkdir(parents=True, exist_ok=True); encoded.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(master), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((signal * 32767).astype('<i2').tobytes())
    subprocess.run([FFMPEG, '-v', 'error', '-y', '-i', str(master), '-c:a', 'libmp3lame',
        '-b:a', '96k', '-ar', str(SR), '-write_xing', '1', str(encoded)], check=True)
    decoded = decode(encoded)
    assert np.isfinite(decoded).all() and 0 < np.max(np.abs(decoded)) < .8
    # libmp3lame/decoder gapless padding may differ by a fraction of a millisecond.
    assert abs(len(decoded) - len(signal)) < .002 * SR
    rows.append({'id': name, 'title': title, 'description': description,
        'master': str(master.relative_to(ROOT)), 'master_sha256': digest(master),
        'file': str(encoded.relative_to(ROOT)), 'sha256': digest(encoded), 'bytes': encoded.stat().st_size,
        'duration_s': round(len(signal)/SR, 4), 'channels': 1, 'sample_rate': SR,
        'decode_peak_dbfs': round(float(20*np.log10(np.max(np.abs(decoded)))), 2),
        'decode_rms_dbfs': round(float(20*np.log10(np.sqrt(np.mean(decoded**2)))), 2),
        'sources_and_edits': recipes, 'status': 'candidate_pending_user_listening'})

def single(sampled, duration):
    return mix([(sampled, 0, 1)], duration)

for i, start in enumerate([.978, 5.908, 11.958], 1):
    save(f'impact_paper_{i}', f'纸箱碰撞 {i}', '真实纸箱落地：短闷响与纸壳摩擦，去除录音前后空白。',
        single(sample(F/'box-465451-hq.mp3', start, .4, low=4600, high=85), .42), .32)
for i in range(1, 4):
    save(f'impact_wood_{i}', f'木板碰撞 {i}', '木板敲击的干脆起音，保留木质共鸣，缩短空尾。',
        single(sample(K/f'impact/Audio/impactPlank_medium_00{i-1}.ogg', duration=.26,
            rate=[.95,1,1.04][i-1], low=5400), .30), .34)
for i, start in enumerate([4.055, 6.262, 8.475], 1):
    save(f'impact_rubber_{i}', f'篮球碰撞 {i}', '真实篮球单次反弹，保留空腔感与皮面撞击，不添加音符。',
        single(sample(F/'ball-451642-hq.mp3', start, .32, low=5400, high=65), .34), .34)
for i in range(1, 4):
    impact = sample(K/f'impact/Audio/impactMetal_heavy_00{i-1}.ogg', duration=.22, rate=.82, low=2800)
    shell = sample(K/f'impact/Audio/impactTin_medium_00{i-1}.ogg', duration=.32, rate=.85, low=4200)
    save(f'impact_metal_{i}', f'冰箱碰撞 {i}', '偏沉的金属撞击叠加薄板余振，削弱刺耳高频。',
        mix([(impact,0,1), (shell,.015,.24)], .38), .36)

switch = sample(K/'interface/Audio/switch_006.ogg', duration=.17, rate=1.12, low=3700)
click = sample(K/'interface/Audio/click_001.ogg', duration=.065, rate=.9, low=3200)
pluck = sample(K/'interface/Audio/pluck_001.ogg', duration=.1, rate=.92, low=3200)
save('claw_grip', '抓手合拢', '短促柔和的机械咔哒，去掉上一版双音符尾巴。',
    mix([(switch,0,1),(click,.09,.26)], .21), .29)
save('claw_open', '抓手松开', '轻巧的卡扣松脱，辅以很轻的弹性回位。',
    mix([(click,0,1),(pluck,.055,.20)], .19), .27)
swish = sample(K/'interface/Audio/scratch_001.ogg', duration=.13, rate=1.2, low=3500, high=180)
save('rotate_90', '旋转', '短滑动加到位咔哒，操作响应清楚，尾音不过长。',
    mix([(swish,0,.35),(click,.09,.85)], .21), .28)
save('next_handoff', '下一件交接', '轻弹一下，低存在感。', single(pluck,.14), .19)
wood = sample(K/'impact/Audio/impactWood_light_000.ogg', duration=.15, rate=1.3, low=4200)
save('stable', '稳定落好', '两次轻木点音，提示放稳，避免每件都响一段旋律。',
    mix([(wood,0,.7),(pluck,.085,.45)], .24), .22)
pop_low = sample(K/'interface/Audio/pluck_002.ogg', duration=.16, rate=.76, low=3300)
pop_high = sample(K/'interface/Audio/pluck_001.ogg', duration=.1, rate=1.16, low=3600)
save('run_end', '本轮结束', '短促的“咚、啵啵”收尾，轻松俏皮，替换下行失败旋律。',
    mix([(wood,0,.75),(pop_low,.14,.85),(pop_high,.32,.6)], .57), .28)

manifest = {'revision':'2026-09-13-A2', 'status':'candidate_pending_user_listening',
    'feedback':'缺少材质感；抓手和结束提示不合适；希望轻松、有趣。',
    'scope':'Batch 1A 四材质碰撞与基础操作；不含背景音乐和事故音效。',
    'source_manifests':['audio/sources/kenney/SOURCES.json','audio/sources/freesound/SOURCES.json'],
    'source_note':'CC0 素材下载后本地剪辑、滤波、调速和混音。Freesound 使用页面公开链接的 HQ MP3，不称无损母源。',
    'script_sha256':digest(Path(__file__)), 'entries':rows,
    'verified':'18 个 MP3 本地解码、有限采样、峰值与时长；来源和编辑配方逐项记录。',
    'not_proven':['用户听感验收','游戏混音和场景切换播放','微信和手机扬声器实测'],
    'imported_into_game':False}
(OUT/'MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')

selected = ['impact_paper_1','impact_wood_1','impact_rubber_1','impact_metal_1','claw_grip','claw_open','run_end']
montage = np.concatenate([np.concatenate([decode(ROOT/next(r['file'] for r in rows if r['id']==name)), np.zeros(round(.75*SR))]) for name in selected])
with wave.open(str(OUT/'quick-listen.wav'),'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR);w.writeframes((montage*32767).astype('<i2').tobytes())

cards=[]
for row in rows:
    old='../audio/encoded/sfx/'+row['id']+'.mp3'
    cards.append(f'''<article><h2>{html.escape(row['title'])}</h2><p>{html.escape(row['description'])}</p>
<label>新版 A2<audio controls preload="metadata" src="../{row['file']}"></audio></label>
<details><summary>对比上一版</summary><audio controls preload="none" src="{old}"></audio></details></article>''')
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>这也能叠 · 音效 A2 试听</title><style>body{margin:0;background:#eef3f8;color:#173047;font:16px/1.7 system-ui}main{max-width:1160px;margin:auto;padding:24px}h1{font-size:26px}h2{font-size:18px;margin:0}p{margin:8px 0}section,article{background:white;padding:20px;border-radius:14px}section{margin:18px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:16px}audio{display:block;width:100%;margin:10px 0}a{color:#087ac6}small,details{color:#4e6373}article p{min-height:54px}summary{cursor:pointer}</style><main>
<h1>音效 A2 · 更贴近材质，轻松有趣</h1><p>上一版已按你的反馈退回。这版用免费 CC0 材质音重新剪辑和混音，抓手改短机械动作声，结束改俏皮点音收尾。仍是待审候选，尚未接入游戏。</p>
<section><h2>先听这一段</h2><p>顺序：纸箱 → 木板 → 篮球 → 冰箱 → 抓手合拢 → 松开 → 本轮结束。建议先用中等音量。</p>
<audio controls preload="metadata" src="../audio/batch1a-v2/quick-listen.wav"></audio><small>材质有三条录音／采样变体。下面可逐条试听，并展开对比旧版。</small></section>
<div class="grid">'''+''.join(cards)+'''</div><section><h2>来源与采用状态</h2><p>纸箱：<a href="https://freesound.org/people/ittou/sounds/465451/">ittou / Freesound</a>；篮球：<a href="https://freesound.org/people/toddcircle/sounds/451642/">toddcircle / Freesound</a>；木板、金属、操作基础音：<a href="https://kenney.nl/assets/impact-sounds">Kenney Impact Sounds</a>、<a href="https://kenney.nl/assets/interface-sounds">Interface Sounds</a>。各来源标注 CC0；作者与原始授权页面已保存在本地。</p><p><a href="../audio/batch1a-v2/MANIFEST.json">完整来源与剪辑记录</a> · <a href="play.html">四物体试放</a> · <a href="index.html#audio">原版音频与音乐候选</a></p><p>技术检查已覆盖解码、峰值和时长；听感、正式混音与手机扬声器效果仍待验收。</p></section></main><script>document.querySelectorAll('audio').forEach(a=>a.addEventListener('play',()=>document.querySelectorAll('audio').forEach(b=>{if(a!==b)b.pause()})));</script></html>'''
(ROOT/'review/audio-1a.html').write_text(page)
old = json.loads((ROOT/'audio/BATCH1A_SELECTION.json').read_text())
old.update(status='changes_requested', user_feedback=manifest['feedback'], replacement='audio/batch1a-v2/MANIFEST.json')
(ROOT/'audio/BATCH1A_SELECTION.json').write_text(json.dumps(old,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'revision':manifest['revision'],'files':len(rows),'encoded_bytes':sum(r['bytes'] for r in rows),'status':manifest['status']},ensure_ascii=False))
