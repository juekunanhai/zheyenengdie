"""Readable review of actual Cocos captures; no simulated gameplay on this page."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
evidence = 'evidence/batch1a/'
pixels = json.loads((ROOT / 'review' / evidence / 'CONTACT_PIXELS.json').read_text())
cards = [
    ('平台修正前', 'evidence/batch1a-before-adhesion/14-tower-1-boxes.png', '上一版首件落地画面；可见台面位置偏后。'),
    ('平台修正后', evidence + '17-platform-contact.png', '首件底部对应木质台面中心；承台物理宽度与高度零点不变。'),
    ('第五件居中落下', evidence + '18-five-drops-0.png', '球的下方支撑与球顶新物体均在真实接触后粘连。'),
    ('第五件稍偏左', evidence + '18-five-drops--15.png', '向左偏 15 世界单位（纸箱宽度的 15%）的定向试验。'),
    ('第五件稍偏右', evidence + '18-five-drops-15.png', '向右偏 15 世界单位的定向试验；图中保留实际落点和倾角。'),
    ('正常触摸流程的第五件', evidence + '19-live-five-landings.png', '通过当前游戏控制器的真实松手释放；未替换物理或预置塔。'),
]
gallery = ''.join(f'<article><h3>{title}</h3><img src="{src}" alt="{title}" loading="lazy"><p>{note}</p></article>'
                  for title, src, note in cards)
page = f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>这也能叠 · 平台与双面胶修正</title>
<style>body{{margin:0;background:#edf3f8;color:#173047;font:15px/1.75 system-ui}}main{{max-width:1120px;margin:auto;padding:24px}}h1{{font-size:26px;margin:0}}h2{{font-size:21px}}h3{{font-size:17px;margin:0 0 12px}}a{{color:#0673bf}}.lead,article{{background:white;border-radius:16px;padding:20px}}.grid{{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}}img{{display:block;width:100%;height:auto;border-radius:10px}}video{{display:block;width:375px;max-width:100%;margin:auto;border-radius:12px}}.links{{display:flex;gap:20px;flex-wrap:wrap}}p{{margin:10px 0}}@media(max-width:800px){{.grid{{grid-template-columns:repeat(2,minmax(0,1fr))}}}}@media(max-width:500px){{.grid{{grid-template-columns:1fr}}main{{padding:14px}}}}</style>
<main><h1>平台与双面胶修正</h1><p>2026-09-13 · Batch 1A · adhesion-r2 · 实际 Cocos 3.8.8 构建</p>
<div class="lead"><p>首件与木质台面对齐。篮球上下两面在实际接触后形成粘连，胶层缓冲新物体砸落；侧面擦碰不粘，明显拉开时释放，粘连的一段塔仍可整体倾倒或下坠。</p>
<p>物品介绍：“别担心，有人给它贴了双面胶。”已保存在物品数据，介绍界面留在原定批次。当前仍是四物体校准；指定组合与轻微偏心通过，不代表任意落点、长局或手机真机通过。</p>
<div class="links"><a href="play.html?revision=20260913-adhesion-r2">进入修正版试玩</a><a href="../docs/BATCH1A_ACCEPTANCE.md">验收记录</a><a href="{evidence}ADHESION.json">平台与粘连实测</a></div></div>
<h2>连续五件：看第五件砸到篮球后</h2><p>实际引擎定向投放纸箱→木板→冰箱→篮球→纸箱，沿用正常释放高度。镜头跟随确认塔高，已落地物体保持动态刚体。</p>
<video controls playsinline preload="metadata" poster="{evidence}18-five-drops-0.png" src="{evidence}adhesion-five-drops.mp4"></video>
<h2>平台与落点对照</h2><div class="grid">{gallery}</div>
<details><summary>镜头与物体接触回归</summary>
<p>塔、承台和地面共享镜头位移，远景使用视差。四物体抽样 {pixels['contact_samples']} 个接触点，距实体像素的最大距离约 {pixels['max_distance_css_pixels_at_375x667']:.2f} 像素（375×667）；平台台面对齐已另行补测，此数字不能替代画面验收。</p>
<p>下面为六箱定向投放，便于观察地面离开视野与镜头上升；正常试玩仍用四物体循环。</p>
<video controls playsinline preload="metadata" poster="{evidence}14-tower-1-boxes.png" src="{evidence}camera-rise.mp4"></video></details>
<p>本轮仍在 1A 修正范围。正式事故、三星扣除、倒塌镜头与深层辅助继续留在 1B；手机真机效果另行验收。</p></main></html>'''
(ROOT / 'review/contact-review.html').write_text(page)
print('Contact review built from actual engine evidence.')
