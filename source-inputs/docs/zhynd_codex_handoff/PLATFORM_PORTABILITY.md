# 跨平台架构与迁移红线

修订：2026-09-12-R2。本章与 PLATFORM_PORTABILITY.md 同步。只在实际接入能力时建立必要平台接口，不提前实现未用平台或 SDK。

### 34.1 产品定位

从架构层面把本项目定义为：

> **跨平台 Cocos 游戏，微信小游戏首发。**

Cocos Creator 负责尽可能复用渲染、玩法、物理、UI 和资源；登录、广告、分享、存储、云服务、排行榜、分析、生命周期等平台能力必须隔离。

目标适配顺序建议：
1. 微信小游戏（V1 首发）。
2. 抖音小游戏。
3. Android / TapTap。
4. 根据数据再评估 vivo / OPPO / 华为小游戏、H5、Windows 等。

### 34.2 核心层禁止平台 API

以下目录不得直接出现 `wx.*`、`tt.*`、TapTap SDK、Android SDK 或平台全局对象：

- `src/game/`
- `src/physics/`
- `src/director/`
- `src/data/domain/`
- 通用 UI 逻辑

下列为按功能批次逐步形成的平台能力边界，Batch 0 只实现实际使用部分，不要求提前建立全部服务骨架：

```ts
interface PlatformAdapter {
  lifecycle: LifecycleService;
  auth: AuthService;
  ads: AdsService;
  share: ShareService;
  storage: StorageService;
  cloud: CloudService;
  leaderboard: LeaderboardService;
  analytics: AnalyticsService;
  device: DeviceService;
}
```

平台实现：

```text
platform/
├─ contracts/
├─ wechat/
├─ douyin/
├─ native/      # Android / TapTap 等
└─ web/
```

**禁止“先到处写 wx.xxx，以后再抽”。** 抽象必须从第一次接平台能力时开始。

### 34.3 身份体系不能把 OpenID 当全局用户 ID

微信 OpenID、抖音用户 ID、TapTap/原生账号不是同一身份空间。

内部数据至少使用：

```ts
type PlatformType = 'wechat' | 'douyin' | 'taptap' | 'android' | 'web';

interface PlatformIdentity {
  platform: PlatformType;
  platformUserId: string;
}
```

数据库唯一键不得只用 `openid`。

如果未来需要跨平台账号合并，再引入独立 `globalUserId` + identity binding；V1 不需要提前做复杂账号系统，但数据模型必须允许未来绑定。

### 34.4 后端可先用微信云，但接口必须平台中立

V1 可以利用微信云开发降低成本，但：

- gameplay 不直接 `wx.cloud.callFunction()`。
- 统一经过 `GameBackend` / repository 接口。
- 云函数入参/出参不要出现只有微信才有意义的字段命名。
- `platform` 必须作为请求上下文之一。
- 服务器时间、配置版本、客户端版本统一管理。

这样以后可将实现换成独立后端，而不重写游戏核心。

### 34.5 排行榜提前预留 platform 维度，但 V1 仍最后开发

排行榜仍然是 **V1 最后一批次**。

数据至少预留：

```text
platform
mode
seed / rulesVersion
seasonMonth
clientVersion
height
techScore
achievedAtServer
```

未来可以配置：
- 全平台共榜。
- 平台分榜。
- 某平台暂时不上榜。

不要把“微信榜”写死到 domain model。

### 34.6 Seed 与物理验证

相同 seed 用于复核普通模式的抽取与导演结果，不承诺跨平台逐帧一致。JS/Native、帧率、浮点和物理后端差异都可能导致长局分叉。

反作弊不依赖服务端重跑 Box2D 得到相同高度；校验合法物体序列、事件顺序、时长范围、合法高度和关键摘要。每日挑战、挑战榜及共享当日 seed 均排除。

### 34.7 固定物理时间步与整塔模拟

Batch 0 锁定 Cocos 3.8 补丁和物理后端，优先使用引擎自带固定 timestep、最大子步与累积时间管理；不叠加另一套自动物理步进。

渲染 30/60/90/120 Hz 不直接改变物理步长；回前台丢弃异常 deltaTime 并限制追赶，避免塔突然失控。

所有有效塔体包含屏幕外塔底，允许正常休眠；不得因为不可见就删除或改成静态底座。已经判失效的掉落物不再与下方塔体碰撞。

深层辅助使用 SPEC 第 6.5 节的距离加权角阻尼与正常 1 倍逻辑尺度；辅助上限待标定，不承诺任意结构的影响严格按距离递减。

### 34.8 生命周期必须统一

所有平台必须映射到通用状态：

