# Batch 1B 本地验收记录

2026-09-14。**本地验收通过，待用户实际手感、A3 主观听感与微信设备复核。** 最新构建的 10 项真实 Cocos 物理/控制器检查通过，音频用例纠正场景绑定预期后单独补测通过，共 11 个不同检查项。纯规则 9/9 单独记账，不计入真实引擎数量。完整产品、十二物体 1C、BGM、完整导演与发布未在本轮完成。

当前入口：[实际引擎试放](../../batch1b.html)。规则与参数见 [BATCH1B_IMPLEMENTATION.md](../../../docs/BATCH1B_IMPLEMENTATION.md)，产品规则仍为原输入 SPEC 2026-09-13-R6，保留已认可的 1.5 秒普通观察上限、物体几何与 difficulty-r1 难度。

## 实现范围与可复查构建

复用 TowerWorld、StackGameController、PlayView 与 GameAudio，只新增一个纯 Incident 上下文，保存冻结边界、计划观察范围、referenceTop、固定成员与去重结果；没有增加导演、随机抽取、道具或检查点系统。

当前资源为 **85 PNG、22 MP3、11 TS、4 场景**。250 项基线增至 260 项，237 项保护文件不变；7 个代码/场景文件按限定范围修改，6 个旧 MP3 替换，新添事故模块及 meta、4 个 MP3 及 meta。所有旧音频 meta/UUID、12 项保留实录材质、图片、物体几何/材料/难度、其他场景和工程配置保持。R13 的 18 项原图导入和历史来源校验继续保留，没有放宽为任意 runtime 改动。

| 证据 | 结果与边界 |
|---|---|
| [BUILD_REPORT.json](BUILD_REPORT.json) | 2026-09-14 00:27:53 记录，Creator 3.8.8 Web 调试构建退出 36，TypeScript 退出 0。核对实际退出码、最新输入/日志/输出时间、哈希与范围；覆盖失效节点在 afterPhysics 停用的最终代码。构建子进程有已记录的 SIGTERM/进程通信日志，未声称零警告。 |
| [INTEGRITY_REPORT.json](../../INTEGRITY_REPORT.json) | 当前完整性检查通过；来源、比例、R13 导入、A3 清单及最新构建匹配。完整性检查不代替引擎行为验收。 |
| [BEFORE.json](BEFORE.json) | 250 项变更前基线，配合构建报告检查精确范围与 237 项不变文件。 |
| [INCIDENT_RULES_CHECK.json](INCIDENT_RULES_CHECK.json) | 编译并加载实际 incident-state.ts，9/9 纯规则反例通过；其中三次事故星数消费是外部最小驱动模拟，实际控制器另由下表验证。 |

## 最新构建的真实引擎检查

物理/控制器证据来自 [ENGINE_FINAL_INITIAL.json](ENGINE_FINAL_INITIAL.json) 的前 10 项；实际音频证据来自 [AUDIO_FINAL.json](AUDIO_FINAL.json)。两份记录的 `errors` 均为空。检查在实际本地 Cocos 构建中执行，物理场景通过定向结构、速度或边界注入制造反例，没有直接调用 Incident.recordLoss 冒充物理触发；这种方法验证规则与时序，不证明自然对局胜率。

| 检查 | 结果 | 验证内容 |
|---|---|---|
| 三次独立事故 | 通过 | 第三次普通事故使剩余 1 星归零并锁定失败，进入真实 Result 场景。 |
| 同事故多件掉落 | 通过 | 去重、同事故只扣一星、超过普通 1.5 秒不强制生成物体；镜头恢复期间再掉落仍合并为同一事故。 |
| 数量型倒塌 | 通过 | 固定旧塔集合与 N/K，成员损失达到 K 后即使还有星也失败；未成功放置的新物体不凑旧塔数量。 |
| 规划与出物恢复 | 通过 | 在手物、NEXT、倒计时和规划状态保留，事故停止规划计时，恢复后只继续一次。 |
| 冻结边界与镜头 | 通过 | N/K、逻辑边界与观察范围不随演出缩放和 resize 改变；0.75 演出使用显示层，HUD 尺寸保持。 |
| 屏下有效支撑 | 通过 | 镜头移出旧体不误扣星，仍保持动态承重；真正脱离持续下落、慢速返回接住和快速下坠分别检查。 |
| 同子步碰撞过滤 | 通过 | 默认步长及临时多子步对照捕获 Node 仍在界内、原生形状已越界的求解前时序；开启过滤时零碰撞冲量，关闭过滤的对照产生冲量；配置和原生 CCD 均启用。临时步长在 finally 还原。 |
| 失效连接 | 通过 | 真实建立单篮球胶、木板稳固及篮球上下双胶；在 BEFORE 和真实 PRE_SOLVE 内失效后切断后续连接施力，覆盖双连接反例。 |
| 凹形马桶 | 通过 | 使用正式凹形马桶的 12 个原生 Fixture，未简化为包围盒；多个真实接触均过滤，保留有/无过滤的冲量对照。 |
| 深层辅助 | 通过 | 同一真实支撑旧体随深度平滑增强角阻尼，开关对照不改姿态或质量；脱离支撑后辅助关闭，持续下坠后失效。 |
| A3 实际音频 | 通过 | 当前使用的 21 项声音通过 AudioSource STARTED/ENDED；同对弱拒强替、同对多占用时按最强判定、4 个碰撞槽满时强替弱、操作/掉星保留通道、暂停不补播、静音拒播及设置恢复。真实 finish 换至 Result 后 run_end 启动/结束各一次。 |

