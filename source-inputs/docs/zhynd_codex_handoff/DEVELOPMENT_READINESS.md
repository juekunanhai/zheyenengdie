# 开发准备与资源审查记录

## 2026-09-14 当前：本地内容与定向验收完成，平台与主观验收待续

**本地内容与定向验收完成；仍有微信启动/分包配置修正、主观手感/听感与真机待验，不进入 Batch 2。** 六件新增物体已接入；十二种轮廓/旋转、六件承托、汉堡 ±10 和 R7 375×812/600×800 两画幅检查通过。五件必要重绘（汉堡上、下面包局部修正并保留食材）、拖鞋正式像素复用完成自查。旧六件参数、1B 物理、R13 结算和首页保持。

默认 14 回合单局完成 14 placed、11.477m、3 星、0 事故。十局指定动作的逐物体复核：10/10 局在准备第九次释放时，最初八件已稳定确认且仍有效，3 星、0 事故；8/10 局首轮 14 次释放后仍可继续，但仅 2/10 局首 14 件全部确认且仍有效。它们是指定动作统计，不能写作玩家胜率或难度定稿。 十局均由自然失败进入 R13，真实高度一致，run_end 单次播放、旧音乐源销毁、新局 BGM 实际 STARTED、重开归零全部通过。 旧 19 回合压力失败保留，14 回合减少四块重复木板和一台冰箱而不改旧物理。分析见工程 preparation/review/evidence/batch1c/TEN_R7_ANALYSIS.json/.md。

自然乐器 BGM、35.64 秒循环及 18 个实声映射事件通过。运行库 95 PNG、34 MP3、12 TS、4 场景，251 项保护为 R6 已归档检查。主观听感、真人连续游玩和长局性能仍待验。

AppID 为 `wxc0360e0c829a3307`。微信首轮 Creator CLI 退出 36，官方开发者工具已以小游戏运行（基础库 3.17.2），实际拖放、木板轻触释放、自动释放和暂停通过。首轮未分包原始产物为 30,807,615 B，且以 HUD 为首场景；仅增加 Home 启动和 main 分包的 R2 候选已提交，新的配置确认待答，尚未执行或通过。未真机；现有授权不包含上传预览二维码或发布。 最小配置候选见工程 preparation/platform/wechat/WECHAT_R2_CONFIG_REVIEW.md，完整实施见 preparation/docs/BATCH1C_IMPLEMENTATION.md。以下旧批数字只属于对应历史版本。

## 2026-09-14 历史基线：Batch 1B 本地验收通过，待实际体验复核

用户在 R13 结算组件接入后要求“继续进行开发”。当前已实现事故上下文、三星与数量倒塌、支撑关系与失效过滤、镜头演出、深层辅助和 A3 自然拟音，本地验收通过；不再是“未进入 1B”。产品规则仍为 SPEC 2026-09-13-R6，本次更新实施状态，不增加导演、道具或后续批次。

最新真实 TypeScript 退出 0、Creator 构建退出 36、完整性检查通过，已覆盖物理步后停用失效节点的最终清理。ENGINE_FINAL_INITIAL.json 的 10 项物理/控制器检查与 AUDIO_FINAL.json 的音频补测共 11 项通过，包含原生形状同子步越界的零冲量对照。初轮目标时序未捕获、原生 bullet 初始化修复及音频测试误查绑定等历史记录保留。当前 85 PNG、22 MP3、11 TS、4 场景，250 项基线增至 260 项，237 项保护文件不变；7 个代码/场景文件及 6 个旧 MP3 按限定范围修改，新添事故模块及 meta、4 个 MP3 及 meta。所有图片、旧音频 meta/UUID、12 项实录材质、几何/材料/难度、其他场景和工程配置保持。

