from pathlib import Path
from PIL import Image
import json
ROOT=Path(__file__).resolve().parents[3]
art=ROOT/'assets/batch0/art'

def img(name,x,y,w,h=None,cls=''):
    iw,ih=Image.open(art/(name+'.png')).size
    h=h or w*ih/iw
    return f'<img class="sprite {cls}" src="../../assets/batch0/art/{name}.png" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px" alt="{name}">'

def screen(stage,bg,height,tower=False):
    ui=img(bg,0,0,750,1334,'bg')
    if not tower:
        ui+=img('platform_city_base',235,974,280)
    else:
        # Illustration of a continuing tower, not a new floating platform.
        ui+=img('object_wood_plank',245,1307,260)
        ui+=img('object_cardboard_box',283,1146,184)
        ui+=img('object_wood_plank',231,1080,288)
        ui+=img('object_fridge',292,860,166)
        ui+=img('object_wood_plank',223,804,304)
        ui+=img('object_ice_block',304,662,142)
    # Short suspended claw: the horizontal trolley is above the visible viewport.
    ui+=img('object_cardboard_box',283,152,184)
    ui+=img('claw_cable_straight',369,-9,12)
    ui+=img('claw_open_narrow',311,52,128)
    ui+=img('hud_height_sign',22,0,240)
    ui+=f'<span class="height" style="left:99px;top:62px;width:115px;height:50px">{height}</span>'
    for i in range(3):ui+=img('hud_star_full',43+i*58,148,46)
    ui+=img('hud_pause',640,16,88)
    ui+=img('hud_next_frame',616,155,112)
    ui+=img('next_basketball',641,237,62)
    ui+=img('itembar_empty',20,1145,308)
    ui+=img('hud_rotate_90',504,1098,234)
    return f'<section class="state"><h2>{stage}</h2><div class="frame"><div class="game">{ui}</div></div></section>'