失效对象先在求解前禁止后续碰撞和连接影响，再于 `afterPhysics` 将节点 `active=false`，安全停止原生模拟和显示。诊断记录仍保留至场景卸载统一销毁；没有声称接触回调里立即 destroy 或立刻释放全部内存。有效屏外塔底不会因此被删除或固定。

## A3 来源、采用和听感边界

用户明确要求“所有的音效先不要用电子音，去到我之前跟你说的，去网站上搜集一些音效，然后使用”。A3 据此直接采用，无需再等素材使用批准，但 `listening_status` 仍为 `not_reviewed`。

- 保留 A2 的纸、木、橡胶、金属实录材质 12 项；用真实棘轮、吸盘和敲击声替换 claw_grip、claw_open、rotate_90、next_handoff、stable、run_end 6 项，旧 UUID/meta 不变。
- 新增 star_lost 及 impact_ceramic_1..3 四项。陶瓷来自盘器敲击拟音，不冒充马桶实录，也不用玻璃破碎声代替。
- 来源均记录 CC0：[CapsLok 棘轮](https://freesound.org/people/CapsLok/sounds/181634/)、[michorvath 吸盘](https://freesound.org/people/michorvath/sounds/386885/)、[Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds)。Freesound 使用作者页面公开的 HQ MP3 预览，未将其写成原始无损 WAV。
- 10 项新处理声音均保持原速度，使用本地剪辑、滤波与混音；配方、源文件/导出/旧 meta 哈希见 [A3 来源清单](../../../audio/foley-a3/MANIFEST.json) 和 [运行导入清单](../../../audio/BATCH1B_AUDIO_IMPORT_MANIFEST.json)。22 个运行 MP3 共 107,535 字节。

HUD 绑定 21 项，其中当前使用 20 项；Result 独立绑定并使用 run_end，共 21 项正在使用。stable 只预留到高光批次，未虚报自然触发。音频检查为了完整覆盖映射，直接调用实际编译后的 GameAudio 并监听 AudioSource；HUD 的 22 次映射播放含复用声音，不能解释成 22 个独立声音，也不证明全部由自然物理碰撞触发。结算音则通过真实 finish → Result.onLoad 流程验证。扬声器实际听感、自然密集事故的听感和微信中断恢复仍待复核，BGM 未接入。

## 最终构建普通试放与历史问题

[ENGINE_NORMAL_FINAL.json](ENGINE_NORMAL_FINAL.json) 保存最终构建的普通居中七件试放：通过实际 moveTo/release 依次放下纸箱、木板、马桶、冰箱、哑铃、篮球、纸箱，未注入物理位置、速度或事故。最终 7 件成功放置、3 星、0 事故，稳定高度 **6.112681m**；8 个刚体（含下一件在手物）的组件与原生 bullet 均为 true，`errors` 为空。画面见 [NORMAL_FINAL.png](NORMAL_FINAL.png)。

该次使用六件固定轮转、无限规划时间的校准入口，不能称为导演出物、真实倒计时难度或自然死亡统计。之后点击审阅页的结束操作进入真实 Result，显示 **6.1m**，见 [RESULT_FINAL.png](RESULT_FINAL.png)；这是实际成绩与结算显示的对照，不是假称第三次事故或自然失败触发。

[ENGINE_NORMAL_SEVEN.json](ENGINE_NORMAL_SEVEN.json) 是前一构建的七件历史试放，7 件成功放置、3 星、0 事故、6.1127m。它早于最后的失效节点停用清理，过程中没有失效对象；当前普通试放应以上方 ENGINE_NORMAL_FINAL 为准，不用历史局充作最终构建证据。

历史记录保持原样，不能以同名最终报告覆盖失败含义：

1. [ENGINE_INITIAL.json](ENGINE_INITIAL.json) 的首轮 9 条记录含一次重复复测，实际 8 个不同检查项中 7 项通过。PRE_SOLVE 用例未捕获目标同子步时序，按失败保存。随后 [ENGINE_PRESOLVE_R2.json](ENGINE_PRESOLVE_R2.json) 捕获目标并完成过滤/对照；最终构建再覆盖默认与多子步。
2. 同子步调查发现组件 `bullet=true` 而原生 CCD 未启用。创建节点挂入场景后再初始化原生刚体标记的顺序已修复；最终物理用例确认组件值和原生值一致为 true。
3. 中间构建的 MotorJoint 用例存在失败记录，保留于 ENGINE_NORMAL_SEVEN.json；该记录不能作为通过证据。最新 motor 用例包含单/双连接及求解中失效，最终通过。
4. ENGINE_FINAL_INITIAL.json 中的 audio 为失败，原因是测试误以为 run_end 应在 HUD 绑定。实际职责一直是 Result 的独立声音。纠正测试预期后，AUDIO_FINAL.json 从真实换场观察到启动/结束各一次；未为满足测试向 HUD 错绑结束音。

## 尚未证明

本次证明的是本地 Cocos 构建上的指定事故、支撑、镜头与音频行为，不等于真人胜率、所有物体组合、长局数值平衡或约 10 局实际体验。用户实际手感和 A3 主观听感、手机扬声器、微信真机安全区/中断/性能仍需后续验收；真实 AppID 与平台发布也未因本次通过而完成。1C、BGM、完整导演和后续系统仍按既定批次评审。
