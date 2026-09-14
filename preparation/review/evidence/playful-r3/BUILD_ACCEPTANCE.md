# Playful R3：来源与构建验收

用户选择配乐 B，并认可 Wow、Hey、短笑三个音效，授权寻找合适时机接入。此记录覆盖来源、变更范围和实际构建；播放时机与浏览器交互由独立运行证据证明。

## 最小范围

- 保留 12 个物体、全部物理和难度参数、95 张图片、四个场景的布局。
- 替换三个现有背景音乐文件，保留其 meta 与 UUID；使用同一个 B 配器循环，三个高度区域保持一致的旋律和配器。
- 新增三个已试听的人声文件与 meta，HUD 只追加三个 AudioClip 引用。
- 修改 `game-controller.ts`、`game-audio.ts`、`game-music.ts` 接入时机、播放和压低音乐；`scene-actions.ts` 只在设置页面增加 B 音乐的 CC BY 4.0 静态署名。
- 不变更 settings、package.json、tsconfig.json 或其他工程配置。Creator 可变 profiles 单独保存基线哈希，不视作受保护源码。

沿用现有音频通道和三段背景音乐引用已经足够。没有增加新的反应事件框架、延迟队列、物理判断或高级高光识别系统。

## 基线与历史证据

改动前原 `verify_preparation.py` 实际 exit 0。`BEFORE.json` 保存 318 个含 profiles 的输入哈希，306 个运行时及配置输入与原 Batch 1C R7 成功构建完全一致。

`before/` 保存源码、场景、meta、配置、旧 1C 音频原件，以及 R7 构建、微信构建后复核和旧工具原件。旧 `record_batch1c_build.py`、BUILD_R7、BUILD_REPORT、POST_WECHAT_VERIFICATION、INTEGRITY_POST_WECHAT 均保持原哈希。

本批源码快照以 `.ts.txt` 保存，映射与原内容 SHA 见 `SNAPSHOT_LAYOUT.json`。最初 R1 局部源码归档保留 `.ts` 扩展名，意外参与工程 TypeScript 扫描并导致缺少相对模块的错误；已只修正本批 16 个证据文件的扩展名，内容 SHA 与 `BEFORE.json` 均未改变，没有修改工程的 tsconfig 或扫描配置。

新验证器继承原基线，逐项保护 298 个未授权变化的原文件。原 1C 音频检查函数使用冻结的音频文件根目录重新检查，候选、母带、处理规则和授权证据仍指向当前 preparation；该验证没有放宽旧 1C 的条件。

## 音乐与人声来源

B 为 Kevin MacLeod 的《Happy Boy End Theme》，许可 CC BY 4.0。新循环使用获批原曲的一个 32 拍段落，保留速度、音高和配器，长度 631,881 采样 / 44,100 Hz，即约 14.328 秒。循环没有包含原完整短曲两种速度之间的静音。三份 MP3 内容相同，保留旧 UUID，未在此批次加入去重结构。

验证链包含：用户试听的 B 文件 → 官方原 MP3 → 作者与许可记录 → 循环处理脚本和 WAV 母带 → 三个编码文件 → 六项运行时导入记录。人声沿用已试听文件的原字节，并验证原下载包、解包文件、许可和处理记录。

本地实际解码重新计算三个音乐的采样数量与循环接缝指标，并与处理清单逐值比较。技术接缝检查不代表主观听感或微信设备循环效果已经验收。

## 验证命令与结果边界

`preparation/tools/record_playful_build.py --verify-only` 已实际通过：312 个当前输入、298 个原文件保持不变、12 TS / 4 场景 / 95 PNG / 37 MP3。

`GATE_NEGATIVE_CHECKS.json` 记录六项只在内存注入的对抗检查。失败的 Creator / TypeScript 退出码、物理或配置变化、旧音效变化、未批准新增资源均被拒绝；检查没有写入运行时或旧证据。

