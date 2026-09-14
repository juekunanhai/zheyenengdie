# R10.1 首页：原 UI 对照与内部自查

用户明确认可 R9 的箱子、马桶和小鸭子，指出背景和 Logo 仍与原 UI 不符；随后要求先自行比对、修正、确认没有明显问题，再提交审核。R10.1 自查通过后已获用户认可，并完成 Cocos 接入，见 [ENGINE_INTEGRATION.md](ENGINE_INTEGRATION.md)。下文保留候选阶段的修正依据。

## 原图与最小方案

原图 `/Users/admin/Downloads/zheyenengdie/docs/zhynd_codex_handoff/visual_refs/02_ui_design_system.png` 左上首页及第 6 区城市场景，是本轮背景画法和 Logo 的依据。

R10 已按原图重绘两张完整图：密集错层的柔化玩具城市，以及黄橙／蓝字标、皇冠、红拖鞋和奶油色弧形标语带。此前城堡、写实公寓候选未采用。完整生成参考与提示见 [SOURCE.json](SOURCE.json)，未从历史展板裁出正式 Sprite。

R10.1 的最小修正为：调整现有长屏构图公式、清理 Logo 四处凹口 alpha、复用正式素材包中的飞艇和飞机恢复侧翼装饰。无需更复杂方案，不重画已认可角色，不增加玩法或工程配置。

## 自查发现与修正

- 长屏 Logo 与拖鞋间隙约 50px，短屏约 10px。现以拖鞋为参照固定图片框间距为 12 个设计单位；长屏装饰塔等比放大到 571.5 宽，Logo 618 宽，避免只下移 Logo 造成顶部大片空白。短屏角色布局保持原值，木牌与按钮位置不变。
- Logo 与弧形带之间四处有黄灰碎点。当前引用 [logo-home-r10-clean-r2.png](assets/logo-home-r10-clean-r2.png)，1381 × 732 RGBA；仅 312 个像素 alpha 改变，RGB 全图不变，旧图保留。[清理配方](assets/logo-home-r10-clean-r2.source.json)及三色底检查图可追溯。
- 原 UI 天空两侧的小玩具被遗漏。现复用正式包派生 `airship_clean.png` 与 `airplane_clean.png`，放在主视觉后方；没有新生成图片或新玩法物体。

## 比对与结论

- [修正前同宽对照](evidence/self-audit-before-comparison.png)、[修正后同宽对照](evidence/self-audit-after-comparison.png)、[Logo 局部](evidence/self-audit-logo-focus.png)。
- 实际查看原图、浏览器短屏／长屏、放大的 Logo 边缘；独立复查后未发现本轮范围内未解决的 P0/P1/P2。
- 13 张首页图片加载成功；本页未捕获控制台警告或错误；三层云在两个时点的变换不同，缓慢漂移有效；JS 语法通过。这些检查仅补充视觉证据，不能替代视觉判断。
- 保留用户认可的 R9 角色、红拖鞋、木牌与正式按钮。原图排除功能不恢复。建筑具体排列、Logo 高光和弧带曲率存在重绘差异，不宣称逐像素复制。

完整发现、尺寸规范化、范围和复查历史见工程根 [design-qa.md](../../../design-qa.md)。以后按 [视觉交付流程](../../docs/VISUAL_REVIEW_WORKFLOW.md)执行。

候选阶段没有直接替代引擎验收。用户认可后，现已完成原生构建、短/长/宽屏和真实菜单跳转；真机仍未验收。
