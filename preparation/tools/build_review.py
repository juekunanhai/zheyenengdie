"""Build an offline review page. No game logic, network calls or approval writes."""
from pathlib import Path
import json, base64, html
ROOT=Path(__file__).resolve().parents[1]
art=json.loads((ROOT/'art/CANDIDATE_MANIFEST.json').read_text())
audio=json.loads((ROOT/'audio/AUDIO_MANIFEST.json').read_text())
edges={r['id']:r for r in json.loads((ROOT/'art/EDGE_CANDIDATE_MANIFEST.json').read_text())['entries']}
encoded={r['id']:r for r in json.loads((ROOT/'audio/ENCODED_MANIFEST.json').read_text())['entries']}
corrections={}
for filename in ['UI_CORRECTION_MANIFEST.json','BACKGROUND_CORRECTION_MANIFEST.json']:
    corrections.update({r['id']:r for r in json.loads((ROOT/'art'/filename).read_text())['entries']})
rows=[]
for r in art['entries']:
    src=Path(art['source_root'])/'02_ASSETS'/r['source']
    r=dict(r)
    if r['id'] in edges:
        e=edges[r['id']];r.update(output=e['output'],quality='visual_accepted',note=e['notes'])
        if 'next_output' in e:r['next_output']=e['next_output']
    if r['id'] in corrections:
        c=corrections[r['id']];r.update(output=c['output'],quality='corrected_pending_review',note=c.get('note',c.get('method','用户反馈修正')))
    rows.append(dict(r,original='data:image/png;base64,'+base64.b64encode(src.read_bytes()).decode()))
