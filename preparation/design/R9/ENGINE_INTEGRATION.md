# R9 首页工程接入

2026-09-13：用户确认“我重启了下电脑，这个图可以，认可。”确认与设计哈希见 [APPROVAL.json](APPROVAL.json)。R9 已用于现有 Home 场景，仍为 Batch 1A 的视觉基础修正。

## 最小方案与实际改动

- 原生 Sprite 使用已认可的城市、表情蓝箱／马桶／黄鸭、正式红拖鞋和文字木牌，Logo、设置与开始按钮复用已有工程资源。5 张 PNG 原样导入，记录见 [HOME_R9_IMPORT_MANIFEST.json](../../art/HOME_R9_IMPORT_MANIFEST.json)。
- Home 移除旧测试物品、平台及 HeightBackdrop 挂载；新增一个 HomePresentation 组件处理按画幅布局、独立云动效和按钮按压反馈。
- 保留 Canvas/SafeArea/Content_1230 的交互路径、Home UUID、StackSceneActions 与菜单音频。开始进入 HUD；设置进入 Settings，返回仍到 Home。
- 背景等比铺满并对齐底部，内容按 R9 的 750 设计宽和实际屏高排布；安全区仅使操作入口内收。云用缓慢的余弦往返代替网页 CSS 缓动，范围、层级和速度量级沿用定稿。

是否需要更复杂方案：不需要通用布局框架或物品系统。首页与按高度变化的游戏背景职责不同；若修改共享 HeightBackdrop，会影响 HUD，因此使用一个首页专用表现组件。首页装饰塔不进入玩法物品池，不添加碰撞体。

## 本轮验证

- TypeScript 严格模式检查通过（引擎声明使用 skipLibCheck）。
- Creator 3.8.8 Web 调试构建完成，退出码 36；日志记录约 21 秒。构建文件与源码哈希见 [BUILD_REPORT.json](evidence/BUILD_REPORT.json)。
- [375 × 667 实际首页](evidence/engine-home-667.png)、[375 × 812 实际首页](evidence/engine-home-812.png) 均已目视对照 R9。主体、拖鞋接触、牌面三行文字、Logo 和底部按钮关系保持。系统字体渲染与网页细部不宣称逐像素相同。
- 实际点击通过 Home → [Settings](evidence/engine-settings-link.png) → Home，以及开始按钮 → [HUD](evidence/engine-start-link.png)。
- 两次运行数据快照确认三朵云位置改变，其他首页节点位置和尺寸保持相同：[ENGINE_MOTION.json](evidence/ENGINE_MOTION.json)。
- 结构引用／父子归属／SpriteFrame UUID 校验通过。相对于原 1A 构建报告，全部既有玩法 TS、HeightBackdrop、工程 settings 及另外三个场景哈希不变；没有重跑无变化的整套物理用例。
- 完整性校验器保留旧来源与批次检查，增加明确的 R9 导入项和确认哈希，当前构建报告单独保存；未覆盖原 1A 构建历史。

## 限制与异常记录

未做微信构建、真机安全区、长局性能、系统减少动效或后台恢复实测。Cocos 主循环之外的审阅页控件不进入 assets。

构建日志含原有 worker SIGTERM 与 macOS 子进程退出消息，但最终构建成功且实际场景可运行。浏览器捕获一条无来源 URL 的 MutationObserver.observe 错误；当前服务的工程／构建脚本搜索未找到 MutationObserver，具体来源未确认。上述指定画面与跳转均正常，不声称控制台零错误。

重启后原 R9 标签页停留在连接失败的 data: 错误页；浏览器工具访问该错误页被 URL 策略拦截，已停止操作该错误页。新的首页引擎验收地址正常访问。

当前入口：[首页实际运行](../../review/home-r9.html)。未因此开始 Batch 1B，亦未将首页视觉确认扩展为 HUD／设置／结算新设计的确认。