音频最新要求：用户要求避免电子音，授权从此前指定的网站搜集并使用自然拟音。A3 22 项已导入，来源包括 Freesound 的棘轮/吸盘实录与 Kenney Impact Sounds，均记录 CC0 许可、编辑配方与哈希；HUD 使用 20 项、Result 使用 run_end 共 21 项完成实际播放检查，stable 只预留。强碰撞优先、暂停/静音和结束换场也已补测通过。授权采用不等于用户主观试听通过，BGM 未在本批接入。

当前入口及完整证据在工程 `/Users/admin/Desktop/douchao/my-project/wechatgames/die`：`preparation/review/batch1b.html`、`preparation/docs/BATCH1B_IMPLEMENTATION.md`、`preparation/review/evidence/batch1b/REVIEW.md`、同目录 BUILD_REPORT.json、ENGINE_FINAL_INITIAL.json、AUDIO_FINAL.json，以及 `preparation/review/INTEGRITY_REPORT.json`。当前待用户实际手感与主观听感复核；微信设备、长局平衡、1C、完整导演和发布均未因本地检查完成。

以下各轮“暂停”“未进入 1B”“当前资源”仅描述其历史时点，不覆盖上方当前进度。

## 2026-09-13 历史：基础难度专项

SPEC 已同步 R6（第 2.4 节）。本批已完成真实承托轮廓、冰箱减重与加宽、长木板有限局部稳固、首次冲击缓冲、普通接触阻尼及篮球胶层异常拉扯修正。8 组固定操作中，旧版 0 组、新版 7 组完成连续十件并真正稳固；另一组确认九件后从马桶高台极近边缘翻落，保留失败结果。11 项机制、木板 8 项局部对照、实际 4 秒自动释放与指定画幅检查完成，1.5 秒普通观察上限保留。当前交付用户试玩复核，不等于真人胜率、全组合通过或微信真机验收；其他开发暂停，不进入 1B。

当前状态与可追溯证据：工程 preparation/docs/DIFFICULTY_R1.md；新版与原始旧构建的入口 preparation/review/difficulty.html。三件新图仍是自查后试玩候选，待用户视觉复核；非承托倒角误差和竖板极侧爪体裁切如实列在专项。原始美术包、比例文件与 Word 保持历史输入不变。

## 2026-09-13 既往执行状态

用户已以“ok，继续”恢复获准的四物体 Batch 1A，随后同意 A2 音效先采用、后续可替换。当前工程已有基础全塔、输入、旋转、倒计时、重开和实际短音效。当前事实与证据以工程 preparation/docs/READINESS.md、BATCH1A_ACCEPTANCE.md 为准；未进入 1B，未宣称微信真机或发布通过。

2026-09-13 contact-r1：用户确认修正“塔下沉”和“悬空支撑”。本轮统一背景/地面/塔体镜头位移，校准四物体可见承重轮廓与显示锚点，补充接触对照及六箱上升录屏。正式尺寸和源图不变；当前待用户复核修正版体验，旧 31 项检查不能代替这两项视觉验收。入口为工程 preparation/review/contact-review.html。

2026-09-13 adhesion-r2（历史）：用户确认平台贴合与篮球上下真实粘连，采用低弹性、接触缓冲、有限强度连接和失效清理。当前 SPEC 第 2.3 节为 R4；工程 ADHESION.json 验证连续五件、轻微偏心、侧擦、拉开、旋转接触和失去支撑。仍维持四物体序列，介绍界面不提前进入 1A。此前 contact-tape-r1 的摩擦/阻尼对照仅作历史，不作为当前粘连验收。

下文为 2026-09-12-R2 的准备收尾快照，包含其当时暂停与候选状态；不代表当前仍暂停或无玩法。原 Word 及原始美术保留为输入档案，后续确认规则以当前 SPEC 为准。

## R2 历史准备记录

修订：2026-09-12-R2。与同版 SPEC 正文、跨平台说明、两份 Word 及素材规则同步。

## 当前结论

