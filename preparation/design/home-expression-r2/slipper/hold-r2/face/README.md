# 拖鞋持续闭眼用力 · R2 独立候选

用户本轮明确要求：短手持续扒住鸭子头，不松手；表情可爱地使劲，眼睛闭起来，嘴持续微抖，不能过一阵恢复笑脸再重新表演。

这份素材只改原拖鞋的眼睛和嘴。正式 `assets/batch0/art/home_r9_slipper.png`、鞋体、白条、高光和轮廓保持不变。未写生产文件、场景或构建。

## 最小实现

- 由内置 `image_gen` 针对同款拖鞋生成一张闭眼用力参考；只提取它的眼部与小嘴黑色材质。
- 眼睛为饱满的可爱挤眼，全闭状态不含瞳孔。嘴缩小为短小的鼓劲抿嘴，避免上一版扭结形的大嘴。
- 第一次双手接触后用 0.18 秒闭眼。此后闭眼素材完全固定，只有嘴在本地约 1 像素幅度微颤。97 像素鞋宽下每轴最大约 0.285 屏幕像素，3 Hz。
- 24 fps、1 秒持续循环；循环首尾像素完全相同，没有睁眼或空帧。初始合眼帧不再循环。
- 无全脸/鞋体抖动、无两张脸透明交叉切换。无需骨骼或新依赖。

## 接入契约

读取 `manifest.json`。`sourceSize=[340,257]`；`rect=[197,106,112,95]` 为 source 内 left/top/width/height。将所选帧直接覆盖到原拖鞋对应位置。

`frames[].timeSeconds` 为一次进入后的时间。`loopFrom=0.18`，`durationSeconds=1.18`。持续使用单调递增的角色时间：超过 1.18 秒后只在 `[0.18,1.18]` 中循环，不使用其他角色的循环起点重置脸部。

这里的 alpha 仅限定局部覆盖范围，不能再对整个脸做 fade。

## 来源和复现

- 正式图：`assets/batch0/art/home_r9_slipper.png`；SHA256 见 manifest。
- 实际提示词：`prompt.txt`。
- 内置工具生成源：`generated-cute-effort.png`。原始工具输出为 RGB，鞋外带棋盘格；该背景从未进入最终 patch。最终 patch 的真实 alpha 由局部脸部掩模生成。
- 生成文件原路径：`/Users/admin/.codex/generated_images/01a0a444-0281-7400-8a8a-6cec5b0e8763/exec-c57ccf41-6667-480c-9bbc-e5b3fd6eae18.png`。
- `generated-{left,right,mouth}-material.png` 为提取和注册的局部材质。
- `registered-clean-face.png` 为原眼/嘴被局部红色材质填平后的处理中间参考，不能作为生产整图使用。
- 复现：有 Pillow/numpy 的 Python 执行 `bake_closed_effort.py`；只写本文件夹。

## 检查和自查

`checks.json` 包含源哈希、保护区域、循环首尾一致及仅嘴变化检查。

`closed-composite.png`、`contact-sheet.png` 为原尺寸复合；`phone-contact-sheet.png`、`phone-loop.gif` 为手机小尺寸。自查闭眼眼形可读，嘴较原大张嘴更小、更像鼓劲。小嘴颤动刻意克制，不把全脸抖成抽搐。

技术检查不能证明最终可爱程度，仍需与双手动作合成后正常速度审核。当前为独立小样候选，没有更新正式首页。
