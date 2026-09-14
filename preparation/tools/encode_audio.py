"""Local MP3 delivery candidates; masters and subjective approval stay separate."""
from pathlib import Path
import json,subprocess,hashlib
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
master=json.loads((ROOT/'audio/AUDIO_MANIFEST.json').read_text())
rows=[]
for r in master['entries']:
    src=ROOT/r['file'];dst=ROOT/'audio/encoded'/('music' if r['loop'] else 'sfx')/(r['id']+'.mp3')
    dst.parent.mkdir(parents=True,exist_ok=True)
    subprocess.run(['/opt/homebrew/bin/ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(src),
        '-codec:a','libmp3lame','-b:a','128k' if r['loop'] else '96k','-ar','44100','-write_xing','1',str(dst)],check=True)
    raw=subprocess.run(['/opt/homebrew/bin/ffmpeg','-v','error','-i',str(dst),'-f','f32le','-acodec','pcm_f32le','-'],check=True,capture_output=True).stdout
    samples=np.frombuffer(raw,dtype='<f4').reshape(-1,r['channels'])
    assert np.isfinite(samples).all() and np.max(np.abs(samples))<1
    duration=len(samples)/44100
    assert abs(duration-r['duration_s'])<.01
    rows.append({'id':r['id'],'file':str(dst.relative_to(ROOT)),'source_file':r['file'],
        'source_sha256':r['sha256'],'sha256':hashlib.sha256(dst.read_bytes()).hexdigest(),
        'bytes':dst.stat().st_size,'channels':r['channels'],'decode_duration_s':round(duration,5),
        'decode_peak_dbfs':round(float(20*np.log10(np.max(np.abs(samples)))),3),
        'decode_seam_jump':float(np.max(np.abs(samples[0]-samples[-1]))) if r['loop'] else None,
        'status':'encoded_candidate_pending_listening_and_platform_decode'})
result={'revision':'2026-09-12-P2','format':'MP3 / 44.1kHz / music 128k stereo / sfx 96k mono',
    'master_bytes':sum((ROOT/r['file']).stat().st_size for r in master['entries']),
    'encoded_bytes':sum(r['bytes'] for r in rows),'files':len(rows),
    'verification':'All files locally decoded with ffmpeg; no clipping or nonfinite samples; duration matches PCM master.',
    'not_proven':'Cocos/WeChat/iOS MP3 loop handling, device mix, autoplay, lifecycle and subjective quality',
    'script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'entries':rows}
(ROOT/'audio/ENCODED_MANIFEST.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['files','master_bytes','encoded_bytes']}))
