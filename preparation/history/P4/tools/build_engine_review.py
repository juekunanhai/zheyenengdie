"""Local QA shell for actual built Cocos scenes. Never copied into assets."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
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
  window.qaZoom=value=>{const world=cc.director.getScene().getChildByName('Canvas')?.getChildByName('SafeArea')?.getChildByName('World_1x');if(world)world.setScale(value,value,1)};
  window.qaInfo=()=>{const s=cc.director.getScene();const root=s.getChildByName('Canvas');const nodes=[root,...root.children,...root.getChildByName('SafeArea').children];const camera=root.getComponent(cc.Canvas).cameraComponent;function bounds(n){const tr=n.getComponent(cc.UITransform);if(!tr)return null;const a=tr.anchorPoint,z=tr.contentSize;const points=[[0,0],[z.width,0],[0,z.height],[z.width,z.height]].map(([x,y])=>camera.worldToScreen(tr.convertToWorldSpaceAR(new cc.Vec3(x-z.width*a.x,y-z.height*a.y,0))));return {x:Math.min(...points.map(p=>p.x)),y:Math.min(...points.map(p=>p.y)),right:Math.max(...points.map(p=>p.x)),top:Math.max(...points.map(p=>p.y))}}return {scene:s.name,engine:cc.VERSION,design:cc.view.getDesignResolutionSize(),visible:cc.view.getVisibleSize(),canvas:[cc.game.canvas.width,cc.game.canvas.height],screen:cc.screen.windowSize,nodes:nodes.map(n=>({name:n.name,bounds:bounds(n),scale:n.scale,position:n.position,size:n.getComponent(cc.UITransform)?.contentSize,anchor:n.getComponent(cc.UITransform)?.anchorPoint,camera:n.getComponent(cc.Camera)?.orthoHeight}))}};
  parent.postMessage({type:'cocos-ready',info:window.qaInfo()},location.origin);
 }catch(error){parent.postMessage({type:'cocos-error',error:String(error)},location.origin)}
})();
</script></body>''')
(ROOT/'preparation/review/engine-player.html').write_text(player)
(ROOT/'preparation/review/engine.html').write_text('''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Batch 0 · Cocos 实际构建验收</title>
<style>body{margin:0;background:#edf3f8;font:15px/1.7 system-ui;color:#173047}header{padding:20px}h1{font-size:24px;margin:0}p{margin:5px 0}.controls{display:flex;flex-wrap:wrap;gap:14px;margin-top:16px}select,button{font:inherit;padding:5px}main{display:flex;justify-content:center;padding-bottom:25px}iframe{border:0;box-shadow:0 3px 24px #20364d33}#status{color:#2c6e52}a{color:#197bc1}</style>
<header><h1>Batch 0 · Cocos 实际构建验收</h1><p>使用 Creator 3.8.8 实际 Web 构建。仅静态场景；按钮和高度是样例，尚无游戏玩法。</p><div class="controls"><label>场景 <select id="scene" disabled><option>Home</option><option>HUD</option><option>Settings</option><option>Result</option></select></label><label>画幅 <select id="ratio"><option value="375,667">9:16 · 375×667</option><option value="375,812">长屏 · 375×812</option><option value="600,800">3:4 · 600×800</option></select></label><label><input type="checkbox" id="zoom" disabled> HUD 世界 0.75</label><button id="inspect">读取布局数据</button><span id="status">引擎加载中…</span></div><p>切换画幅会重新启动场景，以验证不同设备初始尺寸。这里验证真实图片、字体、锚点和场景加载；浏览器没有刘海/微信胶囊，不代替真机安全区。<a href="layout.html">构图参考</a> · <a href="index.html#audio">音频候选试听</a></p></header>
<details><summary>布局诊断</summary><pre id="diagnostics"></pre></details><main><iframe id="player" title="Cocos 静态场景" src="engine-player.html" width="375" height="667"></iframe></main>
<script>
const frame=document.querySelector('#player'),scene=document.querySelector('#scene'),status=document.querySelector('#status'),zoom=document.querySelector('#zoom');
function info(){const i=frame.contentWindow.qaInfo();status.textContent=`${i.scene} · Cocos ${i.engine} · 已载入`}
window.addEventListener('message',async e=>{if(e.origin!==location.origin||e.source!==frame.contentWindow)return;if(e.data.type==='cocos-ready'){if(scene.value!=='Home')await frame.contentWindow.qaLoad(scene.value);frame.contentWindow.qaZoom(zoom.checked?.75:1);scene.disabled=false;zoom.disabled=false;info()}else if(e.data.type==='cocos-error')status.textContent=e.data.error});
scene.onchange=async()=>{scene.disabled=true;status.textContent='场景切换中…';try{await frame.contentWindow.qaLoad(scene.value);frame.contentWindow.qaZoom(zoom.checked?.75:1);info()}catch(e){status.textContent=String(e)}finally{scene.disabled=false}};
zoom.onchange=()=>frame.contentWindow.qaZoom(zoom.checked?.75:1);
document.querySelector('#inspect').onclick=()=>{document.querySelector('#diagnostics').textContent=JSON.stringify(frame.contentWindow.qaInfo(),null,2);document.querySelector('details').open=true};
document.querySelector('#ratio').onchange=e=>{const [w,h]=e.target.value.split(',');scene.disabled=true;zoom.disabled=true;status.textContent='按新画幅重新载入…';frame.width=w;frame.height=h;frame.src='engine-player.html?size='+encodeURIComponent(e.target.value)};
</script></html>''')
print('Actual-engine review shell generated; build output unchanged')