```text
ACTIVE
INACTIVE
BACKGROUND
RESUME
DESTROY
```

进入后台时：
- 暂停物理。
- 暂停规划倒计时。
- 淡出/暂停 BGM 与循环环境音。
- 不把后台时间计算进玩家操作超时。

恢复前台时：
- 恢复 Audio 状态。
- 丢弃异常大的 deltaTime。
- 校验当前广告/分享回调是否仍有效。

### 34.9 广告不可成为强依赖

Rewarded Ad 接口必须处理：

- 广告不可用。
- 无填充（no fill）。
- 加载失败。
- 用户取消。
- 播放失败。
- 回前台后 callback 延迟。
- 平台不支持该广告位。

**广告失败不能卡死游戏。**

例如复活广告不可用时，应正常允许玩家结束并进入结算，而不是无限 loading。

不同平台广告频率和政策通过 Remote Config / platform config 管理，不写死在 gameplay。

### 34.10 普通成绩分享与能力降级

Batch 3 首次接入分享即通过 Adapter。SharePayload 按当前需要包含 shareType、runId、targetHeight、普通 mode、image/poster 和平台支持时的 route token。

不包含每日挑战或挑战榜入口。支持目标高度链接时进入普通游戏；不支持时降级为平台允许的海报或分享形式。核心玩法不依赖可靠的“分享成功”回调，首版不强绑分享奖励。

### 34.11 安全区、分辨率与输入

- 竖屏优先，测试刘海/挖孔、顶部胶囊和不同纵横比；HUD 基于安全区，顶部挂牌、左下道具、右下技能保持位置。
- 统一 InputService 做屏幕到游戏世界坐标转换；游戏区松手释放，旋转按钮独立消费事件，不把点击物体当成旋转。
- 首局前两件教学免自动释放，后台与暂停不计时；免计时不暂停物理。
- 正常 1 倍逻辑游戏区与演出镜头分开：事故开始固定死亡边界、观察集合与阈值。0.75 倍演出、平移、震动不改变判定。
- HUD 不随演出缩放；正常镜头移走旧塔不算掉落。不同设备按统一逻辑尺度评估边界与辅助，不把物理行为绑定到原始像素数。

### 34.12 本地存储必须抽象

不同平台本地存储、文件系统、缓存额度和清理策略不同。

区分：
- `LocalSettings`：音量、震动、引导完成等，可重建。
- `LocalCache`：远程资源缓存，可清理。
- `PlayerProgress`：图鉴、奖励状态、最好成绩等重要数据，后期应以上云数据为准。

不要把重要用户资产只存平台本地缓存。

### 34.13 资源包不能把微信限制写死

Cocos Asset Bundle 可以映射到多个小游戏平台分包，也可用于本地/远程资源；但不同平台的包体、分包和远程资源限制并不相同。

因此：
- 资源按逻辑 Bundle 划分，不按“微信 4MB”直接硬编码目录结构。
- 每个平台有自己的 build profile。
- 构建时检查 main/subpackage/remote 大小。
- 不假设微信分包配置能原样复制到抖音/原生。
- 远程 Bundle 的 host、版本和 cache key 都从平台配置注入。

### 34.14 音频能力与生命周期

AudioService 统一处理首次用户交互启动、后台/前台中断、原生音频焦点、音乐和音效独立开关保存、短 SFX 并发及同一接触限流。

Batch 1 交付同主题城市/云层/太空编配平滑切换及核心声音；实时多 stem 后置，不提前建设同步框架。恢复不能重新开启用户已关闭的声音或补播后台积压事件。

音频失败不能阻塞游戏，但不能标音频验收通过。各平台分别验证格式、解码、循环接缝、过渡和实际听感；源文件与运行时压缩版分离。

### 34.15 Build Profile 与密钥隔离

不要在源码硬编码：
- 微信 AppID。
- 抖音 AppID。
- 云环境 ID。
- API base URL。
- CDN 地址。
- 广告位 ID。
- TapTap client ID / 原生 SDK 配置。

Batch 0 只建立当前微信开发/发布实际需要的配置；其他平台上线时再新增对应文件。例如：

```text
config/platform/
├─ common.json
├─ wechat.prod.json
└─ wechat.dev.json
```

敏感 secret 不提交仓库；客户端中本来就无法保密的公开 ID 也必须通过构建配置注入，避免散落代码。

### 34.16 本地调优配置与后续远程实现

当前先使用单一来源的本地调优配置，不实现远程配置平台。以下已存在功能的参数按开发批次纳入：
- Director 权重。
- 道具 10/20/30… 获取节点。
- 广告低频触发参数。
- 物体开关/解锁。
- 最低客户端版本。

