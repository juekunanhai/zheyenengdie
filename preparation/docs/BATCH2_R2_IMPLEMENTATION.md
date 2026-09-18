# Batch 2 R2 implementation

2026-09-18。继续开发在不构建、不启动项目的约束下完成了道具状态、第二批对象候选与导演接入的源码闭环。截图、录屏和日志属于本地过程证据，本轮不纳入提交。

## 已接入

- `ItemLedger` 固定两个道具槽，同类最多叠两件；成功放置 10、20、30… 后打开一次三选一，满库存必须明确替换槽位。
- 强力胶、缩小、羽量、撤销、重抽、补星六个消耗入口均有单次扣减；缩小约 37%，羽量将密度降到 30%，强力胶通过有限时长的相对关节提供 10 秒约束。
- 检查点快照包含道具状态。恢复时保留保存点之后的消耗和已使用复活标记，避免撤销或恢复复制库存。
- HUD 的 `InventoryColumn` 使用现有空槽资源动态显示两个槽位和当前奖励，控制器提供 `useItem` / `chooseItem` 回调；没有新增外部平台或广告依赖。
- 第二批 12 件对象已加入 `object-data.ts`、导演分类和正式素材候选：电视机、浴缸、钢琴、轮胎、保龄球、油桶、弹簧垫、猫窝、长颈鹿、UFO、火箭、自动贩卖机。玩法尺寸仍取正式 `OBJECT_GAMEPLAY_SCALE.json`，导演解锁门槛集中在 `SECOND_BATCH_UNLOCKS` 作为 R2 调参候选；正常对局允许极低概率提前闯入，并单独记录 `discovered`，不会改变正式常规池门槛。
- 第二批 24 个 Sprite/NEXT 候选、Cocos meta 和 HUD 帧引用已进入 `assets/batch1/art` 与 `HUD.scene`。素材仍需用户视觉确认，不能把静态引用检查当作最终美术验收。

## 静态验证

- `check_item_system.cjs`：8 组账本、消耗、恢复与复活单调性。
- `check_batch2_assets.cjs`：12 件对象、24 个素材/meta、正式尺寸和 HUD UUID 引用。
- `check_batch2_director.cjs`：解锁前后对象池、开场保护、重抽保持 CURRENT、导演检查点回放。
- 原有 `check_director_integration.cjs`、`check_checkpoint_integration.cjs`、`check_world_checkpoint.cjs`、`check_play_view_restore.cjs` 和 `check_tower_director.cjs` 保持通过。

这些脚本只覆盖 TypeScript 源码、引擎 doubles、JSON/meta 和状态规则；真实 Cocos Box2D、视觉、音频、广告、微信设备和长局平衡仍未验收。

## 下一步

1. 用真实 Cocos 物理检查六道具的触点时序、强胶 10 秒释放、缩小/羽量的显示与承托。
2. 对第二批 12 件逐件校准 Sprite 锚点、NEXT 纯轮廓、Collider 和旋转后挂点，再做视觉确认。
3. 在道具状态稳定后接广告复活授权；广告失败、重复回调和检查点恢复仍要保持一次性消费。
4. 最后再进入图鉴、分享、云端成绩和排行榜批次。
