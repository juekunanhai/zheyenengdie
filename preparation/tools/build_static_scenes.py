"""Create native Cocos static scenes from installed 3.8.8 serialization templates.

No gameplay scripts, timers, physics bodies, fake progression or online services.
"""
from pathlib import Path
import json,uuid,copy
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
if (ROOT/'assets/batch1/game-controller.ts').exists():
    raise SystemExit('Batch 1A 已加入场景行为；静态生成器已停用，避免覆盖玩法组件。请直接维护现有 .scene。')
EDITOR=Path('/Applications/CocosCreator/3.8.8/CocosCreator.app/Contents/Resources')
ENGINE=EDITOR/'resources/3d/engine/editor/assets'
TEMPLATE=json.loads((ENGINE/'default_file_content/scene/scene-2d.scene').read_text())
META=json.loads((ENGINE/'default_ui/default_sprite.png.meta').read_text())
example=json.loads((EDITOR/'templates/taxi/assets/scene/login.scene').read_text())
SPRITE=next(x for x in example if x.get('__type__')=='cc.Sprite')
LABEL=next(x for x in example if x.get('__type__')=='cc.Label')
NS=uuid.UUID(json.loads((ROOT/'package.json').read_text())['uuid'])
def uid(name):return str(uuid.uuid5(NS,name))
def ref(n):return {'__id__':n}
def color(rgb):return dict(__type__='cc.Color',r=rgb[0],g=rgb[1],b=rgb[2],a=rgb[3] if len(rgb)>3 else 255)

edge={r['id']:r for r in json.loads((ROOT/'preparation/art/EDGE_CANDIDATE_MANIFEST.json').read_text())['entries']}
frames={};sizes={}
for p in (ROOT/'assets/batch0/art').glob('*.png'):
    existing=Path(str(p)+'.meta')
    if existing.exists():
        meta=json.loads(existing.read_text());frames[p.stem]=meta['uuid']+'@f9941';sizes[p.stem]=Image.open(p).size
        continue
    u=uid(str(p.relative_to(ROOT)));meta=copy.deepcopy(META);meta['uuid']=u;meta['imported']=False
    w,h=Image.open(p).size;sizes[p.stem]=(w,h)
    for key,m in meta['subMetas'].items():
        m['uuid']=u+'@'+key;m['imported']=False;m['displayName']=p.stem
        m['userData']['imageUuidOrDatabaseUri']=u+('@6c48a' if key=='f9941' else '')
        if key=='f9941':
            data=m['userData'];data.pop('vertices',None)
            data.update(trimType='none',trimX=0,trimY=0,offsetX=0,offsetY=0,width=w,height=h,rawWidth=w,rawHeight=h)
            inset=edge.get(p.stem,{}).get('slice_insets_px',[0,0,0,0])
            for key2,value in zip(['borderTop','borderRight','borderBottom','borderLeft'],inset):data[key2]=value
    meta['userData']['redirect']=u+'@6c48a'
    Path(str(p)+'.meta').write_text(json.dumps(meta,indent=2)+'\n')
    frames[p.stem]=u+'@f9941'

