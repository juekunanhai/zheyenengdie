# 落地反馈素材 R1

这批是为落地反馈生成的两张正式运行素材。沿用正式包蓝白软尘团、暖金接触环的质感；正式包原 FX 带相邻图碎片和切边，未直接用于游戏。

- `fx_landing_dust_r1`：256 × 256，蓝白小尘团。建议真实承托接触处左右各一小团，快速向外散开并淡出。
- `fx_landing_ring_r1`：256 × 128，透明中空细环。建议仅较重落地短暂扩散，避免普通接触连续闪烁。
- `alpha-review.png`：深蓝、天蓝背景上的运行尺寸检查图。

生成使用内置 `image_gen.imagegen`，完整提示词和原文件位置见 `generation.json`。生成器输出的透明区域含孤立低 alpha 噪点；按用户本地处理授权，仅保留主体连通区域和其 3 像素抗锯齿边缘，清除孤立像素、裁边、等比缩小、留透明余量，未重绘主体。原始生成图保持不变并保存在本目录。

`process_assets.py` 可从本目录原图重现运行图和 Cocos metadata，使用 Pillow、NumPy。运行图、原图、参考图和 metadata 哈希在 `ART_MANIFEST.json`。HUD 场景仅追加两张 SpriteFrame 引用。其他场景、正式原始素材、物理参数均未修改。

检查结果：两张运行图均为 RGBA，四边完全透明，主体无切边、无邻图残片；在深浅游戏背景上无黑底和白色矩形边缘。引擎动态大小、时长和遮挡验收由主任务完成。

补充背景云：`fx_backdrop_cloud_r1.png`（512 × 192）采用完整、细长、柔软轮廓，避免移动时出现截断底边。仅替换 HUD 的 `HeightBackdrop.cloudFrame`，首页云和旧图片未改变。内置生成工具的原图与提示词见 `cloud-generated.png`、`cloud-generation.json`；本地处理复现见 `process_cloud.py`，哈希与透明检查见 `BACKGROUND_CLOUD_MANIFEST.json`，深浅背景预览见 `cloud-alpha-review.png`。
