# 本轮真实结果指标接入

2026-09-16。依照用户“暂不构建，继续执行下一步开发任务”执行；本专项未启动 Creator、浏览器、项目或构建。

## 最小方案与复杂度判断

复用既有 `runResult`、`ResultPresentation`、R13 结果卡构图；在原数据区创建一个原生浅白圆角面板与四个 Label。结果页只读取本轮锁定快照的技术分和 `highlights.narrow_escape` 次数，不负责重新计算得分。既有结果对象、场景生命周期和 Cocos 文本足以满足此项需求，无需新状态层、通用组件、图集、场景或配置。

静态查看了已批准 R13 完整稿、历史真实引擎卡片及 `preparation/design/result-r13/assets/result_metrics.png`。后者虽然没有数字，但仍烤有“超过了 / 的玩家”，所以没有引入。当前数据区使用 Graphics 白板与真实文本；原百分位区域改为“惊险稳住”，未加入新纪录、玩家比例、分享或示例 2680 / 92%。

| Before | After |
| --- | --- |
| `object-data.ts` 的 `runResult` 仅存高度、件数与结束原因 | 新增默认值为 0 的 `technicalScore`，以及 `narrow_escape`、`edge_balance`、`bridge`、`large_rescue` 四项次数 |
| `ResultPresentation.ts` 的 R13 数据区留白 | 在原 18,189,209,70 构图区显示“本次技术分”和“惊险稳住”，读取真实快照；真实零值保留 |
| 没有结果指标排版 | 两列居中、固定区域、单行 SHRINK；指标置于歪塔上层与重试控件下层，数据板不接受触摸 |

## 检查与边界

运行 `node preparation/tools/check_result_metrics.cjs` 通过 255 个断言：真实生产 TS 转译和真实 Result.scene 配合小型 cc mock，覆盖零值、非零值、长数值、负值/非有限值防护、小数归整；验证惊险次数不混入其他三类高光、原高度字形仍读取真实高度、数据区不引入交互控件或虚构百分位。

按 375×667、300×650、450×600、375×812 四种画幅和后两种对应安全区模拟检查，数据区均在安全区内且不侵入重试触区。证据见 `RESULT_METRICS_CHECK.json`。

这些是静态/纯逻辑检查，不证明实际中文字体、SHRINK 栅格效果、GPU 渲染、引擎绘制层级或微信真机观感；旧构建仍为旧版。R13 高度、按钮、关闭、歪塔的既有图片和 Result.scene 未修改。物理高光计分与失败锁定链路由本轮主专项覆盖。
