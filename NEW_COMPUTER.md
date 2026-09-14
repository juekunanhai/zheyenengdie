# 新电脑恢复开发

本仓库保存当前完整 Cocos 工程、运行素材、准备文档、历次设计与音频来源，以及项目引用的原始交接包和生成原图。素材直接使用普通 Git 保存，**不需要 Git LFS 或额外网盘下载**。

## 1. 获取工程

新电脑安装 Git，并用有仓库访问权的 GitHub 账户登录或配置该电脑自己的 SSH 密钥：

```sh
git clone git@github.com:juekunanhai/zheyenengdie.git
cd zheyenengdie
```

Windows 如果提示路径过长，改用较短目录，并使用 `git -c core.longpaths=true clone git@github.com:juekunanhai/zheyenengdie.git`。不要放入会自动改写文件的同步盘目录。

此次上传使用账户 `juekunanhai`。SSH 私钥、微信登录态、Cocos 登录态没有放入仓库；新电脑需要自己登录。当前电脑使用的密钥指纹是 `SHA256:uVLUvuxZ7/I7RKUF2M7y5eoU0nsKKA01fISQNsGKT4s`，它是身份标识，不是可用于登录的密钥。

安装 Python 3 后，可以先检查文件是否完整（仅用标准库）：

```sh
python3 tools/verify_checkout.py
```

Windows 可用 `py -3 tools/verify_checkout.py`。该命令核对初次交接清单，包含源码、`.meta`、运行素材与原始源包；不会启动引擎或修改文件。以后主动开发改动文件后，出现差异是预期现象，应结合 `git diff` 判断，不要为了“通过”恢复掉正确修改。这个清单是交接基线，不是自动更新的游戏测试。

## 2. 用 Creator 开发

1. 从 Cocos 官方渠道安装并登录 **Cocos Creator 3.8.8**。
2. 在 Dashboard 中添加/打开本仓库根目录，即包含 `package.json`、`assets/` 的目录。
3. 等待 Creator 首次导入全部资源，打开 `assets/batch0/scenes/Home.scene`。
4. 点击编辑器预览即可从首页进入对局。项目没有必须另行 `npm install` 的运行依赖；引擎及 TypeScript 环境由 Creator 提供。

必须保留全部 `.meta` 文件，它们保存场景、脚本、Sprite 和音频的 UUID。`library/`、`temp/`、`profiles/` 是本机导入/编辑状态，`build/` 是构建输出，均由本机重新生成。`tsconfig.json` 引用 `temp/tsconfig.cocos.json` 是正常的 Creator 工程结构；先打开 Creator，不能用复制旧缓存来替代首次导入。

当前工程：95 张运行 PNG、38 个 MP3、12 个 TypeScript、4 个场景，Box2D WASM。当前功能与待验项从 [README](README.md)、[批次计划](preparation/docs/BATCH_PLAN.md) 和 [微信 R2 验收](preparation/platform/wechat-r2/REVIEW.md) 阅读，早期文档中的“尚未开发/待确认”只代表其历史时点。

## 3. 微信构建

已提交构建配置 `preparation/platform/wechat-build.json`：AppID `wxc0360e0c829a3307`、竖屏、调试模式、Home 启动、main 资源分包。

可在 Creator 构建发布面板导入这个配置，或使用该电脑的 Creator 可执行文件运行 CLI。macOS 示例（实际安装路径可不同）：

```sh
CREATOR_EDITOR='/Applications/CocosCreator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator'
"$CREATOR_EDITOR" --project "$PWD" --build "configPath=$PWD/preparation/platform/wechat-build.json"
```

Windows PowerShell 使用实际的 `CocosCreator.exe` 路径：

```powershell
& 'C:\你的安装目录\CocosCreator.exe' --project "$PWD" --build "configPath=$PWD/preparation/platform/wechat-build.json"
```

Creator CLI 成功构建可能返回 **36**，不能只按通用的“非零即失败”判断；同时查看构建日志与生成产物。构建后安装并登录微信开发者工具，以**小游戏**导入 `build/wechatgame`。

GitHub push 不等于微信上传/发布。当前还没有最终微信压缩包和真机通过结论；触摸、完整音乐生命周期、手机安全区、扬声器与长局性能待后续验收。

## 4. 浏览器审阅页

`preparation/review/` 和 `preparation/design/` 内有历史审阅页。静态设计和音频文件均已提交；引用 `build/web-mobile` 的引擎试玩页，需要先在 Creator 以 Web Mobile 平台构建到默认 `build/web-mobile` 目录，并选择 Home 启动。

从仓库根目录启动本地服务：

```sh
python3 -m http.server 8767 --bind 127.0.0.1
```

然后打开 `http://127.0.0.1:8767/preparation/review/home-music-r4.html`。审阅页和正式小游戏不同，不要直接双击 HTML 后将浏览器跨文件限制当作游戏缺陷。

## 5. 原始素材与历史工具

- `assets/`：当前实际使用的游戏源码与素材。
- `source-inputs/art-source/`：用户提供的完整正式美术包，含 179 张原始 PNG 和尺度/组成/抓手规则。
- `source-inputs/docs/`：用户提供的交接规格、跨平台文档和设计参考。
- `source-inputs/generated-images/`：项目记录中引用的生成原图。
- `source-inputs/SOURCE_INDEX.json`：原路径到仓库相对路径及 SHA-256 的对应清单。
- `preparation/`：派生素材、音频源文件与许可、设计迭代、审阅页、工具、历史验收证据。

正式原包和生成原图用于继续制作、重绘和溯源；Creator 的当前运行直接使用 `assets/`，不依赖旧电脑 Downloads 或 Codex 目录。

旧 `preparation/tools/` 和历史证据可能记录 `/Users/admin/...`、Codex 运行时路径或旧构建哈希，不能在新电脑不加检查地批量执行。有些加工脚本会覆盖素材，有些历史门禁锁定脚本自身哈希。这次没有篡改它们以伪造可重放；需要重做某个加工步骤时，从 `SOURCE_INDEX.json` 定位仓库内源文件，再对那个步骤作最小路径修正。

仅当需要重新加工素材时，才需要 Python 的 NumPy/Pillow/python-docx、FFmpeg 或 Node 等工具。编辑和运行游戏不依赖这些加工工具。旧电脑记录的版本是 Python 3.12.14、NumPy 2.3.5、Pillow 12.3.0、python-docx 1.2.0、FFmpeg 9.0.1、Node 24.19.0；具体加工步骤仍需核对其脚本依赖，不以这个列表代替执行验证。
