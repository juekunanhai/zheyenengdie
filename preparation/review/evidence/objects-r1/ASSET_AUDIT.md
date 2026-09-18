# 第二批物体资源只读审计

2026-09-16。按“继续下一批、暂不构建”的授权检查本地 SPEC、原始素材和既有派生资源，未改素材，未启动或构建项目。本记录不表示第二批物体已实现或验收。

## 结论与最小方案

不能把原始第二批 12 个 Sprite / NEXT 原样接入。原 NEXT 全部在源 Manifest 标记 blocked；SPEC §3.3 要求只展示轮廓，现存纹理与切图残片修复后才能交付。逐张目视原 Sprite 也发现多处残片或主体截断。

`preparation/art/candidates/objects` 与对应 `next` 只有初始 12 件；`edge-candidates/objects` 仅纸箱、木箱、冰箱、木板；`source-restored` 只有设置按钮。`USER_VISUAL_APPROVAL.json` 的 12 项是四物体和抓手/控件，不包含第二批。因此，无需新素材处理即可完整接入的第二批子集为 0 件。

最小开发方案是先推进不依赖新美术的检查点/撤销链路。若随后处理第二批，先用主体完整的电视机做单件：复用源 Sprite、补充匹配的纯轮廓 NEXT、真实 Collider 和等比尺寸记录，再接候选入池门槛。保龄球、油桶、火箭、弹簧垫可在移除相邻残片后作后续小批；截断物体需先补齐图形。

不需要为此引入资源适配器、主题池、通用解锁框架或新的运行配置。分批修复现有素材、在现有物体表与导演中直接接入即可；先行接入带残片/截断的全部 12 件不能满足当前明确要求。

## 逐件结果

下表为原始输入目视结果，参考尺寸来自原 `OBJECT_GAMEPLAY_SCALE.json`，不是已经校准的 Collider 宽高。基准 1u = 100 世界单位。禁止为了同时满足参考宽高强行非等比拉伸源图，也不能将带残片的透明画布直接当作物理尺寸。

| 物体 | slug | 原 Sprite 结果 | 原参考尺寸 u |
|---|---|---|---|
| 电视机 | television | 主体完整，适合首个候选 | 1.05 × 0.90 |
| 浴缸 | bathtub | 底部脚截断 | 1.55 × 0.72 |
| 钢琴 | piano | 左侧邻物残片，底部脚截断 | 1.65 × 1.10 |
| 轮胎 | tire | 底部截断 | 0.95 × 0.95 |
| 保龄球 | bowling_ball | 主体完整，上下邻物残片 | 0.62 × 0.62 |
| 油桶 | oil_drum | 主体完整，顶部邻物残片 | 0.72 × 1.12 |
| 弹簧垫 | spring_pad | 主体可分离，上方和右侧大残片 | 0.90 × 0.72 |
| 猫窝 | cat_bed | 顶部轮胎残片，左侧主体贴边/截断 | 1.20 × 0.55 |
| 长颈鹿 | giraffe | 顶部角截断 | 0.75 × 2.05 |
| UFO | ufo | 右侧机体截断 | 1.70 × 0.62 |
| 火箭 | rocket | 主体完整，左侧 UFO 残片 | 0.78 × 1.75 |
| 自动贩卖机 | vending_machine | 顶部截断 | 0.92 × 1.55 |

另目视 `next_television`、`next_bowling_ball`、`next_oil_drum`、`next_rocket`：均保留颜色明暗/纹理，后三件另有邻物残片，火箭尖顶截断。其余 NEXT 的 blocked 状态来自 Manifest，未将未目视条目标记为独立视觉通过。

## 规则和代码缺口

- SPEC §8.2 指定第二批清单；§8.3 规定按累计放置/高度里程碑逐步入池，未正式解锁者可极低概率提前闯入，提前见到只记发现。未给出逐物体门槛、概率、分类或物理参数，应明确列为 R1 候选。
- `assets/batch1/object-data.ts` 的 ObjectKind / OBJECTS 和 `tower-director.ts` 的 DIRECTOR_OBJECTS 当前只有初始 12 件；没有第二批 Collider、参数或入池规则。
- `assets/batch1/play-view.ts` 的 setNext 从已导入 SpriteFrame 取对应 NEXT，不会自动去纹理、清残片或生成新物体轮廓。
- `assets/batch1/game-audio.ts` 的 impact 映射当前也只有初始 12 件。扩池时应复用现有真实材质声音，否则新物体 impact 名称找不到音频会静默。
- 当前没有累计成功放置、峰值与发现的保存链路。解锁进度和已发现须按 SPEC 分开，不能因一次提前出现就永久加入常规池。

## 输入位置与验证边界

- `source-inputs/docs/zhynd_codex_handoff/SPEC.md`：§3.3、§8.2–8.3。
- `source-inputs/art-source/这也能叠_正式美术素材包_v1/02_ASSETS/objects/object_<slug>.png`：全部 12 件独立目视。
- 同包 `02_ASSETS/next/next_<slug>.png`：上述 4 件目视；全部工程状态来自 `00_DOCS/ASSET_MANIFEST.csv`。
- 同包 `00_DOCS/OBJECT_GAMEPLAY_SCALE.json`：参考比例及末尾使用规则。
- `preparation/art/CANDIDATE_MANIFEST.json`、`EDGE_CANDIDATE_MANIFEST.json`、`USER_VISUAL_APPROVAL.json`、`preparation/tools/prepare_art.py`：核对既有处理和批准范围。

本轮没有图形修复、图片生成、运行时接触/承托/旋转校准、长局平衡或真机测试。文件存在不代表图片合格，源码可编译也不代表新物体具有可玩手感。

## R2 接入跟进（2026-09-18）

后续开发从正式素材包复制了 12 件对象和 12 件 NEXT 作为运行时候选，生成对应 Cocos image meta，并将 24 个 SpriteFrame UUID 追加到 `assets/batch0/scenes/HUD.scene`。对象数据仍严格采用 `OBJECT_GAMEPLAY_SCALE.json` 的比例，Collider 是源码中的 R2 候选几何；`preparation/tools/check_batch2_assets.cjs` 只检查文件、尺寸、meta 和场景引用。

这一步解除的是“没有运行时候选资源”的工程阻塞，不改写本轮只读审计的视觉结论，也不代表用户已确认美术或真实引擎校准通过。真实物理、挂点、旋转、NEXT 纯轮廓视觉和微信设备仍待验收。本轮截图、录屏与日志不提交。
