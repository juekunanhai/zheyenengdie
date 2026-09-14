# 这也能叠正式美术素材包

文档修订：2026-09-12-R2。02_ASSETS 是正式原始素材来源；现有正式素材优先，用户已接受的本地修复和必要补图按工程导入清单及批准记录采用。原 PNG 和物理比例文件保持原值，来源指定不等于全包已通过验收。

## 阅读顺序与规则来源

先读本 README、ASSET_MANIFEST.json、OBJECT_GAMEPLAY_SCALE.json、FINAL_UI_COMPOSITION_RULES.json、CLAW_RUNTIME_RULES.json。产品规则以 [当前 SPEC](../../../docs/zhynd_codex_handoff/SPEC.md) 和用户明确确认为准；两份 Word 与 SPEC 正文同步。

00_DOCS 保存现行说明及标明范围的历史证据。01_VISUAL_REFERENCE 只解释整体风格，历史功能和布局不得覆盖当前 R6 规则。02_ASSETS 原始 PNG 保留；不能从历史展板抠取正式图。

## 当前工程与追溯

工程：/Users/admin/Desktop/douchao/my-project/wechatgames/die。R6 静态工程已有 4 场景、47 导入图、50 Sprite、1 表现组件、0 玩法脚本。Batch 1A 已授权但开发暂停；本轮只收尾资料。

- preparation/art/BATCH0_IMPORT_MANIFEST.json 记录实际采用文件；修复配方、源哈希与批准哈希位于同目录其他 Manifest 和 USER_VISUAL_APPROVAL.json。
- preparation/docs/VISUAL_R6.md 记录当前视觉与既有引擎验收，READINESS.md 记录后续工作。
- ASSET_MANIFEST 的逐项 source_status/status/engineering_review 描述未改动的原始文件，不自动继承派生修复的批准。原图被标 blocked 不代表同款已修复版本仍阻塞。
- 首批纸箱/木板/篮球/冰箱和基础 UI 可进入 1A 校准。沙发/马桶/哑铃/鲸鱼在 1C 前修复签收；图鉴/排行专用资源按后批补齐，当前不显示无效入口。
- 41 WAV 母版和 41 MP3 候选位于工程 preparation/audio；声音有文件、未试听批准，不再描述为“尚无音频”。

## 当前视觉与交互

1. 保持蓝黄玩具塑料与白蓝面板。高度贴左上安全区顶部，三星在其下左侧；右上暂停、下方右侧 NEXT，无独立城市挂牌。
2. 短抓手从上沿进入，无可见横向长导轨。待放物为独立 Sprite，三态挂点与 90° 旋转间隙在 1A 实测。
3. 左下两道具槽竖排，动态图标和数量角标保持正向；右下唯一技能为旋转 90°。轻触/拖动物体松手释放，UI 不误触释放；首局前两件免自动释放，物理继续。
4. 物体直接叠放，不自动加入木板垫层；木板仍可作为物体。新局只有地面承台与待放物，无预置塔；首页可展示装饰塔。
5. 背景覆盖整个 Canvas，从地面街区随当前视区高度过渡至城市上空、云层、太空，不绑定历史最高分。倒塌只缩放世界，HUD 与逻辑判定边界不随演出改变。
6. NEXT 只显示已锁定纯轮廓；框、星星、数值、图标均独立组合。不得用烤死示例作为真实状态。
7. PNG 像素不决定物理尺寸，OBJECT_GAMEPLAY_SCALE 保持冻结原值。1u=100 世界单位=1 显示米；承台与释放首轮口径见 SPEC 第 2.2 节，几何候选不是物理验收。
8. 禁止金币、等级、关卡、今日挑战、VIP、商城、宝箱、战斗、猫咪 UI 漂移及其他排除功能。SPEC 中的物体“猫窝”不是 UI 漂移。

## 批次与证据边界

1A 从四物体、基础全塔模拟、操作和基础音效开始；1B 完善事故、三星/数量倒塌、镜头和深层辅助；1C 完成十二物体与完整基础音画。平台窄接口在首次调用时实现，不预建全部 SDK。

音频先按 1A 子集试听，再 1B 事故、1C 主题音乐与剩余材质。未经批准不作为正式游戏声音；文件检查不能替代听感、循环、后台恢复与真机表现。

PACKAGE_VERIFY、FINAL_ASSET_AUDIT、FINAL_QA_SUMMARY、FINAL_QA_DUPLICATES、QA_PROMOTION 和 SPLIT_MANIFEST 保留原包历史标签；其 PASS/READY 不是现行全包通过证明，也不能覆盖当前导入 Manifest。