V1 可以用本地配置，等云功能上线再切远程实现；接口不变。

### 34.17 数据 Schema 必须版本化

所有长期保存数据增加 `schemaVersion`。

上线后改：
- 道具。
- 图鉴。
- 排行榜字段。
- 账号体系。

都必须做 migration，而不是假设用户永远使用最新结构。

### 34.18 Analytics 事件跨平台统一

统一事件名称和参数，不在各平台写不同业务埋点。

每条关键事件附：
- platform。
- clientVersion。
- mode。
- runId。
- deviceTier（粗粒度）。

核心指标至少包括：
- run_start。
- placed_object。
- object_fall。
- tower_collapse。
- use_powerup。
- rewarded_ad_result。
- revive。
- run_end。
- share_attempt。

这样才能比较“微信 vs 抖音 vs TapTap”的真实表现。

### 34.19 审核、隐私与平台 SDK 不做共用假设

每次上新平台都必须重新检查该平台当时的：
- 游戏审核要求。
- 隐私政策/用户信息要求。
- 广告规范。
- SDK/权限声明。
- 内容分级。
- 分享/诱导规则。
- 网络域名/安全策略。

不要因为微信通过审核，就假设抖音或 TapTap 一定符合。

### 34.20 Native / TapTap 额外边界

TapTap 版本本质更接近 Android/原生发行，而不是把“微信小游戏包”上传过去。

Native Adapter 需单独承担：
- 原生生命周期。
- Android 返回键（如需要）。
- 权限/隐私。
- TapTap/其他 SDK。
- 原生广告方案（若采用）。
- App 更新/商店版本。

Gameplay、物体、物理、Director、UI、图鉴、道具逻辑继续复用。

### 34.21 跨平台验收矩阵

任何新增平台至少完成：

| 类别 | 验收 |
|---|---|
| 启动 | 冷启动、资源加载、首屏时间 |
| UI | 安全区、比例、HUD 不遮挡 |
| 输入 | 拖动、仅技能旋转、松手释放、首局免计时 |
| 物理 | 固定 timestep、30/60fps、后台恢复 |
| 音频 | 首次播放、后台/前台、中断恢复 |
| 存储 | 设置、缓存、重要进度 |
| 网络 | 超时、断网、重试、版本不兼容 |
| 广告 | 成功、取消、无填充、失败 |
| 分享 | 正常分享、能力缺失时降级 |
| 数据 | 总榜/月榜 platform 维度 |
| 性能 | 整塔长局、屏外塔底、碰撞峰值、距离辅助 |
| 事故镜头 | 逻辑边界固定、计数不随缩放、HUD 不缩放 |
| 审核 | 隐私、广告、SDK、平台配置 |

### 34.22 Codex 跨平台红线

Codex 不得：
- 在 gameplay/domain 直接调用平台 API。
- 用微信 OpenID 作为全局账户主键。
- 让广告失败阻塞游戏流程。
- 假设 Seed 能跨平台逐帧重放 Box2D。
- 把后台时间计入掉落倒计时。
- 把微信包体数字硬编码成资源架构。
- 把 AppID/广告位/云环境散落业务源码。
- 把重要进度只存在本地缓存。
- 为了“以后再抽象”先写死微信 API。

### 34.23 开发批次与最小架构

- SPEC 正文、Word、素材规则、Manifest 与验收边界保持同步；当前静态工程已建立，1A 已授权但开发暂停，文档收尾不改变运行状态。
- Batch 0：锁定引擎和最小工程/构建配置，说明平台调用边界；Storage/Audio/Lifecycle/Input/安全区窄接口随 0→1A 首次调用实现。真实微信验证依赖 AppID，不预建所有 SDK 或四个平台。
- Batch 1A：四件代表物体的物理校准、操作与首局引导、基础音频、基础全塔模拟和重开。
- Batch 1B：在既有全塔模拟上完善逻辑边界、事故与数量型倒塌、演出镜头、深层辅助；不提前搬入完整导演。
- Batch 1C：十二件物体、基础完整 UI/背景/结算、核心音频交付。1A–1C 是 Batch 1 内部验收点。
- Batch 2：导演、高光、六道具、完整检查点与撤销；核心规则不调用平台 API。
- Batch 3：图鉴与普通战绩分享；分享从第一次接入就经过 Adapter。
- Batch 4：激励广告、奖励和复活通过 Adapter 接入。
- Batch 5：云端校验及总榜/月榜通过 Backend/Leaderboard 接口，platform/schemaVersion 数据维度明确；排行榜仍最后开发。
- 后续抖音/原生适配时才增加对应实现和构建配置，不重写核心玩法。当前不做每日挑战及其衍生功能。
