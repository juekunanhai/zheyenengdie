# R10.1 首页工程接入

用户认可 R10.1 并要求执行下一步开发；确认原文与稿件哈希见 [APPROVAL.json](APPROVAL.json)。本轮完成 Home 接入，仍是视觉基础收尾，没有加入未开发首页入口或排除功能。

## 实现与最小方案

- 新导入 4 张图片：城市背景、完整 Logo 与弧形标语、飞艇、飞机。保持来源 PNG 字节，清单见 [HOME_R10_IMPORT_MANIFEST.json](../../art/HOME_R10_IMPORT_MANIFEST.json)。R9 角色、拖鞋、木牌、云和正式按钮继续使用。
- Home 更换背景和 Logo 的 SpriteFrame，去掉旧独立标语节点，新增两个后景装饰。保留原场景及组件 UUID、Home→Settings/HUD 的交互路径。
- 仅在现有 HomePresentation 中同步认可稿布局。Logo 与拖鞋保持 12 个设计单位的图片框间距，长屏等比放大插画。云保持独立缓慢移动。
- 对抗审查发现只按宽度缩放会在 600×800 裁掉 Logo，已改为 `min(canvas.width/750, canvas.height/1334)`。内容完整居中，背景独立等比铺满。没有新增布局框架、运行脚本或工程配置。

## 实际验收

| 检查 | 结果与证据 |
|---|---|
| 原生构建与类型 | Creator 3.8.8 Web 调试构建成功，退出 36，最终构建阶段约 4 秒；TypeScript `--noEmit --skipLibCheck` 通过。[BUILD_REPORT.json](evidence/BUILD_REPORT.json) |
| 短屏对照 | [375×667 认可稿与最终引擎](evidence/engine-final-compare-667.png)，主要构图、文字、图片和按钮关系一致，无新增裁切。 |
| 长屏对照 | [375×812 认可稿与最终引擎](evidence/engine-final-compare-812.png)，标题与塔紧凑成组，完整显示。 |
| 宽屏反例 | [600×800 实际画面](evidence/engine-final-600x800.png)，Logo 与按钮均完整、背景满屏。没有对应宽屏原稿，只签适配和可见性。 |
| 返回与开始 | 实际点设置→[Settings](evidence/engine-final-settings.png)→实际点返回→[Home](evidence/engine-final-returned.png)→实际点开始→[HUD](evidence/engine-final-start.png)。场景记录见 [ENGINE_NAVIGATION.json](evidence/ENGINE_NAVIGATION.json)。 |
| 飘云与布局 | 两次运行快照只有三层云的位置改变，其余首页节点不变。[ENGINE_MOTION.json](evidence/ENGINE_MOTION.json)。宽屏修正后短长屏非云节点与修正前逐字段一致，[ENGINE_FINAL_LAYOUTS.json](evidence/ENGINE_FINAL_LAYOUTS.json)。 |
| 来源与结构 | 59 张已导入图片可追溯；Home 70 条记录、18 个节点、13 个 Sprite，引用/父子/组件归属有效。92 个既有 meta 不变。[IMPORT_STRUCTURE_REPORT.json](evidence/IMPORT_STRUCTURE_REPORT.json)。 |
| 改动隔离 | 相对 R9 构建，只有 Home.scene 和 HomePresentation.ts 改变运行源码；新增4图。另3场景、其余玩法源码、package/tsconfig/settings 共20个受保护文件哈希不变。未重跑无变化的整套物理用例。 |

已自行查看实际画面并完成独立视觉复查。上述范围没有未解决的 P1/P2 视觉差异，详细过程见工程根 [design-qa.md](../../../design-qa.md)。

## 精确边界

- 不是逐像素复制：云使用余弦往返，认可稿使用 CSS 缓动；飞行小物未加稿中极轻的 CSS 模糊；字体抗锯齿与截图采样不同。实际同尺寸对照未发现这些差异引起的可见质量问题。
- 构建日志保留原有 worker SIGTERM 与 macOS 子进程关闭消息，最终构建成功。
- 浏览器捕获无 URL/调用栈的 MutationObserver.observe TypeError；R9 时也曾记录。完整搜索当前本地加载链和构建文件未找到调用点，来源仍未确认。不能声称控制台零错误；本轮画面与指定跳转均正常。原始记录见 [BROWSER_LOGS.json](evidence/BROWSER_LOGS.json)。
- 未做微信构建、真机安全区、后台恢复、手机音频、长局性能或完整事故验收。其他页面视觉仍沿用既有版本，按后续批次单独对照，不在首页通过范围内。

当前入口：[R10.1 Cocos 实际运行](../../review/home-r10.html)。
