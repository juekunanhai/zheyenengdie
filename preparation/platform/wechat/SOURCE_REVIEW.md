# 首次微信本地构建依据

2026-09-14。用户已确认 AppID、竖屏调试配置、Creator 本地构建与开发者工具导入；本步骤只执行 CLI 构建。没有上传、发布或远程资源部署。

最小方案是直接采用已经评审的 `preparation/docs/BATCH1C_WECHAT_CONFIG_REVIEW.md` JSON，另存 `preparation/platform/wechat-build.json`，使用官方 `--build configPath=...` 参数。没有设置分包、远程服务器、引擎插件、自动运行或新增业务代码。当前不需要额外资源加载层；包体结果必须以本次实际产物与开发者工具为准。

已查阅 [Creator 3.8 命令行文档](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-in-command-line.html)：`configPath` 读取 JSON 构建参数，各平台字段位于 `packages`，成功退出码为 36。未指定参数使用默认值。

已查阅 [Creator 3.8 微信构建文档](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-wechatgame.html)：`appid` 写入生成的 `project.config.json`，`orientation` 写入 `game.json`；文档给出的主包限制包括代码和资源，不能只对音频体积作判断。首次生成目录不代表微信打包、真机或发布验收通过。

安装包独立核对：Cocos Creator 3.8.8 的 `app.asar/modules/platform-extensions/extensions/wechatgame/package.json` 对应插件 1.0.4；其 `@types/index.d.ts` 声明 `ITaskOption.packages.wechatgame: IOptions`，其中 `appid: string`，`orientation` 包含 `portrait`。草案字段与本机安装版本一致。

`COMMAND.json` 保存完整参数数组与显示命令；`PROCESS_RESULT.json` 保存 Creator 子进程真实退出码；`BUILD.stdout.log` 保留 stdout/stderr 全文。`BEFORE.json` 保存本次构建前运行资源、设置、项目文件、profile 与既有 Web 产物的哈希。后续资源统计不会把原始文件总量、Web 产物、微信主包与微信最终压缩上传包混为一项。
