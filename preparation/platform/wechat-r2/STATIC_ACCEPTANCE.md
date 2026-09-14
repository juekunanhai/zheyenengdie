# 微信 R2 本地构建与静态验收

本轮获准仅执行已评审的两项微信构建配置及开发者工具验收：明确从 Home 启动、将 main 资源包设为分包。未获准上传、预览上传、远程资源托管或发布。

## 基线与范围

改动前原 Home R4 的构建完整性检查实际 exit 0，314 个运行时/配置输入、214 个 Web 输出与原成功记录逐项一致。`BEFORE.json` 保存其哈希、12 个 profiles 哈希、原微信配置及原微信产物/报告哈希；`before/` 保留旧微信 214 个产物和相关证据，源码副本均以 `.ts.txt` 保存。

实际配置差异严格只有：

```json
{
  "startScene": "b35d6350-0c9c-52a9-8eab-897e6f0d1d60",
  "mainBundleCompressionType": "subpackage"
}
```

314 个原文件内容全部保持不变，包含 12 个 TS、4 个场景、95 张 PNG、38 个 MP3 和全部 meta；214 个 Web 产物逐哈希保持不变。Creator 仅重写了内容完全相同的 `engine.json` 时间戳，profiles 内容未改变。原 R4 构建报告和记录器没有被修改，也没有把旧 Web 构建标为新构建。

## 真实 Creator 执行

`PROCESS_RESULT.json` 记录原始 subprocess 返回码 36；`COMMAND.json` 保存确切 argv 及配置哈希。实际进程为 2026-09-14 20:11:47–20:12:03，Creator 日志中的构建开始/完成为 20:11:57–20:12:02，成功标记与产物时间独立检查。

本轮没有修改 TypeScript，也没有声称重新执行类型检查；源码哈希继承 Home R4 已记录的项目 `--noEmit --skipLibCheck` 校验。

`CREATOR_OUTPUT_SNAPSHOT.json` 在 Creator 完成且尚无较晚工具写入时保存 230 个输出哈希。`CREATOR_FILE_SIZES.json` 在逐项确认仍为同一哈希后保存各文件原始字节数，后续即使开发工具修改私有配置，也不会污染该尺寸口径。生成的 game/project/settings 及两个 bundle 配置另存于 `generated-after-creator/`。

## 配置实际效果

- AppID 为 `wxc0360e0c829a3307`，竖屏，调试构建；启动场景为 `db://assets/batch0/scenes/Home.scene`。
- `settings.assets.preloadBundles` 为 `main`，且未配置远程 bundle 或服务器。
- 构建器实际派生出 `main` 和 `internal` 两个子包；`game.json` 的路径、settings 的子包名称和各子包的 config 名称相互一致。
- 本轮没有额外添加 internal 配置。生成的 internal 包含 settings 声明的全部 18 个引擎内置资源，main 承载游戏脚本与已引用素材。此处依据两项配置差异和实际生成结果说明结构，不声称检查过构建器私有实现。

## 代码、素材与物理

微信 `subpackages/main/game.js` 与当前 Web `assets/main/index.js` 完全同字节：181,625 字节，SHA-256 为 `3454b5d6d14753578626a7bc4c660e2087b529d094fd5b1a147e1ccef8d6b012`。对局、音频和物理源码均未改变。

38 个音频按各自 AudioClip UUID 找到微信 native 文件，逐项与源文件核对一致，包括首页 A、对局 B 和人声。73 个实际引用的 PNG 内容与 Web 相同；其余 22 张源图未被当前场景引用，和 Web 的使用集合一致，没有在本轮删除或重绘。

唯一 Box2D WASM 为 179,504 字节，与旧微信构建的二进制 SHA-256 相同。引擎配置仍选择 `physics-2d-box2d-wasm`。这些是声明与字节证据，不代替开发工具或真机的实际物理加载测试。

## 原始体积口径

| 范围 | 文件数 | 未压缩字节 |
| --- | ---: | ---: |
| 微信主包：排除下面两个子包 | 21 | 4,612,561 |
| 资源子包 main | 193 | 26,340,996 |
| 引擎内置资源子包 internal | 16 | 227,197 |
| 全部 | 230 | 31,180,754 |

WASM 位于微信主包。原始图片合计 23,843,955 字节，音频合计 2,233,859 字节。这里的 `main` 是资源子包名称，与“微信主包”含义不同。

以上是构建目录的原始文件字节，**不是开发工具压缩包、上传包大小，也不是体积限制通过结论**。实际工具体积检查和运行结果由本轮独立工具证据记录。

本次日志保留三条诊断匹配行：两条资源库计时缺失，以及一条 build-script 子进程 SIGTERM；没有宣称零诊断。静态门禁实际 exit 0，初始记录冻结为 `BUILD_CREATOR_STATIC.json`，执行依据见 `STATIC_VERIFICATION_EXECUTION.json`。四项只读内存对抗检查均拒绝额外配置、物理源码变化、Web 产物变化和失败 Creator 退出码，见 `NEGATIVE_CHECKS.json`。

静态门禁只证明范围、来源、配置声明和当前文件完整性；不证明真机、发布或历史引擎测试重新运行。