准备资料已收口，可作为四物体 Batch 1A 的开发输入。1A 已获用户确认，随后按要求暂停；本次只更新准备资料，未写玩法、变更运行配置或启动构建。当前工程存在，不能再使用“空目录/尚无工程”的早期状态。

工程位于 /Users/admin/Desktop/douchao/my-project/wechatgames/die。详细当前状态、首轮参数、批次和验收证据分别见工程 preparation/docs/READINESS.md、ENGINEERING_BASELINE.md、BATCH_PLAN.md、VISUAL_R6.md。

## 已完成的输入

- 规则已确认：仅技能旋转、轻触/拖动松手释放、首局前两件免自动释放、整塔保留、失效落物不影响下方塔、普通事故扣星与数量型倒塌、镜头/逻辑边界分离、深层辅助、音频分批交付。
- R6 已在 SPEC 第 4、5、12 节正文统一：顶部高度、左侧三星、短抓手、竖排道具、无木板垫层、地面起点与高度背景。
- Creator 3.8.8 与 Box2D WASM 已配置；R6 静态工程 4 场景、47 图片、50 Sprite、1 表现组件、0 玩法脚本。对应 Web 构建和部分画幅已有证据。
- 179 正式源 PNG 和 24 项 gameplay_scale 保持原值。四物体已具备进入物理校准的素材与候选几何；41 WAV/41 MP3 音频候选有来源、编码与哈希记录，仍未批准。
- 首轮参数按 SPEC 第 2.2 节：1u=100 世界单位=1 显示米，承台 1.6u；释放位置沿 R6，画面估计约 3.67u，实际 Collider 间隙待测。旧 4.2u/1.8u 退役。

## 开发中的验收安排

1. 0→1A 首项：四物体挂点/旋转/碰撞/重心，统一尺度，窄平台调用与动态尺寸变化；这些是开发中的运行验证，不伪造开发前已测结论。
2. 1A 从第一轮模拟全部有效塔；1B 完善失效过滤、支撑、事故、三星、数量倒塌与深层辅助。
3. 音频先按 1A 子集试听，未批准不接入正式声音或标交付通过；几何与输入开发不必等完整音乐。
4. 沙发/马桶/哑铃/鲸鱼在 1C 前补齐。真实微信 AppID、胶囊/刘海、触摸及性能在真实平台验收前落实；不阻塞本地四物体开发。

4 秒规划、0.75 倍镜头、事故演出时间、60% 倒塌比例与 3/6 数量上下限、深层 1–3 屏辅助曲线均为初始调优值。阻尼上限与支撑/趋势门槛由 1B 实测，不提前叠加复杂辅助力矩。

## 原始 PNG 缺陷记录

以下仅描述未修改的原包文件。工程中获接受的派生修复由 BATCH0_IMPORT_MANIFEST、USER_VISUAL_APPROVAL 和 R6 证据另行记录；不能把原图缺陷状态当成派生文件当前状态。其他未验收条目仍不自动批准。