实际构建完成后，`BUILD_REPORT.json` 记录调用方取得的真实退出码、Creator 最后一次开始/结束日志、日志哈希、当前全部输入/输出哈希及时间。构建产物必须晚于当前源码，旧构建不得补写为新成功。

首轮真实构建已记录于 `BUILD_R1.json`：TypeScript exit 0、Creator exit 36，2026-09-14 18:52:48 至 18:52:51，312 个输入与 213 个输出。日志保留五条诊断匹配行，包括资源库计时缺失、build-script 子进程 SIGTERM、旧编辑器窗口 JSON 恢复失败；未标注为零诊断。

首轮全量校验最初因新报告遗漏旧门禁共享的源码/场景摘要字段而失败。补齐字段后，逐项确认输入、输出、日志哈希与原 R1 全部一致，记录 `BUILD_R1_SCHEMA_UPDATE.json` 和 `BUILD_R1_SCHEMA_COMPLETE.json`；原 `BUILD_R1.json` 保持不变，未声称又进行了构建。重新运行完整 `verify_preparation.py` 实际 exit 0，结果保存于 `INTEGRITY_R1.json` / `VERIFY_R1_EXECUTION.json`。

第二轮在修复“加载中的人声被取消后仍迟到播放”后真实重新构建，记录于 `BUILD_R2.json`：TypeScript exit 0、Creator exit 36，2026-09-14 19:00:08 至 19:00:12，312 输入、213 输出。日志包含上述诊断及 MachPort / parent died 诊断，共七条匹配行，全部保存在记录中。完整 `verify_preparation.py` 再次实际 exit 0，结果保存于 `INTEGRITY_R2.json` / `VERIFY_R2_EXECUTION.json`。当前运行时音频总计 1,272,092 字节。

最终 R3 只修正设置页音乐署名与返回按钮重叠：`MusicCredits` 的 Y 坐标从 -390 调整为 -540。逐哈希比对 R2，仅 `scene-actions.ts` 改变，且文本差异只有该坐标。真实 Creator 构建 exit 36，2026-09-14 19:06:58 至 19:07:01，312 输入、213 输出；`BUILD_R3.json` / `BUILD_R3.stdout.log` 已冻结，完整门禁实际 exit 0，见 `INTEGRITY_R3.json` / `VERIFY_R3_EXECUTION.json`。当前 `BUILD_REPORT.json` 为这次 R3 构建。

R3 的工程 TypeScript 校验使用项目既有命令 `--noEmit --skipLibCheck`，实际 exit 0。之前一次漏带 `--skipLibCheck` 的命令实际 exit 2，工具返回 102 行且被截断，观察到 JSB、WebGPU 和 `cc/editor` 引擎声明错误；没有制作不存在的完整失败日志，也没有通过改源码或工程配置绕过。具体执行边界记录于 `BUILD_R3_EXECUTION.json`，不声称引擎所有第三方声明都通过类型检查。

`verify_preparation.py` 在存在本次导入清单时进入新构建验证，同时保留原素材、场景、来源和历史检查；未进入本次修订时旧验证路径保持原条件。

`ENGINE_R2.json` 的七项真实引擎检查全部通过：人声开始/结束与自然冷却、暂停/开关与模拟可见性、事故/失败取消、音乐压低与恢复、受控高度触发、自然中心叠放、音乐自然循环与三高度切换。受控高度/事故输入和模拟可见性已在各项明确标注，不等同真实塔高或操作系统后台测试。

R3 的其余 311 个输入与 R2 一致，声音、触发、音乐和物理代码均未变化；`RUNTIME_EVIDENCE_REUSE_R3.json` 记录复用这些 R2 音频证据的哈希依据，不声称重新跑过 R3 七项检查。

R3 的设置页已在实际 375×667 引擎画面人工核对：四行署名位于返回按钮下方黄色留白，无重叠、无底部裁切；Home 齿轮进入 Settings，再返回 Home 的操作通过，见 `UI_REVIEW_R3.json`。微信、真机和主观循环听感仍有独立验证边界。无上传或发布。
