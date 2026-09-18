"""Build only this review sample's fixed timeline from the registered source manifests."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent
faces=json.loads((ROOT/'face/manifest.json').read_text())['assets']
hand=json.loads((ROOT/'hand/manifest.json').read_text())

def blink(asset,start,peak,close,hold,reopen):
    rect=asset['rect']
    frames=[{'time':0,'file':None}]
    for i in range(1,peak+1):
        frames.append({'time':round(close*(i/peak)**.75,5),'file':'face/'+asset['frames'][i]['file']})
    frames.append({'time':round(close+hold,5),'file':'face/'+asset['frames'][peak]['file']})
    for i in range(peak-1,-1,-1):
        frames.append({'time':round(close+hold+reopen*(1-i/peak),5),'file':'face/'+asset['frames'][i]['file'] if i else None})
    return {'name':asset['name'],'start':start,'rect':[rect[k] for k in ['left','top','width','height']],'frames':frames}

layers=[blink(faces[0],.95,6,.070,.035,.120),blink(faces[1],3.17,2,.080,.080,.150)]
x,y,right,bottom=hand['cropHeroPx']
layers.append({'name':'arm','start':2.30,'rect':[x,y,right-x,bottom-y],
    'frames':[{'time':f['timeSeconds'],'file':'hand/'+f['file']} for f in hand['frames']]})
sequence={'status':'independent sample, not production integration','duration':8,'layers':layers,
    'details':{'hand':[130,650,460,490],'eye':[320,55,195,120]},
    'reviewTimes':{'rest':0,'half_blink':.987,'closed_blink':1.035,'peek':2.62,'reach':2.88,'contact':3.05,'grip':3.38,'withdraw':3.92,'returned':4.31}}
(ROOT/'sequence.json').write_text(json.dumps(sequence,ensure_ascii=False,indent=2)+'\n')
print({l['name']:len(l['frames']) for l in layers})