html='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>这也能叠 · 整体布局审核稿 R6</title><style>
*{box-sizing:border-box}body{margin:0;color:#163856;background:#eaf1f7;font:16px/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}.board{width:1200px;margin:0 auto;padding:26px 32px 30px;background:#f4f8fb}.eyebrow{font-size:14px;color:#456c8b;letter-spacing:2px}h1{font-size:30px;margin:4px 0 8px;color:#153b61}header p{margin:0;color:#557187}.status{float:right;background:#fff0c8;color:#74520b;border-radius:8px;padding:6px 14px;font-size:14px}.states{display:flex;gap:28px;margin-top:16px}.state{width:360px}h2{font-size:17px;margin:0 0 10px}.frame{width:360px;height:640.32px;position:relative;overflow:hidden;border-radius:16px;box-shadow:0 4px 16px #14365320}.game{position:relative;width:750px;height:1334px;transform:scale(.48);transform-origin:0 0;overflow:hidden;background:#76c8f4}.sprite{position:absolute;object-fit:contain}.bg{object-fit:cover;object-position:center bottom}.height{position:absolute;display:flex;align-items:center;justify-content:center;color:white;font-size:37px;line-height:1;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-1px}.notes{display:grid;grid-template-columns:repeat(3,1fr);gap:28px;margin-top:19px}.notes article{border-top:3px solid #7eb9e6;padding-top:8px}.notes h3{font-size:17px;margin:0 0 4px}.notes p{font-size:14px;line-height:1.6;color:#48677e;margin:0}footer{font-size:13px;color:#647e90;border-top:1px solid #d4e2ed;padding-top:12px;margin-top:17px}a{color:#126dba}.audit{width:1200px;margin:auto;padding:16px 32px;background:#eaf1f7}.audit p{margin:6px 0}.audit img{max-width:600px;width:100%} @media print{.audit{display:none}}
</style><main class="board"><header><span class="status">待你审核 · 未写入工程</span><div class="eyebrow">这也能叠 / 游戏过程 / R6</div><h1>短抓手，顶部成绩，完整的下落空间</h1><p>正式素材组合稿 · 750 × 1334 设计坐标 · 同一套 HUD 随高度保持位置</p></header><div class="states">'''
html+=screen('01 / 地面开局','bg_ground_city','0.0')+screen('02 / 云层示例','bg_cloud_altitude','100.0',True)+screen('03 / 太空示例','bg_space_altitude','220.0',True)
html+='''</div><div class="notes"><article><h3>① 高度在顶部，三星移到左侧</h3><p>高度牌紧贴安全区上沿；三星排在高度牌下方，作为剩余容错信息。右侧是暂停与 NEXT，不出现独立城市挂牌。</p></article><article><h3>② 抓手缩短，导轨收在屏幕外</h3><p>复用正式爪体与索缆；短索从上沿进入。爪体约占屏高 11%，待放物底部约在屏高 25%，不再横跨画面摆导轨。</p></article><article><h3>③ 从地面叠起，背景随高度变化</h3><p>开局承台落在地面，没有预置塔。升高后塔从画面下沿延续，不生成悬空承台；底部双槽与右侧旋转保持。</p></article></div><footer>审核范围：游戏过程整体构图。背景沿用当前候选，未新增或重画已有素材。高空塔段及数值仅示意；顶部以设备安全区为起点，微信胶囊与真机触达仍需后续适配。图中没有实际交互。</footer></main><details class="audit"><summary>查看本轮现状审查与尺寸说明</summary><p>步骤 1：当前 Cocos 地面 HUD — 未达到视觉还原。横向导轨与长组合占据上半屏；高度和生命信息缺少稳定分组。截图仅证明显示情况，不证明视觉签收、触达或运动舒适度。</p><img src="../design/R6/01-current.png" alt="本轮实际引擎现状"><p>步骤 2：R6 整体审核稿 — 待审核。原生高度牌 (22,0), 宽 240；三星首颗 (43,148), 宽46，间隔12；短索 (369,-9), 宽12；爪体 (311,52), 宽128；纸箱 (283,152), 宽184；暂停 (640,16), 宽88；NEXT (616,155), 宽112。正式图按自然比例放置。页面图片像素不作为物理尺寸。</p><p>最小方案：仅调整场景节点的位置与显示范围，复用现有 PNG。没有必要新建美术系统或布局框架。审核通过前不修改工程。</p><p><a href="engine.html">查看现有引擎画面</a> · <a href="../design/R6/REVIEW.md">审核说明</a></p></details></html>'''
(ROOT/'preparation/review/proposal-r6.html').write_text(html)
(ROOT/'preparation/design/R6/REVIEW.md').write_text('''# R6 游戏过程整体布局审核稿

状态：待用户审核，不是视觉还原通过记录。本轮不修改 assets、Cocos 场景、运行时代码、工程配置或构建。

1. 本轮当前引擎截图：01-current.png。视觉未通过，问题为横轨及抓手组合占高过多，顶部高度与生命分组不清楚。构建成功与不重叠不是还原验收。
2. 审核稿：../../review/proposal-r6.html。地面/云层/太空共用一套 HUD；高空塔为示例，不是实际游戏进度。

## 最小方案

以 750×1334 为设计坐标：高度牌 (22,0), w240；三星起点 (43,148), w46，步长58；短索 (369,-9), w12；爪体 (311,52), w128；纸箱 (283,152), w184；暂停 (640,16), w88；NEXT (616,155), w112。高度牌上沿相对安全区，不覆盖系统状态栏。三星移至高度牌下方，移出抓手活动通道。横向导轨及滑座位于屏幕上方，屏内只显示短索、爪体、独立物体。

复用正式素材，沿用候选背景，只生成独立审核 HTML 及其截图，不生成新 UI 资产。没有必要引入更复杂方案。审核确认后再将坐标映射到 Cocos；运行时抓取挂点、短屏下落距离和真实高度相机仍需按批次校准。

## 参考与边界

抓手依据 06_object_entry_claw.png 的短入场组合；顶部保留 05_hud_reference.png 左右信息分布，按用户本轮指示将高度置顶、三星换位。正式 02_ASSETS 优先，历史图不抠图。原图不是最终统一设计标注，因此不声称像素级还原。

地面开局无预置塔，承台留在地面。高空只展示持续塔段，不迁移塔底。独立城市挂牌已排除，城市背景保留。星星仍代表已确认的三次事故容错，不恢复历史爱心规则。

审核项：高度位置；三星新位置；抓手长度与不显示横轨的表现；NEXT 位置；地面及高空整体留白。按钮图形尺寸不等于触摸热区；暂停拟至少44逻辑点，微信胶囊和安全区仍待真机。静态稿不验证交互或运动舒适性。
''')
print('proposal only; assets and runtime unchanged')
