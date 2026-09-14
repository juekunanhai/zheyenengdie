# 六物体验证：马桶与哑铃资产审查

日期：2026-09-13。范围：新增两件的正式来源核查、必要新图生成、透明边缘清理、NEXT 与几何映射。未启动 Cocos、未改引擎 assets、未改原始素材或正式比例文件。新图是完整制作的候选资产，不是占位图；自查通过不代表用户已签收或物理已通过。

## 最小方案与复杂度

正式旧图均缺少主体边缘，并且透视与本批所需的可读承托形状不一致。直接使用会重新产生悬空/碰撞不符问题。采用用户已授权的必要补图能力：内置 imagegen 仅输入文字，分别生成独立透明 PNG，不上传原文件，不从历史 UI 或首页插画抠取游戏图。随后本地清理 Alpha 噪点，保持 RGB 材质和等比缩放，基于同一个 Alpha 导出纯色 NEXT。两图及一份几何数据已足够，无需额外资产服务或 3D 管线。

## 已阅读的正式规则

根目录：`/Users/admin/Downloads/zheyenengdie/art-source/这也能叠_正式美术素材包_v1/00_DOCS/`。

- README_CODEX.md
- ASSET_MANIFEST.json（完整读取结构与规则，重点复核两个 Sprite 与两个 NEXT 的逐项状态）
- OBJECT_GAMEPLAY_SCALE.json
- FINAL_UI_COMPOSITION_RULES.json
- CLAW_RUNTIME_RULES.json

原尺寸基线是马桶 85×115、哑铃 115×45 世界单位。PNG 尺寸不决定物理比例；本次新增候选等比投影的宽度差异需显式记录，不覆盖原始比例文件。NEXT 仅有纯轮廓，不烤入名称、重量或难度。抓手与物体保持独立。

## 正式来源与旧候选复核

| 项目 | 原始 PNG | 旧清理候选 | 实看结论 |
|---|---|---|---|
| 马桶 Sprite | 346×361；Alpha 非零边界 `[0,8,338,361]` | 277×302；边界 `[4,4,273,298]` | 底座仍被水平截断；竖起盖板占据高处，不能直接当作新方案的宽平水箱顶与低台阶。阻断直接导入。 |
| 哑铃 Sprite | 352×301；边界 `[0,8,344,293]` | 346×229；边界 `[4,4,342,225]` | 左端面被截断；斜透视令两端最低点不在同高。阻断直接导入。 |
| 两个原 NEXT | 马桶 241×259，哑铃 241×271 | 与各自清理 Sprite 同尺寸/同 Alpha | 原 NEXT 带纹理及残片；清理 NEXT 虽为纯色，但继承缺边，不可用轮廓掩盖主体缺损。 |

原图路径：

- `/Users/admin/Downloads/zheyenengdie/art-source/这也能叠_正式美术素材包_v1/02_ASSETS/objects/object_toilet.png`
- `/Users/admin/Downloads/zheyenengdie/art-source/这也能叠_正式美术素材包_v1/02_ASSETS/objects/object_dumbbell.png`
- `/Users/admin/Downloads/zheyenengdie/art-source/这也能叠_正式美术素材包_v1/02_ASSETS/next/next_toilet.png`
- `/Users/admin/Downloads/zheyenengdie/art-source/这也能叠_正式美术素材包_v1/02_ASSETS/next/next_dumbbell.png`

工程旧候选位于 `preparation/art/candidates/{objects,next}/`；`VISUAL_REVIEW.json` 的两件状态均是 `blocked_source_incomplete`。`ART_REPAIR_REPORT.md` 的 P2 接受清单未包含它们。后来的 R9 只新增首页组装插画，也未形成可用于游戏的独立 Sprite。`geometry.html` 是四物体历史候选，无这两件的物理验收。

## 新图与实际映射

四份可供本批导入的文件均位于以下绝对目录：

`/Users/admin/Desktop/douchao/my-project/wechatgames/die/preparation/design/gameplay-shapes/assets/`

| Sprite / NEXT | PNG 尺寸 | Alpha≥128边界 | 采用物理候选宽高 | Sprite世界宽高 |
|---|---|---|---|---|
| object_toilet.png / next_toilet.png | 615×784 | `[9,9,606,775]` | 89.627937×115 | 92.330287×117.702350 |
| object_dumbbell.png / next_dumbbell.png | 784×251 | `[9,9,775,242]` | 147.939914×45 | 151.416309×48.476395 |

两件 `spriteOffset=[0,0]`。每张图采用单一像素到世界缩放系数，未非等比拉伸。物理候选保留原名义高度，再按可见比例确定宽度：马桶相对旧宽 +5.444632%，哑铃 +28.643404%。这是本批新形状候选的尺寸，不是声称原文件比例已如此；根代理已选择本映射。若强制保留旧宽，实际可见高度会降至约109.06/34.98，因此该映射仅留说明，不接入。

马桶拥有高处平水箱、低处闭合座盖、完整平脚；表情与白蓝釉面兼顾轻松和材质感。哑铃拥有水平同高的两块蓝色包胶端头、细金属杆和上下真实凹口。原始生成 PNG 另存为 `*.generated.png`。两个新图均已实看；RGB 采用原生成材质，只对透明噪点进行局部清理和等比缩小。

## 几何候选与自检

完整机器可读映射见 [GEOMETRY.json](GEOMETRY.json)。坐标为局部世界 x向右/y向上，轮廓逆时针，每件36点，单连续、无洞，不使用包住所有凹口的凸包。马桶保留水箱与座盖的台阶以及底部颈部凹面；哑铃保留上下中部凹口，两个底面和两个顶部水平段同高。

- 两个多边形无自交；逆时针面积为正。
- 叠加图：[马桶](toilet-geometry.png)、[哑铃](dumbbell-geometry.png)。绿色线仅为自查叠加，不进入游戏 Sprite。
- 轮廓填充超出 Alpha≥128 区域的像素比例分别约1.166%/0.808%；圆角和细碎高光边经过简化，需运行接触复查，不能用该比例代替物理验收。
- NEXT 的 RGB 固定为 `(216,231,248)`，Alpha 与 Sprite 相同，透明留边相同。
- 未验证刚体质量、重心、摩擦、凹多边形拆分后的多接触计数、90°抓手挂点、球与台阶/凹槽接触或人类玩法收益。这些由本批工程验证完成。

## 追溯文件

- [SOURCE.json](SOURCE.json)：内置工具模式、每次完整提示词、原始生成路径及选择理由；无参考图上传。
- [ASSET_MANIFEST.json](ASSET_MANIFEST.json)：源哈希、成品哈希、裁切区、等比缩放、边界及候选状态。
- [prepare_assets.py](prepare_assets.py)：可复现的本地 Alpha 清理、8px留边、纯轮廓导出。
- [prepare_geometry.py](prepare_geometry.py)：原始选点与精确物理映射。
- [GEOMETRY_CHECK.json](GEOMETRY_CHECK.json)：自交、凹点数量、Alpha重叠检查。

现有正式源与旧修复候选均保持原样。没有将来源包的历史 READY 标签、新图文件存在或自查通过当作用户主观签收。
