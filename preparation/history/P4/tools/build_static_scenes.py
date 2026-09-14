"""Create native Cocos static scenes from installed 3.8.8 serialization templates.

No gameplay scripts, timers, physics bodies, fake progression or online services.
"""
from pathlib import Path
import json,uuid,copy
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
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
    def text(self,text,x,y,w,h,size=30,rgb=(23,55,84),anchor='top'):
        n=self.node('Text:'+text,self.safe,x+w/2-375,667-y-h/2,w,h);v=copy.deepcopy(LABEL)
        for k in ['node','_id']:v.pop(k,None)
        v.update(__prefab=None,_string=text,_actualFontSize=size,_fontSize=size,_lineHeight=size+8,_color=color(rgb),_isBold=True,_fontFamily='sans-serif',_overflow=1)
        self.component(n,v)
        if anchor=='top':self.widget(n,9,left=x,top=y)
        elif anchor=='bottom':self.widget(n,12,left=x,bottom=y)
        return n
    def background(self):
        width=1900*sizes['bg_sky_panel'][0]/sizes['bg_sky_panel'][1]
        self.image('bg_sky_panel',(750-width)/2,667-950,width,parent=2,anchor=None)
        self.image('bg_city_far',-15,-8,780,parent=2,anchor='bottom')
        children=self.data[2]['_children']
        self.data[2]['_children']=[c for c in children if c['__id__']!=self.safe]+[ref(self.safe)]
    def compact_frame(self):
        # Fixed content block centered inside the safe area; no runtime adapter.
        self.safe=self.node('Content_900',self.safe,0,0,750,900)
        self.widget(self.safe,18)
    def button(self,label,y):
        self.image('btn_settings_base',180,y,390,anchor='bottom')
        self.text(label,190,y+25,370,70,36,(255,255,255),anchor='bottom')
    def save(self):
        folder=ROOT/'assets/batch0/scenes';folder.mkdir(parents=True,exist_ok=True)
        p=folder/(self.name+'.scene');p.write_text(json.dumps(self.data,ensure_ascii=False,indent=2)+'\n')
        meta={'ver':'1.1.50','importer':'scene','imported':False,'uuid':uid('scene:'+self.name),'files':['.json'],'subMetas':{},'userData':{}}
        Path(str(p)+'.meta').write_text(json.dumps(meta,indent=2)+'\n')
        return {'name':self.name,'url':'db://assets/batch0/scenes/'+p.name,'uuid':meta['uuid']}

scenes=[]
s=Scene('Home');s.background();s.compact_frame()
s.image('cloud_large_01',-20,70,250);s.image('logo_main',135,25,480)
s.image('platform_city_base',185,425,380);s.image('object_cardboard_box',284,301,180)
s.image('btn_start',155,160,440,anchor='bottom');s.button('设置',15);scenes.append(s.save())

s=Scene('HUD');s.background();world=s.node('World_1x',s.safe,0,0,750,900)
s.image('platform_city_base',175,671,400,parent=world,anchor=None)
s.image('object_cardboard_box',288,542,164,parent=world,anchor=None)
s.image('object_wood_plank',230,508,300,parent=world,anchor=None)
s.image('object_fridge',300,334,150,parent=world,anchor=None)
s.image('claw_rail',42,252,666,parent=world,anchor=None)
s.image('claw_cable_straight',337,291,10,parent=world,anchor=None)
s.image('claw_open_narrow',286,303,132,parent=world,anchor=None)
s.image('hud_height_sign',20,40,340);s.text('88.6',139,108,141,72,46,(255,255,255))
s.image('hud_region_sign',404,45,218);s.text('城市',478,108,118,54,30)
s.image('hud_pause',660,96,62)
for i in range(3):s.image('hud_star_full',268+i*70,185,60)
s.image('hud_next_frame',610,273,112);s.image('next_basketball',634,354,64)
s.image('itembar_empty',22,50,326,anchor='bottom');s.image('hud_rotate_90',555,44,160,anchor='bottom');scenes.append(s.save())

s=Scene('Settings');s.background();s.compact_frame();s.image('panel_9slice_light',84,35,582,665,sliced=True)
s.text('设置',150,78,450,74,48)
for title,y,on in [('音乐',235,True),('音效',365,True),('震动',495,False)]:
    s.text(title,143,y,210,76,38);s.image('toggle_on' if on else 'toggle_off',419,y+2,166,74)
s.button('返回',35);scenes.append(s.save())

s=Scene('Result');s.background();s.compact_frame();s.image('panel_9slice_light',85,20,580,665,sliced=True)
s.image('result_final_height_badge',179,62,390);s.text('88.6 m',150,205,450,126,86)
s.text('新纪录',200,351,350,70,38,(206,133,20));s.image('result_death_reason_header',218,453,314)
s.image('death_reason_collapse',220,568,72);s.text('大量物体倒塌',295,573,260,64,28)
s.image('result_btn_retry',156,30,438,anchor='bottom');scenes.append(s.save())

(ROOT/'preparation/docs/STATIC_SCENES.json').write_text(json.dumps({'scope':'Batch 0 visual validation only; static sample labels; no gameplay','scenes':scenes},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'scenes':len(scenes),'scripts':0,'images':len(frames)}))
