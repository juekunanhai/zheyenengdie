"""Local QA shell for actual built Cocos scenes. Never copied into assets."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
if (ROOT/'assets/batch1/game-controller.ts').exists():
    for name, destination in [('engine.html', 'play.html'), ('engine-player.html', 'play-player.html')]:
        (ROOT/'preparation/review'/name).write_text(f'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url={destination}"><title>已进入 Batch 1A</title><p>当前构建已进入四物体试放。<a href="{destination}">打开当前版本</a></p></html>')
    print('旧静态入口已指向当前 Batch 1A；原静态验收截图与报告保留。')
    raise SystemExit(0)
original=(ROOT/'build/web-desktop/index.html').read_text()
player=original.replace('<head>','<head><base href="../../build/web-desktop/">')
player=player.replace('</head>','''<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}.header,.footer{display:none}#GameDiv{width:100%!important;height:100%!important;border:0;border-radius:0;box-shadow:none}</style></head>''')
player=player.replace('</body>','''<script>
(async()=>{
 try {
  const cc=await System.import('cc');
  const deadline=Date.now()+30000;
  while(!cc.director.getScene()){if(Date.now()>deadline)throw Error('场景启动超时');await new Promise(r=>setTimeout(r,100))}
  cc.profiler.hideStats();
  window.qaLoad=name=>new Promise((resolve,reject)=>cc.director.loadScene(name,(error)=>error?reject(error):resolve()));
  window.qaZoom=value=>{const safe=cc.director.getScene().getChildByName('Canvas')?.getChildByName('SafeArea'),world=safe?.getChildByName('World_1x');if(world){const h=safe.getComponent(cc.UITransform).height,scale=Math.min(1,Math.max(.6,(h-240)/1094))*value;world.setScale(scale,scale,1);world.setPosition(0,-h/2+196-scale*(-667+196),0);world.getChildByName('Rig')?.setPosition(0,(h/2-world.position.y)/scale-667,0)}};
  window.qaViewHeight=()=>cc.director.getScene().getChildByName('Canvas').getComponent('HeightBackdrop').getViewHeight();
  window.qaHeight=value=>{const canvas=cc.director.getScene().getChildByName('Canvas');canvas.getComponent('HeightBackdrop').setViewHeight(value);const world=canvas.getChildByName('SafeArea')?.getChildByName('World_1x');if(world){const ground=world.getChildByName('GroundOrigin');const widget=ground.getComponent(cc.Widget);widget.enabled=false;ground.setPosition(0,-Math.min(value,16)*42,0);ground.active=value<16;const sample=world.getChildByName('TowerPreview');if(sample)sample.active=value>0;const safe=canvas.getChildByName('SafeArea');const height=safe.getChildByName('Text:0.0');if(height)height.getComponent(cc.Label).string=value.toFixed(1);}};
  window.qaInfo=()=>{const s=cc.director.getScene();const root=s.getChildByName('Canvas');const nodes=[root,...root.children,...root.getChildByName('SafeArea').children];const camera=root.getComponent(cc.Canvas).cameraComponent;function bounds(n){const tr=n.getComponent(cc.UITransform);if(!tr)return null;const a=tr.anchorPoint,z=tr.contentSize;const points=[[0,0],[z.width,0],[0,z.height],[z.width,z.height]].map(([x,y])=>camera.worldToScreen(tr.convertToWorldSpaceAR(new cc.Vec3(x-z.width*a.x,y-z.height*a.y,0))));return {x:Math.min(...points.map(p=>p.x)),y:Math.min(...points.map(p=>p.y)),right:Math.max(...points.map(p=>p.x)),top:Math.max(...points.map(p=>p.y))}}return {scene:s.name,viewHeightM:root.getComponent('HeightBackdrop')?.getViewHeight(),backgrounds:root.children.filter(n=>n.name.startsWith('bg_')).map(n=>({name:n.name,active:n.active,opacity:n.getComponent(cc.UIOpacity)?.opacity})),engine:cc.VERSION,design:cc.view.getDesignResolutionSize(),visible:cc.view.getVisibleSize(),canvas:[cc.game.canvas.width,cc.game.canvas.height],screen:cc.screen.windowSize,nodes:nodes.map(n=>({name:n.name,bounds:bounds(n),scale:n.scale,position:n.position,size:n.getComponent(cc.UITransform)?.contentSize,anchor:n.getComponent(cc.UITransform)?.anchorPoint,camera:n.getComponent(cc.Camera)?.orthoHeight}))}};
  parent.postMessage({type:'cocos-ready',info:window.qaInfo()},location.origin);
 }catch(error){parent.postMessage({type:'cocos-error',error:String(error)},location.origin)}
})();
</script></body>''')
(ROOT/'preparation/review/engine-player.html').write_text(player)
(ROOT/'preparation/review/engine.html').write_text('''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Batch 0 · Cocos 实际构建验收</title>
<style>body{margin:0;background:#edf3f8;font:15px/1.7 system-ui;color:#173047}header{padding:20px}h1{font-size:24px;margin:0}p{margin:5px 0}.controls{display:flex;flex-wrap:wrap;gap:14px;margin-top:16px}select,button{font:inherit;padding:5px}main{display:flex;justify-content:center;padding-bottom:25px}iframe{border:0;box-shadow:0 3px 24px #20364d33}#status{color:#2c6e52}a{color:#197bc1}</style>
<header><h1>Batch 0 · Cocos 实际构建验收</h1><p>使用 Creator 3.8.8 实际 Web 构建。视觉基础验收：地面起步 / 高度驱动背景。高度控制只用于预览，塔段和成绩为示例，尚无玩法。</p><div class="controls"><label>场景 <select id="scene" disabled><option>Home</option><option>HUD</option><option>Settings</option><option>Result</option></select></label><label>画幅 <select id="ratio"><option value="375,667">9:16 · 375×667</option><option value="375,812">长屏 · 375×812</option><option value="600,800">3:4 · 600×800</option></select></label><label><input type="checkbox" id="zoom" disabled> HUD 世界 0.75</label><label>预览高度 <select id="altitude"><option value="0">0 m · 地面起点</option><option value="6">6 m · 离开地面</option><option value="24">24 m · 城市上空</option><option value="56">56 m · 进入云层</option><option value="100">100 m · 云海</option><option value="160">160 m · 大气边缘</option><option value="220">220 m · 太空</option></select></label><button id="inspect">读取布局数据</button><span id="status">引擎加载中…</span></div><p>切换画幅会重新启动场景，以验证不同设备初始尺寸。这里验证真实图片、字体、锚点和场景加载；浏览器没有刘海/微信胶囊，不代替真机安全区。<a href="layout.html">构图参考</a> · <a href="index.html#audio">音频候选试听</a></p></header>
<details><summary>布局诊断</summary><pre id="diagnostics"></pre></details><main><iframe id="player" title="Cocos 静态场景" src="engine-player.html" width="375" height="667"></iframe></main>
<script>
const frame=document.querySelector('#player'),scene=document.querySelector('#scene'),status=document.querySelector('#status'),zoom=document.querySelector('#zoom');
function applyHeight(){const target=scene.value==='HUD'?+document.querySelector('#altitude').value:0;frame.contentWindow.qaHeight(target);status.textContent='背景过渡中…';function settled(){if(target!==(scene.value==='HUD'?+document.querySelector('#altitude').value:0))return;if(Math.abs(frame.contentWindow.qaViewHeight()-target)<.01){info();status.dataset.height=String(target)}else requestAnimationFrame(settled)}requestAnimationFrame(settled)}
document.querySelector('#altitude').onchange=applyHeight;
function info(){const i=frame.contentWindow.qaInfo();status.textContent=`${i.scene} · Cocos ${i.engine} · 已载入`}
window.addEventListener('message',async e=>{if(e.origin!==location.origin||e.source!==frame.contentWindow)return;if(e.data.type==='cocos-ready'){if(scene.value!=='Home')await frame.contentWindow.qaLoad(scene.value);frame.contentWindow.qaZoom(zoom.checked?.75:1);applyHeight();scene.disabled=false;zoom.disabled=false;info()}else if(e.data.type==='cocos-error')status.textContent=e.data.error});
scene.onchange=async()=>{scene.disabled=true;status.textContent='场景切换中…';try{await frame.contentWindow.qaLoad(scene.value);frame.contentWindow.qaZoom(zoom.checked?.75:1);applyHeight();info()}catch(e){status.textContent=String(e)}finally{scene.disabled=false}};
zoom.onchange=()=>frame.contentWindow.qaZoom(zoom.checked?.75:1);
document.querySelector('#inspect').onclick=()=>{document.querySelector('#diagnostics').textContent=JSON.stringify(frame.contentWindow.qaInfo(),null,2);document.querySelector('details').open=true};
document.querySelector('#ratio').onchange=e=>{const [w,h]=e.target.value.split(',');scene.disabled=true;zoom.disabled=true;status.textContent='按新画幅重新载入…';frame.width=w;frame.height=h;frame.src='engine-player.html?size='+encodeURIComponent(e.target.value)};
</script></html>''')
print('Actual-engine review shell generated; build output unchanged')