payload=json.dumps(rows,ensure_ascii=False).replace('</','<\\/')
sounds=json.dumps([dict(r,preview_file=encoded[r['id']]['file']) for r in audio['entries']],ensure_ascii=False).replace('</','<\\/')
page='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>这也能叠 · 开发准备审阅</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f2f5f7;color:#173047;font:15px/1.65 system-ui,-apple-system,sans-serif}header{padding:44px max(24px,calc((100vw - 1240px)/2));background:#102b45;color:white}h1{margin:8px 0;font-size:32px;line-height:1.3}h2{font-size:23px;margin:36px 0 12px}h3{margin:0 0 9px;font-size:16px}p{margin:8px 0}small,.muted{color:#61778a}.eyebrow{color:#9bcbe8;letter-spacing:2px}nav{display:flex;gap:24px;margin-top:22px;flex-wrap:wrap}nav a{color:#d7eeff}main{max-width:1288px;padding:0 24px 70px;margin:auto}.notice{padding:16px 20px;border-left:4px solid #db8d21;background:#fff7e7;margin:24px 0}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:24px 0}.stat{background:white;padding:20px;border-radius:12px}.stat b{display:block;font-size:25px}.previews{display:flex;gap:28px;flex-wrap:wrap;align-items:start}.phone{position:relative;width:375px;height:667px;overflow:hidden;border-radius:24px;background:#70cef9;box-shadow:0 5px 24px #17304720}.phone img{position:absolute;object-fit:contain}.sky{inset:0;width:100%;height:100%;object-fit:cover!important}.world{position:absolute;inset:0;transform-origin:50% 64%;transition:transform .35s ease}.hud{position:absolute;inset:0;pointer-events:none}.label{position:absolute;text-align:center;color:#fff;font-weight:800;text-shadow:0 1px 2px #114575}.caption{max-width:375px;margin:10px 0;color:#61778a}button,select{font:inherit;padding:8px 14px;border:1px solid #b7c7d3;background:white;border-radius:8px;color:#173047;cursor:pointer}button[aria-pressed=true]{background:#173047;color:white}.toolbar{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:16px 0}.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.card{padding:16px;background:white;border-radius:12px;overflow:hidden}.pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}.imagebox{height:175px;display:flex;align-items:center;justify-content:center;background-color:#d3e4ef;background-image:linear-gradient(45deg,#c3d7e5 25%,transparent 25%,transparent 75%,#c3d7e5 75%),linear-gradient(45deg,#c3d7e5 25%,transparent 25%,transparent 75%,#c3d7e5 75%);background-size:20px 20px;background-position:0 0,10px 10px;border-radius:7px}.imagebox img{max-width:96%;max-height:96%;object-fit:contain}.tag{display:inline-block;border-radius:5px;background:#e7f4ec;color:#225d39;padding:2px 7px;font-size:12px}.tag.bad{background:#fde9e3;color:#9c3325}.tag.wait{background:#fff3d6;color:#84621e}code{font-size:12px;overflow-wrap:anywhere}.audio-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}audio{width:100%;margin-top:12px}table{border-collapse:collapse;width:100%;background:white}td,th{padding:14px;text-align:left;border-bottom:1px solid #dae3e9}footer{margin-top:35px;color:#61778a}@media(max-width:850px){.cards,.audio-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.stats{grid-template-columns:repeat(2,1fr)}}@media(max-width:540px){h1{font-size:27px}.cards,.audio-grid{grid-template-columns:1fr}main{padding:0 14px 40px}.phone{transform-origin:top left;max-width:100%}.stats{gap:8px}.stat{padding:14px}}
</style>
<header><div class="eyebrow">PREPARATION / 2026-09-12-P2</div><h1>这也能叠 · 开发准备审阅</h1><p>正式来源本地处理 · 原图不改动 · 候选可追溯</p><nav><a href="#composition">组合检查</a><a href="#art">素材对照</a><a href="#audio">音频试听</a><a href="#gate">开发门禁</a></nav></header>
<main><div class="notice"><b>这是准备阶段的审阅页，不是游戏。</b> 本页没有物理、交互玩法或真实成绩。主体缺边的候选不会因清理了残片而自动合格；静态组合不替代引擎和真机验收。</div>
<div class="stats"><div class="stat"><b>53 + 12</b>组件候选 + NEXT 轮廓</div><div class="stat"><b>41</b>原创音频候选</div><div class="stat"><b>12</b>首批物体逐项记录</div><div class="stat"><b>0</b>原图修改 / 文件上传</div></div>
<h2 id="composition">静态构图与采用记录</h2><p>已建立首页、HUD、设置、结算四个原生静态场景。<a href="layout.html">打开三种画幅构图核对页</a> · <a href="edge-review.html">查看本轮已接受的 12 项修复与设置组件</a>。</p><p class="muted">这些场景没有玩法。浏览器图只解释场景数据；Creator 已登录，四场景 Web 构建已成功；<a href="engine.html">打开实际引擎验收页</a>。首批四物体采用纸箱、木板、篮球、冰箱；后续四项缺边另列，不混为已批准。</p>
<h2 id="art">素材前后对照</h2><p>左侧为原图，右侧为本地候选。点击图片可打开原尺寸。右侧优先展示本轮已接受修复；未修复项目继续保留缺陷标记。</p>
<div class="toolbar"><select id="category" aria-label="筛选素材分类"><option value="all">全部分类</option></select><label><input id="blocked" type="checkbox"> 仅看主体缺失</label><span id="count" class="muted"></span></div><div id="cards" class="cards"></div>
<h2 id="audio">音频试听</h2><p>三套 120 BPM、32 秒同主题编配。请先试听音乐，再对比不同材质。文件通过指标检查仍不等于听感通过；手机扬声器、循环和后台恢复需要 Batch 1 验收。</p><p class="muted">播放一个会暂停其他声音；默认审阅音量 35%。此页试听 MP3 编码候选（合计约 1.82 MB），每项保留 WAV 母版链接。音乐及短音效均为本地合成，无第三方采样。</p><div id="music" class="audio-grid"></div><details><summary>展开材质与事件音效</summary><div id="sfx" class="audio-grid"></div></details>
<h2 id="gate">开发门禁</h2><table><thead><tr><th>项目</th><th>当前结论</th></tr></thead><tbody><tr><td>产品规则 / 批次</td><td>2026-09-12-R1 已同步；本次安装与最小配置另获授权，未实现 Batch 1。</td></tr><tr><td>核心物体</td><td>首批纸箱、木板、篮球、冰箱已具备静态校准图片；沙发、马桶、哑铃、鲸鱼仍需完成后续修复。</td></tr><tr><td>抓手 / HUD / 面板</td><td>中/窄爪、旋转按钮、面板、设置开关修复已接受；挂牌边缘待引擎尺寸下复核。</td></tr><tr><td>音频</td><td>有真实可试听文件；均待用户听感确认，未进入游戏。</td></tr><tr><td>引擎 / 构建</td><td>Creator 3.8.8 已恢复登录；四场景 Web 调试构建成功，真机和玩法未验证。</td></tr></tbody></table><footer>追溯：art/CANDIDATE_MANIFEST.json · art/recipes.json · audio/AUDIO_MANIFEST.json。复现脚本位于 tools/，所有内容仅在本地。</footer></main>
<script>
const art=__ART__,sounds=__SOUNDS__;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const byId=Object.fromEntries(art.map(r=>[r.id,r]));
for(const group of new Set(art.map(r=>r.group))){let o=new Option(group,group);document.querySelector('#category').add(o)}
function render(){const group=document.querySelector('#category').value,bad=document.querySelector('#blocked').checked;const rows=art.filter(r=>(group==='all'||r.group===group)&&(!bad||r.quality==='source_incomplete'));document.querySelector('#count').textContent=rows.length+' 项';document.querySelector('#cards').innerHTML=rows.map(r=>`<article class="card"><h3>${esc(r.id)}</h3><span class="tag ${r.quality==='source_incomplete'?'bad':r.quality==='isolated'?'':'wait'}">${r.quality==='visual_accepted'?'视觉已接受 · 引擎待验收':r.quality==='source_incomplete'?'阻塞：主体缺边':r.quality==='isolated'?'独立候选 · 待接入验收':'候选 · 仍需边缘/组合复核'}</span><div class="pair"><div><small>原图</small><a href="${r.original}" target="_blank"><div class="imagebox"><img src="${r.original}" alt="原图 ${esc(r.id)}"></div></a></div><div><small>候选</small><a href="../${r.output}" target="_blank"><div class="imagebox"><img src="../${r.output}" alt="候选 ${esc(r.id)}"></div></a></div></div><p>${esc(r.note||'邻图残片清理 / 独立组件提取；尚未标正式 approved。')}</p><code>02_ASSETS/${esc(r.source)}</code>${r.next_output?`<details><summary>NEXT 纯轮廓（继承主体质量状态）</summary><div class="imagebox"><img src="../${r.next_output}" alt="NEXT ${esc(r.id)}"></div></details>`:''}</article>`).join('')}
document.querySelector('#category').onchange=render;document.querySelector('#blocked').onchange=render;render();
for(const s of sounds){const box=document.createElement('article');box.className='card';box.innerHTML=`<h3>${esc(s.id)}</h3><p>${esc(s.purpose)}</p><small>${s.duration_s}s · ${s.peak_dbfs} dBFS peak · 待试听</small><audio controls preload="none" src="../${s.preview_file}"></audio><a href="../${s.file}" target="_blank">WAV 母版</a>`;document.querySelector(s.loop?'#music':'#sfx').append(box)}
for(const a of document.querySelectorAll('audio')){a.volume=.35;a.addEventListener('play',()=>document.querySelectorAll('audio').forEach(b=>{if(a!==b)b.pause()}))}document.addEventListener('visibilitychange',()=>{if(document.hidden)document.querySelectorAll('audio').forEach(a=>a.pause())});
</script></html>'''
(ROOT/'review/index.html').write_text(page.replace('__ART__',payload).replace('__SOUNDS__',sounds))
print('review/index.html built')