class Scene:
    def __init__(self,name):
        self.name=name;self.data=copy.deepcopy(TEMPLATE);d=self.data
        d[0]['_name']=d[1]['_name']=name;d[1]['_id']=uid('scene:'+name)
        d[2]['_lpos'].update(x=375,y=667);d[5]['_contentSize'].update(width=750,height=1334)
        d[3]['_lpos']['z']=1000;d[4]['_orthoHeight']=667;d[4]['_color']=color((85,190,240))
        self.safe=self.node('SafeArea',2,0,0,750,1334)
        self.widget(self.safe,45,0,0,0,0)
        self.component(self.safe,dict(__type__='cc.SafeArea',_enabled=True))
    def component(self,node,values):
        n=len(self.data);self.data.append({'_name':'','_objFlags':0,'node':ref(node),'_enabled':True,'__prefab':None,'_id':uid(self.name+':component:'+str(n)),**values});self.data[node]['_components'].append(ref(n));return n
    def node(self,name,parent,x,y,w,h):
        n=len(self.data);d=copy.deepcopy(TEMPLATE[2]);d.update(_name=name,_parent=ref(parent),_children=[],_components=[],_id=uid(self.name+':node:'+str(n)))
        d['_lpos'].update(x=x,y=y,z=0);self.data.append(d);self.data[parent]['_children'].append(ref(n))
        self.component(n,dict(__type__='cc.UITransform',_contentSize=dict(__type__='cc.Size',width=w,height=h),_anchorPoint=dict(__type__='cc.Vec2',x=.5,y=.5)))
        return n
    def widget(self,node,flags,left=0,right=0,top=0,bottom=0):
        v=copy.deepcopy(TEMPLATE[7]);v.pop('node');v.pop('_id');v['_alignFlags']=flags;v.update(_left=left,_right=right,_top=top,_bottom=bottom)
        return self.component(node,v)
    def image(self,id,x,y,w,h=None,parent=None,anchor='top',sliced=False):
        h=h or w*sizes[id][1]/sizes[id][0];p=parent or self.safe
        parent_h=next(self.data[c['__id__']]['_contentSize']['height'] for c in self.data[p]['_components'] if self.data[c['__id__']]['__type__']=='cc.UITransform')
        n=self.node(id,p,x+w/2-375,parent_h/2-y-h/2,w,h)
        v=copy.deepcopy(SPRITE)
        for k in ['node','_id']:v.pop(k,None)
        v.update(__prefab=None,_sizeMode=0,_type=1 if sliced else 0,_isTrimmedMode=False,_spriteFrame={'__uuid__':frames[id],'__expectedType__':'cc.SpriteFrame'})
        self.component(n,v)
        if anchor=='top':self.widget(n,9,left=x,top=y)
        elif anchor=='bottom':self.widget(n,12,left=x,bottom=y)
        return n
    def text(self,text,x,y,w,h,size=30,rgb=(23,55,84),anchor='top',outline=0):
        n=self.node('Text:'+text,self.safe,x+w/2-375,667-y-h/2,w,h);v=copy.deepcopy(LABEL)
        for k in ['node','_id']:v.pop(k,None)
        v.update(__prefab=None,_string=text,_actualFontSize=size,_fontSize=size,_lineHeight=size+8,_color=color(rgb),_isBold=True,_fontFamily='sans-serif',_overflow=1)
        v.update(_enableOutline=outline>0,_outlineWidth=outline,_outlineColor=color((19,65,137)))
        self.component(n,v)
        if anchor=='top':self.widget(n,9,left=x,top=y)
        elif anchor=='bottom':self.widget(n,12,left=x,bottom=y)
        return n
    def background(self):
        for i,id in enumerate(['bg_ground_city','bg_city_altitude','bg_cloud_altitude','bg_space_altitude']):
            n=self.image(id,0,0,750,1334,parent=2,anchor=None)
            self.component(n,dict(__type__='cc.UIOpacity',_opacity=255 if i==0 else 0))
        children=self.data[2]['_children']
        self.data[2]['_children']=[c for c in children if c['__id__']!=self.safe]+[ref(self.safe)]
        script=json.loads((ROOT/'assets/batch0/presentation/HeightBackdrop.ts.meta').read_text())['uuid'].replace('-','')
        alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
        compressed=script[:5]+''.join(alphabet[int(script[i:i+3],16)>>6]+alphabet[int(script[i:i+3],16)&63] for i in range(5,32,3))
        self.component(2,dict(__type__=compressed))
    def object(self,id,cx,bottom,units=180,parent=None):
        # Only a visual scale; physics remains 100 world units/u in ENGINEERING_BASELINE.
        table=json.loads((ROOT/'preparation/art/OBJECT_GAMEPLAY_SCALE.reference.json').read_text())['objects']
        spec=next(r for r in table if 'object_'+r['slug']==id)
        im=Image.open(ROOT/'assets/batch0/art'/f'{id}.png');bounds=im.getbbox()
        w=units*spec['gameplay_scale']['width_u']*im.width/(bounds[2]-bounds[0])
        return self.image(id,cx-w/2,bottom,w,parent=parent,anchor='bottom')
    def compact_frame(self):
        # Fixed content block centered inside the safe area; no runtime adapter.
        self.safe=self.node('Content_1230',self.safe,0,0,750,1230)
        self.widget(self.safe,18)
    def button(self,label,y):
        self.image('btn_settings_base',180,y,390,anchor='bottom')
        self.text(label,190,y+25,370,70,36,(255,255,255),anchor='bottom')
    def save(self):
        folder=ROOT/'assets/batch0/scenes';folder.mkdir(parents=True,exist_ok=True)
        p=folder/(self.name+'.scene');content=json.dumps(self.data,ensure_ascii=False,indent=2)+'\n'
        if not p.exists() or p.read_text()!=content:p.write_text(content)
        meta={'ver':'1.1.50','importer':'scene','imported':False,'uuid':uid('scene:'+self.name),'files':['.json'],'subMetas':{},'userData':{}}
        if not Path(str(p)+'.meta').exists():Path(str(p)+'.meta').write_text(json.dumps(meta,indent=2)+'\n')
        return {'name':self.name,'url':'db://assets/batch0/scenes/'+p.name,'uuid':meta['uuid']}