| 正式资源路径 | 已知问题 |
|---|---|
| 02_ASSETS/backgrounds/airplane.png | 内容为云与星点，不是独立飞机。 |
| 02_ASSETS/backgrounds/asteroid_cluster.png | 混有背景色条和光效，不满足独立小行星组要求。 |
| 02_ASSETS/backgrounds/blimp.png | 内容为云与星点，不是独立飞艇。 |
| 02_ASSETS/backgrounds/cloud_large_a.png | 主要内容为城市建筑，不是清单所述大云。 |
| 02_ASSETS/backgrounds/cloud_large_b.png | 主要内容为城市建筑，不是清单所述大云。 |
| 02_ASSETS/backgrounds/cloud_mid_a.png | 主要内容为城市建筑，不是清单所述中云。 |
| 02_ASSETS/backgrounds/cloud_small_a.png | 主要内容为楼顶，不是清单所述小云。 |
| 02_ASSETS/backgrounds/cloud_small_b.png | 主要内容为楼顶，不是清单所述小云。 |
| 02_ASSETS/backgrounds/cloud_small_c.png | 主要内容为楼顶，不是清单所述小云。 |
| 02_ASSETS/backgrounds/hot_air_balloon.png | 内容为风流/星点/星云残片，不是独立热气球。 |
| 02_ASSETS/backgrounds/moon.png | 内容为背景色条等残片，不是独立月球。 |
| 02_ASSETS/backgrounds/planet_purple.png | 主要内容为色条和邻近残片，不是独立紫色行星。 |
| 02_ASSETS/backgrounds/planet_red.png | 主要内容为背景色条，不是独立红色行星。 |
| 02_ASSETS/backgrounds/planet_ringed.png | 主要内容为色条和残片，不是独立带环行星。 |
| 02_ASSETS/backgrounds/satellite.png | 主要内容为其他特效与残片，不是独立卫星。 |
| 02_ASSETS/claw/claw_cable_flex.png | 侧面带邻近组件残片，需完整独立索缆。 |
| 02_ASSETS/claw/claw_cable_straight.png | 侧面带邻近组件残片。 |
| 02_ASSETS/claw/claw_open_mid.png | 右侧带邻近抓手残片。 |
| 02_ASSETS/claw/claw_open_narrow.png | 包含两只抓手及烤死的红色方块，不满足独立抓手状态要求。 |
| 02_ASSETS/claw/claw_open_wide.png | 右侧带邻近抓手残片。 |
| 02_ASSETS/hud/hud_next_frame.png | 框内烤有固定方块虚线，右侧带邻近组件残片。 |
| 02_ASSETS/hud/hud_pause.png | 上方和侧面带邻近组件残片。 |
| 02_ASSETS/hud/hud_rotate_90.png | 上方和侧面带邻近组件残片。 |
| 02_ASSETS/hud/hud_star_empty_set.png | 上方残片，星星组合边界需拆分复核。 |
| 02_ASSETS/hud/hud_star_full_set.png | 上方残片，星星组合边界需拆分复核。 |
| 02_ASSETS/next/next_basketball.png | 现有图保留明暗/纹理，未满足纯轮廓要求；同时须复核邻图残片和裁切边缘。 |
| 02_ASSETS/next/next_bathtub.png | 现有图保留明暗/纹理，未满足纯轮廓要求；同时须复核邻图残片和裁切边缘。 |
| 02_ASSETS/next/next_bowling_ball.png | 现有图保留明暗/纹理，未满足纯轮廓要求；同时须复核邻图残片和裁切边缘。 |
| 02_ASSETS/next/next_burger.png | 现有图保留明暗/纹理，未满足纯轮廓要求；同时须复核邻图残片和裁切边缘。 |
| 02_ASSETS/next/next_cardboard_box.png | 现有图保留明暗/纹理，未满足纯轮廓要求；同时须复核邻图残片和裁切边缘。 |
| 02_ASSETS/next/next_cat_bed.png | 现有图保留明暗/纹理，未满足纯轮廓要求；同时须复核邻图残片和裁切边缘。 |
| 02_ASSETS/next/next_dumbbell.png | 现有图保留明暗/纹理，未满足纯轮廓要求；同时须复核邻图残片和裁切边缘。 |
| 02_ASSETS/next/next_fridge.png | 现有图保留明暗/纹理，未满足纯轮廓要求；同时须复核邻图残片和裁切边缘。 |
| 02_ASSETS/next/next_giraffe.png | 现有图保留明暗/纹理，未满足纯轮廓要求；同时须复核邻图残片和裁切边缘。 |
| 02_ASSETS/next/next_ice_block.png | 现有图保留明暗/纹理，未满足纯轮廓要求；同时须复核邻图残片和裁切边缘。 |
| 02_ASSETS/next/next_oil_drum.png | 现有图保留明暗/纹理，未满足纯轮廓要求；同时须复核邻图残片和裁切边缘。 |
| 02_ASSETS/next/next_piano.png | 现有图保留明暗/纹理，未满足纯轮廓要求；同时须复核邻图残片和裁切边缘。 |
| 02_ASSETS/next/next_rocket.png | 现有图保留明暗/纹理，未满足纯轮廓要求；同时须复核邻图残片和裁切边缘。 |
| 02_ASSETS/next/next_slipper.png | 现有图保留明暗/纹理，未满足纯轮廓要求；同时须复核邻图残片和裁切边缘。 |
| 02_ASSETS/next/next_sofa.png | 现有图保留明暗/纹理，未满足纯轮廓要求；同时须复核邻图残片和裁切边缘。 |
| 02_ASSETS/next/next_spring_pad.png | 现有图保留明暗/纹理，未满足纯轮廓要求；同时须复核邻图残片和裁切边缘。 |
| 02_ASSETS/next/next_television.png | 现有图保留明暗/纹理，未满足纯轮廓要求；同时须复核邻图残片和裁切边缘。 |
| 02_ASSETS/next/next_tire.png | 现有图保留明暗/纹理，未满足纯轮廓要求；同时须复核邻图残片和裁切边缘。 |
| 02_ASSETS/next/next_toilet.png | 现有图保留明暗/纹理，未满足纯轮廓要求；同时须复核邻图残片和裁切边缘。 |
| 02_ASSETS/next/next_ufo.png | 现有图保留明暗/纹理，未满足纯轮廓要求；同时须复核邻图残片和裁切边缘。 |
| 02_ASSETS/next/next_vending_machine.png | 现有图保留明暗/纹理，未满足纯轮廓要求；同时须复核邻图残片和裁切边缘。 |
| 02_ASSETS/next/next_whale.png | 现有图保留明暗/纹理，未满足纯轮廓要求；同时须复核邻图残片和裁切边缘。 |
| 02_ASSETS/next/next_wood_plank.png | 现有图保留明暗/纹理，未满足纯轮廓要求；同时须复核邻图残片和裁切边缘。 |
| 02_ASSETS/next/next_wooden_crate.png | 现有图保留明暗/纹理，未满足纯轮廓要求；同时须复核邻图残片和裁切边缘。 |
| 02_ASSETS/objects/object_basketball.png | 上方带邻近木箱残片。 |
| 02_ASSETS/objects/object_fridge.png | 右侧带邻近物体残片。 |
| 02_ASSETS/objects/object_ice_block.png | 上方和右侧带邻近物体残片。 |
| 02_ASSETS/objects/object_sofa.png | 画面下边界截断主体，须复核完整边缘。 |
| 02_ASSETS/objects/object_wood_plank.png | 上下带其他物体残片；斜向画面须校准显示方向和碰撞轮廓。 |
| 02_ASSETS/objects/object_wooden_crate.png | 右侧带邻近物体残片。 |
| 02_ASSETS/system_ui/loading_bar.png | 进度百分比与填充烤死，需要可动态填充的组件。 |
| 02_ASSETS/system_ui/toggle_off.png | 保留展板文字且按钮主体被截断。 |
| 02_ASSETS/system_ui/toggle_on.png | 保留展板文字且按钮主体被截断。 |
| 02_ASSETS/ui/bubble_plain.png | 上方及左侧带邻近组件残片。 |
| 02_ASSETS/ui/panel_9slice_light.png | 上方文字残留，面板边界需复核后确定九宫格。 |
| 02_ASSETS/ui/popup_base_9slice.png | 上方文字残留，面板下边界不完整。 |
| 02_ASSETS/ui/toast_bubble.png | 提示内容烤死且边界不完整。 |

## 缺失与历史记录


原包 QA 的 PASS、零缺图和 SPLIT_MANIFEST 只作历史证据。原图与比例不变不等于素材、音频、物理、真机或发布全部通过。当前批次按工程 READINESS 与 BATCH_PLAN 执行。
