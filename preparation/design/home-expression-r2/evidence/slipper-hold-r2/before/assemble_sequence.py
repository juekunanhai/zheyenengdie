"""Build only this review sample's fixed timeline from the registered source manifests."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent
faces=json.loads((ROOT/'face/manifest.json').read_text())['assets']
hand=json.loads((ROOT/'hand/manifest.json').read_text())
slipper_hands=json.loads((ROOT/'slipper/hands/manifest.json').read_text())
slipper_face=json.loads((ROOT/'slipper/face/manifest.json').read_text())
slipper_ref=json.loads((ROOT/'slipper/REFERENCE.json').read_text())

def blink(asset,start,peak,close,hold,reopen):
    rect=asset['rect']
    frames=[{'time':0,'file':None}]
    for i in range(1,peak+1):
        frames.append({'time':round(close*(i/peak)**.75,5),'file':'face/'+asset['frames'][i]['file']})
    frames.append({'time':round(close+hold,5),'file':'face/'+asset['frames'][peak]['file']})
    for i in range(peak-1,-1,-1):
        frames.append({'time':round(close+hold+reopen*(1-i/peak),5),'file':'face/'+asset['frames'][i]['file'] if i else None})
    return {'name':asset['name'],'start':start,'rect':[rect[k] for k in ['left','top','width','height']],'frames':frames}

hand_start=1.70
hand_time_scale=.9
# Keep the original contact-to-reaction delay while making the reach 10% brisker.
layers=[blink(faces[0],.70,6,.070,.035,.120),
    blink(faces[0],1.12,6,.058,.024,.108),
    blink(faces[1],round(hand_start+.87*hand_time_scale,5),2,.080,.080,.150)]
x,y,right,bottom=hand['cropHeroPx']
layers.append({'name':'arm','start':hand_start,'rect':[x,y,right-x,bottom-y],
    'frames':[{'time':round(f['timeSeconds']*hand_time_scale,5),'file':'hand/'+f['file']} for f in hand['frames']]})
slipper_start=3.90
layers.append({'name':'slipper_hands','space':'stage','start':slipper_start,
    'rect':slipper_hands['rectStage'],
    'frames':[{'time':f['timeSeconds'],'file':'slipper/hands/'+f['file']} for f in slipper_hands['frames']]})
shoe_x,shoe_y,shoe_width,_=slipper_ref['frontSlipperRectStage']
scale=shoe_width/slipper_face['sourceSize'][0]
x,y,width,height=slipper_face['rect']
effort_start=round(slipper_start+slipper_hands['contactSeconds']+.04,5)
effort=[{'time':0,'file':None}]
for i in range(1,7):
    effort.append({'time':round(.14*i/6,5),'file':'slipper/face/'+slipper_face['frames'][i]['file']})
effort.append({'time':.37,'file':'slipper/face/'+slipper_face['frames'][6]['file']})
for i in range(5,-1,-1):
    effort.append({'time':round(.37+.17*(1-i/6),5),
        'file':'slipper/face/'+slipper_face['frames'][i]['file'] if i else None})
layers.append({'name':'slipper_effort','space':'stage','start':effort_start,
    'rect':[shoe_x+x*scale,shoe_y+y*scale,width*scale,height*scale],'frames':effort})
sequence={'status':'independent sample, not production integration','revision':'slipper-grab-r1','duration':8.2,'layers':layers,
    'details':{'hand':[130,650,460,490],'eye':[320,55,195,120]},
    'reviewTimes':{'rest':0,'half_blink':.737,'closed_blink':.785,'second_blink':1.19,
        'peek':1.988,'reach':2.222,'contact':2.375,'grip':2.672,'withdraw':3.158,'returned':3.51,
        'slipper_peek':4.15,'slipper_reach':4.40,'slipper_contact':4.65,'slipper_effort':4.93,
        'slipper_relax':5.23,'slipper_withdraw':5.52,'slipper_returned':5.91}}
(ROOT/'sequence.json').write_text(json.dumps(sequence,ensure_ascii=False,indent=2)+'\n')
print({l['name']:len(l['frames']) for l in layers})