scenes=[]
s=Scene('Home');s.background();s.compact_frame()
s.image('btn_settings_icon',632,20,88)
s.text('设置',626,106,100,42,26,(255,255,255),outline=3)
s.image('logo_main',70,46,610)
s.text('把乱七八糟的东西叠上天',110,380,530,54,32,(255,255,255),outline=4)
# Decorative home stack. These are source sprites, not a gameplay state.
s.image('platform_city_base',222,162,306,anchor='bottom')
s.object('object_cardboard_box',374,244,188)
s.object('object_fridge',387,400,195)
s.object('object_basketball',379,611,172)
s.image('btn_start',107,30,536,anchor='bottom')
scenes.append(s.save())

s=Scene('HUD');s.background();world=s.node('World_1x',s.safe,0,0,750,1334)
base=s.node('GroundOrigin',world,0,0,750,1334);s.widget(base,45)
s.image('platform_city_base',235,196,280,parent=base,anchor='bottom')
# Independent held object and claw; the initial tower is empty and height is zero.
rig=s.node('Rig',world,0,0,750,1334)
held=s.image('object_cardboard_box',283,152,184,parent=rig)
s.data[held]['_name']='HeldObject'
s.image('claw_cable_straight',369,-9,12,parent=rig)
s.image('claw_open_narrow',311,52,128,parent=rig)
s.image('hud_height_sign',22,0,240)
s.text('0.0',99,62,115,50,37,(255,255,255))
for i in range(3):s.image('hud_star_full',43+i*58,148,46)
s.image('hud_pause',640,16,88)
s.image('hud_next_frame',616,155,112);s.image('next_basketball',641,237,62)
sample=s.node('TowerPreview',world,0,0,750,1334);s.widget(sample,45);s.data[sample]['_active']=False
# Illustration only: actual objects contact each other, with no separator boards.
s.object('object_cardboard_box',375,-188,182,parent=sample)
s.object('object_cardboard_box',375,-24,182,parent=sample)
s.object('object_fridge',375,138,185,parent=sample)
s.object('object_ice_block',375,344,168,parent=sample)
# Rotate only the existing symmetric empty tray. Future item icons stay upright.
tray_h=308*sizes['itembar_empty'][1]/sizes['itembar_empty'][0]
column=s.node('InventoryColumn',s.safe,20+tray_h/2-375,-667+24+154,tray_h,308)
s.widget(column,12,left=20,bottom=24)
tray=s.image('itembar_empty',(750-308)/2,(308-tray_h)/2,308,parent=column,anchor=None)
s.data[tray]['_lrot'].update(x=0,y=0,z=2**-.5,w=2**-.5)
s.data[tray]['_euler'].update(x=0,y=0,z=90)
s.image('hud_rotate_90',504,18,234,anchor='bottom')
scenes.append(s.save())

s=Scene('Settings');s.background();s.compact_frame()
s.image('panel_9slice_light',82,250,586,630,sliced=True)
s.image('btn_settings_icon',319,165,112)
s.text('设置',150,297,450,74,51,(23,73,144))
for title,y,on in [('音乐',434,True),('音效',563,True),('震动',692,False)]:
    s.text(title,141,y,210,76,40,(23,73,144));s.image('toggle_on' if on else 'toggle_off',420,y+4,170,70)
s.button('返回',165);scenes.append(s.save())

s=Scene('Result');s.background();s.compact_frame()
s.image('panel_9slice_light',74,245,602,690,sliced=True)
s.text('本次叠到了',160,283,430,80,46,(23,73,144))
s.text('88.6 m',115,378,520,156,112,(255,213,61),outline=8)
s.text('新纪录！',210,550,330,76,46,(255,255,255),outline=5)
s.image('result_death_reason_header',218,687,314)
s.image('death_reason_collapse',200,812,74);s.text('大量物体倒塌',288,819,286,60,30,(23,73,144))
s.image('result_btn_retry',113,100,524,anchor='bottom');scenes.append(s.save())

(ROOT/'preparation/docs/STATIC_SCENES.json').write_text(json.dumps({'scope':'Batch 0 visual validation; HeightBackdrop is presentation only; no gameplay','scenes':scenes},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'scenes':len(scenes),'presentation_scripts':1,'images':len(frames)}))
