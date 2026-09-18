# 首页小样 R2：主云运动层

只用于独立动作小样，不改生产 assets、Cocos 场景、构建或物理逻辑。

最终使用 `manifest.json` 中的 5 个文件。背景上最醒目的静态云原先已经烘焙在 `home_r10_background.png`，因此仅移动额外的小云无法解决用户反馈。本方案把最上方 426 行的天空修补为连续同色天空，并以完整的正式 `home_r9_cloud.png` 重新组成四组可独立移动的云。

## 图层合同

所有坐标均为原背景 941×1672 像素。按同一比例一起缩放到 Canvas。

1. `background-no-near-clouds.png`：不透明底图。
2. `moving-cloud.png`：完整正式云素材，文件与源资产逐字节一致；各组位置、大小、透明度和建议速度在 manifest 的 layers 中。
3. `moving-sky-mask.png`：云专用离屏 Canvas 使用 destination-in 合成的 RGBA alpha mask。上方纯天空可以移动，左屋顶/右气球边缘受遮挡，426 行以下全透明。
4. `city-foreground.png`：可选替代方案，在云后绘制的原图城市前景。若已经使用 mask，不必重复绘制。

大云建议在原图坐标每秒向右移动 10–12 px，手机约 4–5 px/s；远处小云更慢。同方向、不同速度、不上下漂浮、不缩放。循环时必须完全离开画面才回到另一侧，始终用完整云轮廓，不能露出一条垂直切断边。

## 验证

- 查看 `comparison.png`：原图、去云底图、初始组合、右移 12 秒。
- 查看 `motion-offsets.png`：固定背景下 0、6、12、24 秒的上半屏，均以 375 手机宽度缩小。
- `checks.json` 确认 426 行以下的 1,172,486 个像素完全保留；上方不透明屋顶/气球区域使用原像素；移动云与正式源图文件一致。
- 中下部远处的云和薄雾保留原图，作为静态远景；本批没有重绘城市轮廓。
- 天空颜色、顶部云构图相对原图有调整，因此仍属于小样的视觉候选，不能把像素检查当作用户审美通过。

## 可追溯性

内置 image_gen 的真实提示词、输入和输出路径见 `prompt.txt`；`generated-clear-sky.png` 是生成的无云天空 donor，生成像素仅用于天空修补。`build_layers.py` 可复现背景匹配、原城市遮挡和合成检查。

目录中 `upper_left.png`、`upper_right.png`、`upper_wisp.png`、`left_middle.png`、`city-front-sky-band.png` 是被否决的早期局部云抠图，不在最终 manifest 内，禁止作为当前小样输入。该方案因蓝色多边形补片及边缘云断头问题被弃用。最终文件改用连续天空和完整正式云。
