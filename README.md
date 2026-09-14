# 这也能叠

**新电脑请先阅读 [恢复开发步骤](NEW_COMPUTER.md)**。代码、运行素材、原始素材包与生成源图均随 Git 提交；不使用 Git LFS。

当前为 **Batch 1C：十二物体、R13 结算、首页音乐 A 与对局音乐 B**。R4 已接入首页《Carefree》约 40 秒循环，对局 B 正常增益由 0.22 调至 0.28（约 +2.1 dB），人声/事故降音保持 0.09。首轮六项真实 Web 检查已通过；严格在途取消补测及门禁最终结论以 [R4 验收记录](preparation/review/evidence/home-r4/REVIEW.md) 为准。微信 R2 的首页启动与分包配置已执行，本地构建、用户手动进入对局及自然结算已有证据；完整工具交互、压缩包限额和真机仍待验，不进入 Batch 2。

- [当前试玩：首页 A / 对局 B](preparation/review/home-music-r4.html)
- [R4 实现与验收证据](preparation/review/evidence/home-r4/REVIEW.md)
- [十二物体实施与待验项](preparation/docs/BATCH1C_IMPLEMENTATION.md)
- [批次计划](preparation/docs/BATCH_PLAN.md) · [音频记录与来源](preparation/docs/AUDIO_DELIVERY.md)

Creator 3.8.8 / TypeScript / Box2D WASM；当前工程包含 **95 PNG、38 MP3、12 个 TypeScript、4 个场景**。沿用已认可首页与 R13 结算，十二物体采用覆盖全部种类的固定 14 回合宽容序列，已展示的 NEXT 保持锁定。完整导演、道具、高光识别、图鉴、分享和排行榜留在后续批次。

基础玩法已包括整座有效塔模拟、拖动或轻触松手释放、按钮旋转、4 秒规划与首局前两件引导豁免、稳定成绩、事故扣星、第三次普通事故失败、数量倒塌、镜头与深层辅助。普通接触观察最多 1.5 秒，事故和明显掉落仍阻塞下一件；成绩只在真实稳固后确认。本轮没有修改物理、难度、几何、质量或固定出物序列。

首页 A 在允许播放时使用单个场景声源；点击开始立即取消 A，再由 HUD 播放 B。Settings 本身无配乐，音乐开关同时控制首页与对局，返回 Home 时按偏好重新播放 A；后台停止首页音乐，返回后重新播放，设置页包含两首音乐署名。

对局 B 保持约 14.328 秒循环乐句，三个高度引用沿用同一版本，保留切换机制。Hey 对应首次有效放置触碰，Wow 对应稳定成绩跨 5 米档，短笑对应趣味物体的新稳固事件；既有三人声、12 秒冷却及事故/暂停取消规则保持。

R4 六项检查覆盖 A 自然循环、导航、设置、模拟后台、B 增益/降音/高度切换及快速换场。自动检查显式设置交互标记，模拟触碰与受控高度不冒充真人操作或真实高塔。R3 的七项人声检查与 R6/R7 的物理、十四件、十局和画幅统计保留历史含义，本轮没有重跑整套旧验收，也不等于玩家胜率。详见 [R4 当前验收](preparation/review/evidence/home-r4/REVIEW.md)、[R3 历史音频验收](preparation/review/evidence/playful-r3/REVIEW.md) 与 [R7 十局历史分析](preparation/review/evidence/batch1c/TEN_R7_ANALYSIS.md)。

微信 AppID：`wxc0360e0c829a3307`。R2 已按确认改为 Home 启动和资源分包，Creator 实际退出 36、静态门禁退出 0；用户手动进入 HUD、真实物理/配乐运行和自然 R13 结算已观察。工具显示本地代码 30450 KB；这不是最终压缩包限额通过。工具仍有 SDK/环境诊断，额外交互与音频生命周期未完整复验，未做真机、上传或发布。见 [微信 R2 当前验收](preparation/platform/wechat-r2/REVIEW.md)。

正式原始素材包保持，派生素材、尺度和音频各自保留来源记录；不能把图片像素尺寸当作物理尺寸。历史入口：[已认可难度基线](preparation/docs/DIFFICULTY_R1.md)、[首页工程记录](preparation/design/R10/ENGINE_INTEGRATION.md)、[1B 事故与物理验收](preparation/review/evidence/batch1b/REVIEW.md)。
