"""Original local synthesis and arrangement; no downloaded audio or samples."""
from pathlib import Path
import json, hashlib, wave
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SR = 44100
rng = np.random.default_rng(20260912)
rows = []

def note(midi):
    return 440 * 2 ** ((midi-69)/12)

def tone(freq, duration, decay=6, kind='mallet'):
    t = np.arange(round(duration*SR))/SR
    a = np.minimum(t/.006, 1)*np.exp(-decay*t)
    if kind == 'pad':
        a = np.sin(np.pi*np.minimum(t/duration,1))**1.5
        return a*(np.sin(2*np.pi*freq*t)+.22*np.sin(2*np.pi*freq*1.003*t)+.12*np.sin(4*np.pi*freq*t))*.65
    return a*(np.sin(2*np.pi*freq*t)+.25*np.sin(2*np.pi*freq*2*t)*np.exp(-4*t)+.10*np.sin(2*np.pi*freq*3.97*t)*np.exp(-12*t))

def save(name, signal, category, purpose, loop=False, peak=.50):
    signal = np.asarray(signal, dtype=float)
    if signal.ndim == 1:
        signal = signal[:,None]
    if not loop:
        fade = min(round(.006*SR), len(signal)//4)
        signal[:fade] *= np.linspace(0,1,fade)[:,None]
        signal[-fade:] *= np.linspace(1,0,fade)[:,None]
    signal *= peak/max(float(np.max(np.abs(signal))),1e-9)
    dst = ROOT/'audio/candidates'/category/(name+'.wav')
    dst.parent.mkdir(parents=True, exist_ok=True)
    pcm = (signal*32767).astype('<i2')
    with wave.open(str(dst),'wb') as w:
        w.setnchannels(signal.shape[1]); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    rows.append(dict(id=name,file=str(dst.relative_to(ROOT)),purpose=purpose,
        origin='original_local_procedural_composition',third_party_samples=False,
        status='candidate_pending_listening',channels=signal.shape[1],sample_rate=SR,
        duration_s=round(len(signal)/SR,4),loop=loop,
        peak_dbfs=round(20*np.log10(np.max(np.abs(signal))),2),
        rms_dbfs=round(20*np.log10(np.sqrt(np.mean(signal**2))),2),
        seam_jump=float(np.max(np.abs(signal[0]-signal[-1]))) if loop else None,
        sha256=hashlib.sha256(dst.read_bytes()).hexdigest()))

def music(region):
    # Sixteen bars, 4/4 at 120 BPM, common melody/harmony and sample length.
    n=SR*32
    out=np.zeros((n,2))
    def put(sig,when,gain,pan=0):
        idx=(np.arange(len(sig))+round(when*SR))%n
        out[idx,0] += sig*gain*np.sqrt((1-pan)/2)
        out[idx,1] += sig*gain*np.sqrt((1+pan)/2)
    roots=[48,45,53,55]*4
    melody=[[72,76,79,76,74,72],[69,72,76,79,76,72],
            [77,76,72,69,72,76],[74,79,81,79,76,74]]
    for bar,root in enumerate(roots):
        base=bar*2
        for off in [0,1]:
            put(tone(note(root),.9,4),base+off,.23 if region=='city' else .15,-.1)
        for j,m in enumerate(melody[bar%4]):
            put(tone(note(m),1.4,4.5 if region=='city' else 3),base+[0,.25,.5,1,1.25,1.5][j],.16,(-.3 if j%2 else .3))
            if region=='space' and j%2==0:
                put(tone(note(m+12),2,2),base+[0,.25,.5,1,1.25,1.5][j]+.125,.055,.45)
        if region!='city':
            for interval in [12,16 if root in [48,53,55] else 15,19]:
                put(tone(note(root+interval),2.4,kind='pad'),base,.035 if region=='cloud' else .065,-.3)
        for beat in range(8):
            t=np.arange(round(.065*SR))/SR
            noise=rng.normal(size=len(t))
            noise=np.concatenate(([0],np.diff(noise)))*np.exp(-65*t)
            put(noise,base+beat*.25,.009 if region=='city' else .003,.55)
        if region=='city':
            t=np.arange(round(.15*SR))/SR
            kick=np.sin(2*np.pi*(65*t+45*.025*(1-np.exp(-t/.025))))*np.exp(-25*t)
            put(kick,base,.10)
    # Circular sends preserve the loop tail rather than fading every 32 seconds.
    dry=out.copy()
    for delay,amount in [(.1875,.13),(.375,.08),(.75,.04)]:
        out += np.roll(dry,round(delay*SR),axis=0)[:,::-1]*amount
    save('bgm_'+region,out,'music',region+'：同主题完整编配，边界交叉淡化',True,.42)

def impact(material,variant):
    d={'paper':(.22,130,22,.32),'wood':(.32,190,17,.15),'rubber':(.36,95,12,.02),
       'metal':(.70,480,7,.015),'ice':(.62,980,8,.035),'ceramic':(.48,660,10,.03),
       'food':(.22,90,20,.13),'soft':(.20,80,24,.22)}[material]
    duration,f,decay,noise=d; f*=1+(variant-1)*.07
    t=np.arange(round(duration*SR))/SR
    sig=tone(f,duration,decay)
    if material in ['metal','ice','ceramic']:
        sig += .4*tone(f*2.71,duration,decay*1.2)+.24*tone(f*4.13,duration,decay*1.5)
    sig += rng.normal(size=len(t))*noise*np.exp(-35*t)
    save(f'impact_{material}_{variant+1}',sig,'sfx',f'{material} 碰撞变体 {variant+1}',peak=.4)

def phrase(name,notes,purpose,step=.11):
    length=(len(notes)-1)*step+.75
    out=np.zeros(round(length*SR))
    for i,m in enumerate(notes):
        s=tone(note(m),.7,7)
        start=round(i*step*SR); out[start:start+len(s)]+=s
    if name in ['rotate_90','claw_grip','claw_open']:
        out *= .22
        t=np.arange(round(.065*SR))/SR
        click=rng.normal(size=len(t))*np.exp(-90*t)+np.sin(2*np.pi*240*t)*np.exp(-48*t)
        out[:len(click)]+=click
    save(name,out,'sfx',purpose,peak=.36)

for region in ['city','cloud','space']: music(region)
for material in ['paper','wood','rubber','metal','ice','ceramic','food','soft']:
    for variant in range(3): impact(material,variant)
for variant in range(3):
    t=np.arange(round(.6*SR))/SR
    weight=tone(68+variant*4,.6,9)+.26*tone(144+variant*8,.6,14)
    weight+=rng.normal(size=len(t))*.08*np.exp(-30*t)
    save('impact_heavy_'+str(variant+1),weight,'sfx','巨型物体重砸层，叠加音量受总限幅',peak=.4)
for name,notes,purpose,step in [
    ('ui_tap',[79],'普通按钮确认',.10),('rotate_90',[72,79],'旋转技能接受',.07),
    ('claw_grip',[60,64],'抓手合拢',.055),('claw_open',[64,60],'抓手打开',.06),
    ('next_handoff',[76],'NEXT 正常交接，低音量',.10),
    ('stable',[72,76,79],'首次确认稳定，不能每帧响',.09),
    ('star_lost',[76,72,67],'事故扣星一次',.12),
    ('run_end',[67,64,60,55],'结束一次',.19),
    ('new_record',[72,76,79,84],'新纪录',.10),
    ('planning_warning',[81,81],'规划接近释放，低音量',.18)]: phrase(name,notes,purpose,step)
t=np.arange(round(.24*SR))/SR
noise=rng.normal(size=len(t)); smooth=np.convolve(noise,np.ones(13)/13,'same')
save('release',smooth*np.sin(np.pi*t/.24)**2,'sfx','释放空气掠过声',peak=.23)
manifest={'revision':'2026-09-12-P1','sample_rate':SR,'encoding':'PCM16 WAV masters',
    'license_note':'本地算法合成原创候选，无第三方采样；不声称排他版权或已完成听感验收。',
    'script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    'runtime_note':'WAV 为母版，Batch 1 导入前按平台转码并验收体积、解码和循环；未接游戏。',
    'entries':rows}
(ROOT/'audio/AUDIO_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'files':len(rows),'seconds':sum(r['duration_s'] for r in rows),'music_seams':[r['seam_jump'] for r in rows if r['loop']]}))
