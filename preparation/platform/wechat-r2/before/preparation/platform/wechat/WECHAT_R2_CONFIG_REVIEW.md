# 微信第二轮配置差异（待确认，尚未执行）

首轮 Creator CLI 已实际退出 36，完整原始产物统计为 30,807,615 B，其中 PNG 23,843,955 B、MP3 1,870,065 B、JS 4,676,603 B。首轮没有分包，默认启动 HUD；不能把本地构建成功当成主包可发布。

最小方案仅在原配置增加两项；候选文件为 [wechat-build-r2.candidate.json](../wechat-build-r2.candidate.json)。AppID、竖屏与 `debug: true` 保持原配置。

```json
{
  "startScene": "b35d6350-0c9c-52a9-8eab-897e6f0d1d60",
  "mainBundleCompressionType": "subpackage"
}
```

`startScene` 的 UUID 来自当前 `assets/batch0/scenes/Home.scene.meta`，用于明确先进入获批首页。第二项把 Cocos 内置 main Asset Bundle 构建为微信子包，而不是创建新的游戏资源加载结构。不会移动项目资源目录、改图片像素或物理、修改既有 Web 构建配置。

[官方命令行文档](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-in-command-line.html) 定义上述两个字段。[官方小游戏分包文档](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/subpackage.html) 说明小游戏分包构建与平台限制；本机 Cocos 3.8.8 的 `app.asar/node_modules/@cocos/creator-types/editor/packages/builder/@types/public/options.d.ts` 还明确将 `subpackage` 列为 `BundleCompressionType` 值。该安装版本同时具有此字段和选项，不是猜测配置键。

默认自动加载链已只读核对：当前生成 `application.js` 调用 `cc.game.init`；本机引擎 `cocos/game/game.ts` 的 `_loadProjectBundles` 读取 `assets.preloadBundles` 并调用 `assetManager.loadBundle`。当前预加载项已经是 `main`。小游戏适配器 `platforms/minigame/common/engine/AssetManager.js` 对配置中的子包调用 `loadSubpackage`，微信 `wrapper/fs-utils.js` 最终调用 `wx.loadSubpackage`。因此 main 分包仍由引擎启动链加载，无需新增业务加载器。下一次实际构建仍必须核对 `game.json`、`settings.json` 和工具运行，不能仅凭代码链宣布分包运行成功。

是否需要更复杂方案：目前不需要。`PACKAGE_ESTIMATE_R2.json` 通过本机 Cocos 自带 Terser 对现有 JS **仅在内存中**去注释/空白，不启用语义压缩或变量改名，也没有写回任何 JS。估算把当前 `assets/main` 归为子包后，余包原始约 4.840 MB，格式压缩后约 3.311 MB。生成的 `project.config.json` 已有 `setting.minified: true`，无需新增猜测性的 Cocos `minify` 字段。这个估算不是微信工具打包结果，不能签收 4M 限制；它仅支持先尝试两项最小差异，而不是先加 WASM 分包、改为非调试模式或损失画质。

下一轮必须实际确认：

1. 输出仍为用户 AppID、portrait，首页为 Home。
2. 生成 main 子包声明、预加载 main 与本地 bundle 路径一致；微信工具冷启动可进入 Home，再进入 HUD。
3. 微信工具实际统计主包和总包尺寸，包括引擎、WASM、图片、音频及代码，排除工具私有配置的口径由工具确定；不以 1.87 MB 音频单项或本估算代替。
4. 所有 PNG/MP3 内容仍与原构建一致，运行源代码不变；既有 Web 产物/设置/profile 内容变化须记录。
5. 若真实主包仍超限，再根据占用明细提交下一项必要差异；本候选未授权引擎分离、WASM 分包、资源远程部署或发布。

用户确认该候选之前，不替换原 `wechat-build.json`，不执行第二轮 CLI 构建。
