# Result UI 修复实施记录

本批由用户“完成 ui 的修复”授权，依据原 UI 第 2 屏与 `result-audit-r1/REVIEW.md` 的最小方案。只改 Result 场景、现有场景操作分支及新增的 Result 表现组件；不改变物理、难度、成绩判定、释放计时或其他场景配置。

## 构图和数据

- 以认可的 R10 首页背景、Logo 与 R9 角色等组成完整底景，再统一压暗；装饰不是本局塔截图。
- 中央为 642 × 560 的紧凑正式九宫格面板，微斜白贴纸标题“本次叠到了”、左侧真实高度、右侧角色和少量彩纸。
- 高度以 `runResult.height` 为唯一来源，四层 Arial bold italic Label 共用同一字符串，组合倾斜 5°，提供深蓝厚度、亮蓝轮廓和黄色顶光。0 与长数字均保留实际值并缩小字号。
- 正式重开按钮位于卡内底部；右上关闭按钮返回现有 Home。未实现的新纪录、技术分、排名、分享和死因字段不显示。
- 白贴纸、蓝 X 关闭和彩纸使用本批生成的独立正式候选 PNG；原历史 UI 图不进入运行资源。

## 最小复杂度

保留独立 Result 场景；`scene-actions.ts` 仅绑定真实的重开/关闭操作并保留原结束音。新增 `ResultPresentation.ts` 独立负责此页适配、字形层次和 0.24 秒短入场。复用首页已认可的摆放公式及轻云运动，后台暂停视觉时间。没有截图管线、成绩动画等待、通用弹窗框架、跨场景塔重建或新状态系统。

场景同步仅使用 `preparation/tools/repair_result_scene.py`；它从本批保存的 Result 序列化模板重建此单场景，不调用已停用的全场景生成器。资源必须存在后才能执行，不输出缺图占位。

## 供引擎 QA 使用

- `Canvas.getComponent('ResultPresentation').setHeight(value)`：只用于数字边界检查；生产 `onLoad` 读取真实 `runResult.height`。
- 重开：`Canvas/SafeArea/Content_1230/ResultCard/result_btn_retry` → HUD。
- 关闭：`Canvas/SafeArea/Content_1230/ResultCard/result_btn_close` → Home。
- 四个高度节点位于 `ResultCard/HeightTreatment`：`HeightDepth`、`HeightRim`、`HeightHighlight`、`Text:88.6 m`，字符串必须相同。
- 关闭为独立 104 × 104 触区与内部 84 × 84 的 `CloseVisual`，按下仅缩放图片，保留命中范围。重开已换为 R11 黄色胶囊/红三角候选，460 × 197.29，顶 355、底 552.29，在卡内完整显示。
- 检查 375 × 667、390 × 844、600 × 800；0 / 42.7 / 12345.6；安全区、改变尺寸、暂停恢复、真实结束→重开和关闭通路。
- 首页底景无可点击按钮；Card 的入口在完整入场之前就可使用，动画不锁定重开。

当前静态 TypeScript 检查通过。最终引擎构建、截图和交互检查由主代理统一完成；这份实施记录本身不证明最终视觉还原或真机验收。
