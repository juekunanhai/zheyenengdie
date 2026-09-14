"""Offline composition check from .scene data. This is NOT Cocos rendering."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[2]
frames={}
for p in (ROOT/'assets/batch0/art').glob('*.png.meta'):
    m=json.loads(p.read_text());frames[m['uuid']+'@f9941']={'src':'../../'+str(p.relative_to(ROOT)).removesuffix('.meta'),'insets':{k:m['subMetas']['f9941']['userData'][k] for k in ['borderTop','borderBottom','borderLeft','borderRight']}}
scenes={p.stem:json.loads(p.read_text()) for p in (ROOT/'assets/batch0/scenes').glob('*.scene')}
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Batch 0 静态构图核对</title>
<style>*{box-sizing:border-box}body{margin:0;background:#eef3f7;color:#173047;font:15px/1.7 system-ui}header{background:#123653;color:white;padding:28px max(20px,calc((100vw - 1240px)/2))}h1{font-size:26px;margin:0}main{max-width:1280px;margin:auto;padding:20px}p{margin:8px 0}button,select{font:inherit;border:1px solid #bbcedd;border-radius:7px;background:white;padding:7px 12px;color:#173047}label{margin-right:14px}.bar{display:flex;gap:12px;flex-wrap:wrap;padding:10px 0 20px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}.card{min-width:0}canvas{width:100%;display:block;border-radius:17px;box-shadow:0 3px 20px #213d5820;background:#66c4f1}h2{font-size:17px;margin:8px 0}.note{padding:12px 16px;background:#fff4d9;border-left:4px solid #dfaa35;margin:8px 0 16px}a{color:#197bc1}.facts{background:white;border-radius:10px;padding:18px;margin-top:24px}#status{font-size:13px;color:#5e7385}@media(max-width:950px){.grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:520px){.grid{grid-template-columns:1fr}}
</style><header><h1>Batch 0 · 静态构图核对</h1><p>首页 / HUD / 设置 / 结算 · 使用同一批原生场景数据</p></header><main>
<div class="note">此页用浏览器 Canvas 展示 .scene 的构图意图，<b>不是 Cocos 引擎运行结果</b>。没有玩法、倒计时或真实成绩。Creator 已登录且 Web 构建成功；<a href="engine.html">实际引擎验收页</a>提供原生场景显示。此页仍仅是构图参考。</div>
<div class="bar"><label>画幅 <select id="ratio"><option value="1334">9:16 · 常规竖屏</option><option value="1624">约 9:19.5 · 长屏</option><option value="1000">3:4 · 短竖屏</option></select></label><label><input id="safe" type="checkbox" checked> 模拟顶部 48 / 底部 32 设计单位安全区</label><label><input id="zoom" type="checkbox"> HUD 世界缩放 0.75，界面保持大小</label><span id="status"></span></div>
<div class="grid">__CARDS__</div><div class="facts"><b>检查方式</b><p>切换画幅，检查顶部挂牌、底部按钮和面板的占位；缩放仅作用于 HUD 场景的 World_1x 节点。示例高度是静态文本；星星、NEXT 与待放物彼此独立。</p><p>图鉴、排行、技术分、分享等未到批次的功能不出现。按钮在此页不可点击，不代表游戏交互。</p><a href="index.html">素材与音频审阅</a> · <a href="edge-review.html">本轮已接受的补边素材</a></div></main>
<script>
const scenes=__SCENES__,frames=__FRAMES__,images={};
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
function nine(ctx,img,x,y,w,h,b){const l=b.borderLeft,r=b.borderRight,t=b.borderTop,bt=b.borderBottom;const sx=[0,l,img.width-r,img.width],sy=[0,t,img.height-bt,img.height],dx=[x,x+l,x+w-r,x+w],dy=[y,y+t,y+h-bt,y+h];for(let j=0;j<3;j++)for(let i=0;i<3;i++){if(dx[i+1]>dx[i]&&dy[j+1]>dy[j])ctx.drawImage(img,sx[i],sy[j],sx[i+1]-sx[i],sy[j+1]-sy[j],dx[i],dy[j],dx[i+1]-dx[i],dy[j+1]-dy[j])}}
function draw(name){const data=scenes[name],c=document.getElementById(name),H=+document.querySelector('#ratio').value;c.width=750;c.height=H;const ctx=c.getContext('2d');ctx.fillStyle='#65c4f0';ctx.fillRect(0,0,750,H);const inset=document.querySelector('#safe').checked?{top:48,bottom:32}:{top:0,bottom:0};const safeH=H-inset.top-inset.bottom;
 function visit(index,parent){const n=data[index];if(n._active===false)return;const comps=(n._components||[]).map(r=>data[r.__id__]);const tr=comps.find(c=>c.__type__==='cc.UITransform');const wi=comps.find(c=>c.__type__==='cc.Widget');let w=tr?tr._contentSize.width:parent.w,h=tr?tr._contentSize.height:parent.h;let x=parent.x+(n._lpos?.x||0)+parent.w/2-w/2,y=parent.y+parent.h/2-(n._lpos?.y||0)-h/2;
 if(n._name==='Canvas'){x=0;y=0;w=750;h=H} else if(n._name==='SafeArea'){x=0;y=inset.top;w=750;h=safeH} else if(wi){if(wi._alignFlags&8)x=parent.x+wi._left;if(wi._alignFlags&1)y=parent.y+wi._top;if(wi._alignFlags&4)y=parent.y+parent.h-wi._bottom-h;}
 ctx.save();if(n._name==='World_1x'&&document.querySelector('#zoom').checked){ctx.translate(x+w/2,y+h/2);ctx.scale(.75,.75);ctx.translate(-(x+w/2),-(y+h/2))}
 const sp=comps.find(c=>c.__type__==='cc.Sprite');if(sp){const frame=frames[sp._spriteFrame.__uuid__],img=images[frame.src];if(sp._type===1)nine(ctx,img,x,y,w,h,frame.insets);else ctx.drawImage(img,x,y,w,h)}
 const lb=comps.find(c=>c.__type__==='cc.Label');if(lb){const co=lb._color;ctx.fillStyle=`rgba(${co.r},${co.g},${co.b},${co.a/255})`;ctx.font=`${lb._isBold?'700':'400'} ${lb._fontSize}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(lb._string,x+w/2,y+h/2,w)}
 for(const child of n._children||[])visit(child.__id__,{x,y,w,h});ctx.restore(); }
 visit(2,{x:0,y:0,w:750,h:H});return [...data].filter(n=>n.__type__==='cc.Sprite').length;
}
async function run(){await Promise.all(Object.values(frames).map(f=>new Promise((resolve,reject)=>{const img=new Image;img.onload=()=>{images[f.src]=img;resolve()};img.onerror=()=>reject(f.src);img.src=f.src})));let count=0;for(const name of Object.keys(scenes))count+=draw(name);document.querySelector('#status').textContent=`4 个场景 · ${count} 个图片引用已显示`}
document.querySelectorAll('input,select').forEach(e=>e.onchange=()=>Object.keys(scenes).forEach(draw));run().catch(e=>document.querySelector('#status').textContent='加载失败：'+e);
</script></html>'''
page=page.replace('__CARDS__',''.join(f'<section class="card"><h2>{name}</h2><canvas id="{name}"></canvas></section>' for name in ['Home','HUD','Settings','Result']))
page=page.replace('__SCENES__',json.dumps(scenes,ensure_ascii=False)).replace('__FRAMES__',json.dumps(frames,ensure_ascii=False))
(ROOT/'preparation/review/layout.html').write_text(page)

edges=json.loads((ROOT/'preparation/art/EDGE_CANDIDATE_MANIFEST.json').read_text())
body=''.join(f'<article><h2>{r["id"]}</h2><img src="../{r["output"]}"><p>{r["notes"]}</p><small>视觉已接受；引擎验收待完成</small></article>' for r in edges['entries'])
html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>本轮补边素材</title><style>body{font:15px/1.7 system-ui;background:#edf4f8;color:#173047;margin:30px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:20px}article{background:white;border-radius:12px;padding:20px}h2{font-size:18px}img{width:100%;height:260px;object-fit:contain;background:#cbdfea}small{color:#46765a}</style><h1>本轮已接受的补边素材</h1><p>仅补齐当前缺失，原图未修改。<a href="layout.html">查看静态构图</a></p><main>'+body+'</main></html>'
(ROOT/'preparation/review/edge-review.html').write_text(html)
print('layout.html and edge-review.html built')
