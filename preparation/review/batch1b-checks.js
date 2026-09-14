/* Local-only engine QA. Fixture mutations are explicit and never persisted to runtime source.
 * Every loss check below uses compiled TowerWorld and native physics events. No Incident methods
 * are called by the tests. “Passed” is written only after this run's assertions have completed. */
(() => {
    'use strict';
    const $ = id => document.getElementById(id), frame = $('player');
    const sequence = ['cardboard_box', 'wood_plank', 'toilet', 'fridge', 'dumbbell', 'basketball'];
    const clone = value => JSON.parse(JSON.stringify(value));
    const report = window.batch1bQA = {
        schema: 'batch1b-local-engine-checks', createdAt: new Date().toISOString(),
        source: 'play-player.html / actual locally built Cocos modules',
        method: 'Directed physical fixtures, not normal gameplay difficulty evidence. No direct Incident.recordLoss calls.',
        results: [], manualActions: [], errors: [], busy: false, ready: false,
    };
    let fixtureCleanup = null, frameErrorWindow = null;
    const fail = (condition, message, evidence) => {
        if (!condition) { const error = new Error(message); error.evidence = evidence; throw error; }
    };
    function status(text) { $('status').textContent = text; }
    function render() {
        $('qaResults').textContent = JSON.stringify(report.results, null, 2);
        const passed = report.results.filter(r => r.status === 'passed').length;
        const failed = report.results.filter(r => r.status === 'failed').length;
        const last = report.results[report.results.length - 1];
        $('checkSummary').textContent = last ? `本次检查：${passed} 通过 / ${failed} 失败。最近一项：${last.name}（${{ running: '运行中', passed: '通过', failed: '失败' }[last.status]}）${last.error ? ' · ' + last.error.split('\n')[0] : ''}` : '尚未运行。本页通过只证明列出的受控场景。';
        for (const button of document.querySelectorAll('button')) button.disabled = !report.ready || report.busy;
        $('export').disabled = report.busy || (!report.results.length && !report.manualActions.length);
        $('size').disabled = report.busy;
        frame.style.pointerEvents = report.busy ? 'none' : 'auto';
    }
    function currentState() {
        try {
            const win = frame.contentWindow, cc = win.qaCC;
            const g = win.qaGame?.();
            return { scene: cc?.director.getScene()?.name, engine: cc?.VERSION,
                viewport: { width: Number(frame.width), height: Number(frame.height) },
                fixture: report.busy, game: g && cc.isValid(g, true) ? g.snapshot() : null,
                nativeBullet: g && cc.isValid(g, true) ? g.world.bodies.map(b => ({ id: b.id,
                    configured: b.body.bullet, native: b.body.impl?.impl?.IsBullet?.() ?? null })) : [] };
        } catch (error) { return { diagnosticError: String(error) }; }
    }
    function captureError(error, source) {
        report.errors.push({ at: new Date().toISOString(), source, message: String(error?.stack || error) });
    }
    window.addEventListener('error', event => captureError(event.error || event.message, 'review-page'));
    window.addEventListener('unhandledrejection', event => captureError(event.reason, 'review-page-promise'));
    function installFrameErrors(win) {
        if (frameErrorWindow === win) return;
        frameErrorWindow = win;
        win.addEventListener('error', event => captureError(event.error || event.message, 'engine-frame'));
        win.addEventListener('unhandledrejection', event => captureError(event.reason, 'engine-frame-promise'));
    }
    /** Event-driven condition wait. The timer only rejects a stalled engine; it never advances a fixture. */
    function until(ctx, predicate, label, timeoutMs = 10000, options = {}) {
        return new Promise((resolve, reject) => {
            const { cc, win, g } = ctx;
            const event = options.event || cc.Director.EVENT_AFTER_PHYSICS;
            let finished = false, elapsed = 0, frames = 0;
            const done = (error, value) => {
                if (finished) return; finished = true;
                clearTimeout(timeout); cc.director.off(event, tick);
                error ? reject(error) : resolve(value);
            };
            const tick = () => {
                try {
                    if (!options.allowSceneChange && (!cc.isValid(g, true) || win.qaGame() !== g))
                        throw new Error(`${label}: 场景提前切换，拒绝读取旧控制器`);
                    elapsed += Math.max(0, Math.min(.1, cc.game.deltaTime)); frames++;
                    const value = predicate({ elapsed, frames });
                    if (value) done(null, value);
                } catch (error) { done(error); }
            };
            const timeout = setTimeout(() => {
                const error = new Error(`${label}: 超过 ${timeoutMs}ms`); error.evidence = currentState(); done(error);
            }, timeoutMs);
            cc.director.on(event, tick);
        });
    }
    async function fresh(untimed = true) {
        fixtureCleanup?.(); fixtureCleanup = null;
        const win = frame.contentWindow;
        await win.qaLoad('HUD');
        const cc = win.qaCC, g = win.qaGame();
        fail(g && typeof g.world?.configureSafety === 'function', '当前构建尚未包含 Batch 1B；请重新构建。');
        fail(g.configureCalibration(sequence, untimed), '六物体资源或校准接口不可用');
        const data = await win.System.import('chunks:///_virtual/object-data.ts');
        const ctx = { win, cc, g, world: g.world, data };
        await until(ctx, () => g.snapshot().phase === 'planning' && g.display.cameraRecovered(), '等待规划阶段');
        return ctx;
    }
    function nextName(g) { return g.display.next.spriteFrame?.name; }
    async function settledBox(ctx, top = 0) {
        const spec = ctx.data.OBJECTS.cardboard_box;
        const body = ctx.world.create(spec, 0, top - ctx.data.localBounds(spec, 0).bottom + 2);
        ctx.world.release(body);
        await until(ctx, () => body.placed && body.supported && ctx.world.isStable(), '纸箱实际接触并确认放稳', 12000);
        return body;
    }
    async function tower(ctx, n) {
        const bodies = [];
        for (let i = 0; i < n; i++) bodies.push(await settledBox(ctx, ctx.world.placementTop()));
        return bodies;
    }
    async function missCurrent(ctx) {
        const { g, world } = ctx, before = g.snapshot();
        await until(ctx, () => g.snapshot().phase === 'planning' && g.display.cameraRecovered(), '等待可释放');
        const body = g.current;
        // Deliberately out-of-view release: production release + physics loss path, no fake loss callback.
        body.node.setPosition(before.boundary.right + body.spec.width + 40, body.node.position.y, 0);
        g.release();
        fail(g.snapshot().releases === before.releases + 1, '定向释放未被真实控制器接受');
        await until(ctx, () => body.lost && g.snapshot().incident, '等待真实越界扣星');
        return { bodyId: body.id, nativeBounds: world.nativeBounds(body), state: clone(g.snapshot()) };
    }
    async function threeStars() {
        const ctx = await fresh(), turns = [];
        for (let index = 0; index < 3; index++) {
            const result = await missCurrent(ctx); turns.push(result);
            fail(result.state.stars === 2 - index, `第 ${index + 1} 次独立事故星数错误`, result);
            fail(result.state.incidentCount === index + 1, '分离事故未形成独立上下文', result);
            if (index < 2) {
                fail(result.state.phase !== 'defeated', '未耗尽三颗星却提前失败', result);
                await until(ctx, () => ctx.g.snapshot().phase === 'planning' && !ctx.g.snapshot().incident && ctx.g.display.cameraRecovered(), '普通事故恢复');
            }
        }
        fail(turns[2].state.phase === 'defeated' && turns[2].state.failureReason === 'stars_exhausted', '第三颗星未立即锁定失败', turns[2]);
        await until(ctx, () => ctx.cc.director.getScene()?.name === 'Result', '失败过渡至结算', 6000, { allowSceneChange: true });
        return { isolation: '三次在屏幕右方释放当前新物体；每次均等待事故恢复再进行下一次。', turns, resultScene: ctx.cc.director.getScene().name };
    }
    async function chain() {
        const ctx = await fresh(), { g, world, data } = ctx;
        const heldId = g.current.id, next = nextName(g), boundary = g.snapshot().normalBoundary;
        const pieces = [0, 1, 2].map(i => {
            const b = world.create(data.OBJECTS.cardboard_box, boundary.right + 180 + i * 130, 180 + i * 130);
            world.release(b); return b;
        });
        await until(ctx, () => pieces.every(b => b.lost) && g.snapshot().incident, '同帧多件真实越界');
        const incident = clone(g.snapshot());
        fail(incident.stars === 2 && incident.incidentCount === 1, '连续多件掉落重复扣星', incident);
        fail(incident.incident.lostIDs.length === 3 && incident.incident.N === 0 && incident.incident.K === null, '新物体错误计入旧塔倒塌集合', incident);
        await until(ctx, () => !g.snapshot().incident && g.snapshot().phase === 'planning' && g.display.cameraRecovered(), '同事故结束');
        fail(g.current.id === heldId && nextName(g) === next && g.snapshot().releases === 0, '事故期间偷偷生成/消费待放物体', g.snapshot());
        const recovered = clone(g.snapshot());
        const duringCameraReturn = await chainDuringCameraReturn();
        return { isolation: '同时创建三件从未 placed 的屏外动态纸箱，保持原待放物体；另一组在真实三件旧塔前，回镜途中再次释放屏外新件，检查仍属同事故。', incident, recovered, duringCameraReturn };
    }
    async function chainDuringCameraReturn() {
        const ctx = await fresh(), { g, world, data } = ctx;
        await tower(ctx, 3);
        const heldId = g.current.id, next = nextName(g), boundary = g.snapshot().normalBoundary;
        const loseNew = () => {
            const b = world.create(data.OBJECTS.cardboard_box, boundary.right + 180, 180);
            world.release(b); return b;
        };
        const first = loseNew();
        await until(ctx, () => first.lost && g.snapshot().incident, '新件掉落触发旧塔观察');
        const started = clone(g.snapshot());
        fail(started.incident.N === 3 && started.incident.zoom === .75, '无法建立有回镜动画的三件观察场景', started);
        await until(ctx, () => g.snapshot().incident && g.snapshot().recoverySeconds >= .6 &&
            g.snapshot().view.zoomTarget === 1 && g.snapshot().view.zoom < .99, '等待事故尚存的回镜中间帧');
        const returning = clone(g.snapshot()), second = loseNew();
        await until(ctx, () => second.lost, '回镜中第二件实际越界');
        const interrupted = clone(g.snapshot());
        fail(interrupted.incidentCount === 1 && interrupted.stars === 2 && interrupted.incident.lostIDs.length === 2,
            '回镜途中重新拆事故/重复扣星', interrupted);
        fail(interrupted.incident.N === started.incident.N && interrupted.incident.K === started.incident.K &&
            JSON.stringify(interrupted.incident.members) === JSON.stringify(started.incident.members), '回镜中丢失冻结成员', interrupted);
        fail(interrupted.view.zoom >= returning.view.zoom - .02, '回镜中再次掉落导致重复拉远', { returning, interrupted });
        await until(ctx, () => !g.snapshot().incident && g.snapshot().phase === 'planning' && g.display.cameraRecovered(), '第二件掉落后真正恢复');
        fail(g.current.id === heldId && nextName(g) === next, '回镜中掉落替换了原待放物体', g.snapshot());
        return { started, returning, interrupted, recovered: clone(g.snapshot()) };
    }
    async function collapse() {
        const ctx = await fresh(), pieces = await tower(ctx, 3);
        const before = clone(ctx.g.snapshot());
        ctx.world.platform.enabled = false;
        await until(ctx, () => ctx.g.snapshot().incident, '失去地面后的持续倒塌趋势');
        const started = clone(ctx.g.snapshot());
        fail(started.incident.N === 3 && started.incident.K === 3, '三件已放稳旧塔的冻结门槛错误', started);
        fail(started.incident.members.every(id => pieces.some(b => b.id === id)), '待放物体混入旧塔成员', started);
        await until(ctx, () => ctx.g.snapshot().phase === 'defeated', '旧塔 K 件真实越界', 12000);
        const ended = clone(ctx.g.snapshot());
        fail(ended.failureReason === 'large_collapse' && ended.stars === 2, '数量型失败未越过普通星数规则', ended);
        fail(ended.incident.lostMemberCount >= ended.incident.K, '未达到 K 却判数量失败', ended);
        return { isolation: '三件纸箱分别真实落地放稳，再关闭真实地面碰撞体让其自然下坠。', before, started, ended };
    }
    async function resume() {
        const originalSize = $('size').value;
        frame.width = '600'; frame.height = '800';
        const ctx = await fresh(), old = await settledBox(ctx);
        const { g, world, cc } = ctx;
        g.untimedCalibration = false; g.tutorial = false; g.planningLeft = 2.5;
        g.moveTo(g.boundary.right);
        await until(ctx, () => g.planningLeft < 2.35, '先运行真实规划倒计时');
        const before = { heldId: g.current.id, next: nextName(g), state: clone(g.snapshot()) };
        world.platform.enabled = false;
        await until(ctx, () => old.lost && g.snapshot().incident, '旧塔掉落打断规划');
        const entered = clone(g.snapshot()), clocks = [];
        frame.width = '375'; frame.height = '812';
        const sample = () => { if (cc.isValid(g, true) && g.snapshot().incident) clocks.push(g.planningLeft); };
        cc.director.on(cc.Director.EVENT_AFTER_PHYSICS, sample);
        try {
            await until(ctx, () => !g.snapshot().incident && g.snapshot().phase === 'planning' && g.display.cameraRecovered(), '恢复原规划与镜头');
        } finally { cc.director.off(cc.Director.EVENT_AFTER_PHYSICS, sample); }
        const after = clone(g.snapshot());
        fail(g.current.id === before.heldId && nextName(g) === before.next, '事故恢复后更换了待放物体或 NEXT', { before, after });
        fail(after.releases === before.state.releases, '事故过程消耗了下一件', { before, after });
        fail(clocks.length > 5 && Math.max(...clocks) - Math.min(...clocks) < .0001, '事故中规划倒计时继续消耗', clocks);
        fail(after.secondsLeft <= entered.secondsLeft && after.secondsLeft >= entered.secondsLeft - .12, '恢复时未保留剩余倒计时', { entered, after });
        const heldBounds = world.bounds(g.current);
        fail(heldBounds.right <= after.boundary.right - 3.9 && heldBounds.left >= after.boundary.left + 3.9 && Math.abs(heldBounds.top - after.boundary.top) < .01,
            '缩小视区后的待放物体未重新夹紧/贴回抓手高度', { heldBounds, after });
        const [w, h] = originalSize.split(','); frame.width = w; frame.height = h;
        return { isolation: '旧纸箱真实放稳后移除地面；以 2.5 秒剩余时间作为受控起点。待放物体位于宽视区最右端，事故中改成长屏，恢复时验证夹紧和 NEXT。', before, entered, incidentClockSamples: clocks, heldBounds, after };
    }
    async function frozen() {
        const originalSize = $('size').value, ctx = await fresh(), pieces = await tower(ctx, 3);
        ctx.world.platform.enabled = false;
        await until(ctx, () => ctx.g.snapshot().incident, '建立数量观察集合');
        const before = clone(ctx.g.snapshot().incident), observations = [];
        // Prevent this fixture from finishing while different presentation sizes are inspected.
        // No support is manufactured: all three remain detached dynamic bodies, so recovery is blocked.
        for (const b of pieces) { b.body.gravityScale = 0; b.body.linearVelocity = new ctx.cc.Vec2(); b.body.angularVelocity = 0; }
        try {
            for (const size of ['375,812', '600,800']) {
                const [w, h] = size.split(','); frame.width = w; frame.height = h;
                await until(ctx, ({ elapsed }) => elapsed >= .55 && ctx.g.snapshot().view.zoom === before.zoom, '等待尺寸调整和缩放动画');
                const current = clone(ctx.g.snapshot()); observations.push(current);
                fail(JSON.stringify(current.incident) === JSON.stringify(before), '缩放/画幅改变了事故成员、N/K 或边界', { before, current });
            }
        } finally { const [w, h] = originalSize.split(','); frame.width = w; frame.height = h; }
        return { isolation: '真实三件倒塌趋势开始后，将已脱离的动态体重力与速度暂置零，维持事故供画幅检查；不替代支撑或计数。', before, observations };
    }
    async function isolatedWorld() {
        const ctx = await fresh(); ctx.g.enabled = false; ctx.g.audio.pause(true);
        ctx.world.dispose();
        // Cocos defers destruction to a frame boundary. Wait on the engine event, not a timer.
        await until(ctx, ({ frames }) => frames >= 2, '销毁前一个物理根');
        const { TowerWorld } = await ctx.win.System.import('chunks:///_virtual/tower-world.ts');
        ctx.world = ctx.g.world = new TowerWorld(ctx.cc.director.getScene()); ctx.g.current = null;
        const paint = () => ctx.g.display.update(Math.min(.067, ctx.cc.game.deltaTime), ctx.world.bodies, null, 1);
        ctx.cc.director.on(ctx.cc.Director.EVENT_AFTER_PHYSICS, paint);
        fixtureCleanup = () => ctx.cc.director.off(ctx.cc.Director.EVENT_AFTER_PHYSICS, paint);
        return ctx;
    }
    async function stablePhysicalBox(ctx, top = 0) {
        const spec = ctx.data.OBJECTS.cardboard_box;
        const b = ctx.world.create(spec, 0, top - ctx.data.localBounds(spec, 0).bottom + 2); ctx.world.release(b);
        let steady = 0;
        await until(ctx, () => {
            steady = ctx.world.isStable() ? steady + Math.min(.1, ctx.cc.game.deltaTime) : 0;
            return steady >= .7;
        }, '独立真实纸箱稳定', 12000);
        b.placed = true; // Fixture marks success only after actual physical stability has been observed.
        return b;
    }
    async function support() {
        const ctx = await isolatedWorld();
        const original = { left: -375, right: 375, bottom: -200, top: 800 };
        ctx.world.configureSafety(original, 100);
        const body = await stablePhysicalBox(ctx), before = clone(ctx.world.safetySnapshot());
        const shifted = { ...original, bottom: 200, top: 1200 };
        ctx.world.configureSafety(shifted, 100);
        await until(ctx, ({ elapsed }) => elapsed >= 1.2, '屏下旧塔保留真实支撑');
        const retained = { safety: clone(ctx.world.safetySnapshot()), bounds: ctx.world.nativeBounds(body), y: body.node.position.y };
        fail(retained.bounds.top < shifted.bottom && body.supported && !body.lost && body.collider.enabled, '镜头移出后删除了有支撑的旧塔', retained);
        ctx.world.platform.enabled = false;
        await until(ctx, () => body.lost, '屏下旧塔脱离支撑并持续下坠', 5000);
        const detached = clone(ctx.world.safetySnapshot());
        const slowReturn = await supportReturn(-.3), fastReturn = await supportReturn(-3);
        fail(slowReturn.after.supported && !slowReturn.after.lost, '原承托短暂断触后未能低速重新接住', slowReturn);
        fail(!fastReturn.after.supported && fastReturn.contacts.some(c => c.disabled || c.disabledOnce), '高速屏外回接被错误豁免', fastReturn);
        return { isolation: '纸箱真实落地稳定后上移视区，再关闭地面验证失效；额外两组为真实两盒支撑，向上平移 .75 单位产生 END，再以 -.3 / -3m/s 回接原下盒。', before, retained, detached, slowReturn, fastReturn };
    }
    async function supportReturn(speed) {
        const ctx = await isolatedWorld(), { world, cc } = ctx;
        world.configureSafety({ left: -375, right: 375, bottom: -200, top: 800 }, 200);
        const lower = await stablePhysicalBox(ctx), upper = await stablePhysicalBox(ctx, world.placementTop());
        world.configureSafety({ left: -375, right: 375, bottom: 300, top: 1300 }, 200);
        const contacts = [], before = { native: world.nativeBounds(upper), safety: clone(world.safetySnapshot()) };
        upper.collider.on(cc.Contact2DType.PRE_SOLVE, (self, other, contact) => {
            if (other === lower.collider) contacts.push({ native: world.nativeBounds(upper),
                disabled: !!contact.disabled, disabledOnce: !!contact.disabledOnce, supported: upper.supported,
                speed: upper.body.linearVelocity.y, returns: world.safetySnapshot().pendingSupportReturns });
        });
        upper.body.gravityScale = 0;
        upper.node.setPosition(upper.node.position.x, upper.node.position.y + .75, 0); upper.body.wakeUp();
        await until(ctx, () => !upper.supported && world.safetySnapshot().pendingSupportReturns > 0, '产生真实 END 与原承托宽限', 4000);
        const separated = { native: world.nativeBounds(upper), safety: clone(world.safetySnapshot()) };
        upper.body.linearVelocity = new cc.Vec2(0, speed);
        if (Math.abs(speed) < .4) await until(ctx, () => upper.supported, '低速重新落回原承托', 4000);
        else await until(ctx, () => contacts.some(c => c.disabled || c.disabledOnce), '高速原承托回接仍过滤', 4000);
        return { speed, before, separated, contacts,
            after: { native: world.nativeBounds(upper), supported: upper.supported, lost: upper.lost, safety: clone(world.safetySnapshot()) } };
    }
    async function presolveVariant(filtered, kind = 'cardboard_box', substepping = false) {
        const ctx = await isolatedWorld(), { world, cc, data } = ctx;
        const physics = cc.PhysicsSystem2D.instance;
        const physicsBefore = { fixedTimeStep: physics.fixedTimeStep, maxSubSteps: physics.maxSubSteps };
        if (substepping) { physics.fixedTimeStep = 1 / 240; physics.maxSubSteps = 8; }
        try {
        const initial = { left: -375, right: 375, bottom: -200, top: 800 };
        if (filtered) world.configureSafety(initial, 100);
        const lower = await stablePhysicalBox(ctx), supportTop = world.nativeBounds(lower).top;
        const spec = { ...data.OBJECTS[kind], contactImpactSpeed: undefined };
        const contactTop = supportTop + spec.height, edge = contactTop + 4;
        const boundary = { ...initial, bottom: edge, top: edge + 1000 };
        const upper = world.create(spec, 0, edge + 1 - data.localBounds(spec, 0).top);
        world.release(upper); upper.body.gravityScale = 0;
        if (filtered) world.configureSafety(boundary, supportTop);
        const contacts = [], impulses = [], losses = [];
        const pre = (self, other, contact) => {
            if (other !== lower.collider) return;
            contacts.push({ node: world.bounds(upper), native: world.nativeBounds(upper), boundary: clone(boundary),
                disabled: !!contact.disabled, disabledOnce: !!contact.disabledOnce, lost: upper.lost });
        };
        const post = (self, other, contact) => {
            if (other !== lower.collider) return;
            const impulse = contact.getImpulse();
            impulses.push(impulse ? clone(impulse) : null);
        };
        upper.collider.on(cc.Contact2DType.PRE_SOLVE, pre);
        upper.collider.on(cc.Contact2DType.POST_SOLVE, post);
        world.onLoss = record => losses.push({ id: record.id, node: world.bounds(record), native: world.nativeBounds(record), filteredContacts: world.safetySnapshot().filteredContacts });
        await until(ctx, ({ frames }) => frames >= 2, '原生物体注册完成');
        fail(!upper.lost, '碰撞前就越界，无法证明同子步过滤', { node: world.bounds(upper), native: world.nativeBounds(upper), boundary });
        const before = { upper: world.nativeBounds(upper), lower: world.nativeBounds(lower), lowerVelocity: clone(lower.body.linearVelocity),
            nativeFixtureCount: upper.collider.impl._fixtures.length,
            bullet: { lower: { configured: lower.body.bullet, native: lower.body.impl.impl.IsBullet() },
                upper: { configured: upper.body.bullet, native: upper.body.impl.impl.IsBullet() } } };
        fail(before.bullet.lower.native && before.bullet.upper.native, '组件bullet为true但原生CCD未启用：需要修正生产初始化顺序', before);
        upper.body.linearVelocity = new cc.Vec2(0, -20); upper.body.wakeUp();
        await until(ctx, () => filtered ? upper.lost : impulses.length > 0, '真实求解前过滤/对照碰撞', 5000);
        await until(ctx, ({ frames }) => frames >= 2, '收集碰撞后状态');
        let retirement = null;
        if (filtered) {
            const first = { nativeEnabled: upper.body.impl.impl.IsEnabled(), bounds: world.nativeBounds(upper) };
            await until(ctx, ({ frames }) => frames >= 3, '失效物体原生停止后续模拟');
            const later = { nativeEnabled: upper.body.impl.impl.IsEnabled(), bounds: world.nativeBounds(upper) };
            retirement = { first, later };
            fail(!first.nativeEnabled && !later.nativeEnabled && Object.keys(first.bounds).every(key => Math.abs(first.bounds[key] - later.bounds[key]) < .00001),
                '失效原生刚体仍启用或继续下坠', retirement);
        }
        return { filtered, kind, nativeFixtureCount: before.nativeFixtureCount, boundary, before, contacts, impulses, losses,
            retirement,
            physics: { original: physicsBefore, fixture: { fixedTimeStep: physics.fixedTimeStep, maxSubSteps: physics.maxSubSteps } },
            after: { upper: world.nativeBounds(upper), lower: world.nativeBounds(lower), lowerVelocity: clone(lower.body.linearVelocity) }, safety: clone(world.safetySnapshot()) };
        } finally { physics.fixedTimeStep = physicsBefore.fixedTimeStep; physics.maxSubSteps = physicsBefore.maxSubSteps; }
    }
    async function presolve() {
        const filtered = await presolveVariant(true), control = await presolveVariant(false);
        assertPresolve(filtered, control);
        const multiFiltered = await presolveVariant(true, 'cardboard_box', true), multiControl = await presolveVariant(false, 'cardboard_box', true);
        assertPresolve(multiFiltered, multiControl);
        return { isolation: '真实纸箱支撑上方 5 单位缝隙，以 -20m/s 定向下坠。先默认步长，再临时1/240秒/最多8子步且finally还原；两组都断言原生CCD启用、Node/native求解前差异及有无过滤的冲量对照。仅上件关闭首次接触缓冲，未改生产平衡。', defaultStep: { filtered, control }, multiStep: { filtered: multiFiltered, control: multiControl } };
    }
    function assertPresolve(filtered, control) {
        const sumImpulse = rows => rows.flatMap(r => r?.normalImpulses || []).reduce((sum, value) => sum + Math.abs(value), 0);
        const sameStep = filtered.contacts.some(r => r.node.top >= filtered.boundary.bottom && r.native.top < filtered.boundary.bottom && (r.disabled || r.disabledOnce));
        fail(filtered.losses.length === 1 && filtered.losses[0].id !== 1, '失效目标数量错误', filtered);
        fail(sameStep, '未捕获 Node 尚在界内、原生形状同子步越界的 PRE_SOLVE，不能据此称通过', filtered);
        fail(sumImpulse(filtered.impulses) === 0 && sumImpulse(control.impulses) > .001, '过滤组仍有碰撞冲量或对照组没有真实碰撞', { filtered, control });
    }
    async function toilet() {
        const filtered = await presolveVariant(true, 'toilet'), control = await presolveVariant(false, 'toilet');
        fail(control.nativeFixtureCount > 1, '未加载凹形马桶的多个真实原生 Fixture', control);
        assertPresolve(filtered, control);
        fail(filtered.losses.length === 1, '凹形多个 Fixture 导致同一物体重复失效', filtered);
        return { isolation: '以当前正式凹形马桶替代上件，默认步长与原生CCD，多Fixture逐接触采样；同样的位置/冲量对照，未简化马桶为包围盒。', filtered, control };
    }
    async function motorVariant(kind, filtered, duringContact = false) {
        const ctx = await isolatedWorld(), { world, data, cc } = ctx;
        const boundary = { left: -375, right: 375, bottom: -200, top: 800 };
        if (filtered) world.configureSafety(boundary, 100);
        const twoSided = kind === 'basketball-two-sided';
        const lower = await stablePhysicalBox(ctx), spec = data.OBJECTS[twoSided ? 'basketball' : kind];
        const upper = world.create(spec, 0, world.placementTop() - data.localBounds(spec, 0).bottom + 2);
        world.release(upper);
        const bonds = kind.startsWith('basketball') ? world.bonds : world.stabilizerBonds;
        let steady = 0;
        await until(ctx, () => {
            steady = world.isStable() && bonds.size > 0 ? steady + Math.min(.1, cc.game.deltaTime) : 0;
            return steady >= .7;
        }, `真实 ${kind} 接触、MotorJoint 与稳定`, 12000);
        upper.placed = true;
        let cap = null;
        if (twoSided) {
            const capSpec = data.OBJECTS.cardboard_box;
            cap = world.create(capSpec, 0, world.placementTop() - data.localBounds(capSpec, 0).bottom + 2);
            world.release(cap); steady = 0;
            await until(ctx, () => {
                const sides = Array.from(bonds.values()).filter(b => b.ball === upper).map(b => b.side);
                steady = world.isStable() && sides.includes(-1) && sides.includes(1) ? steady + Math.min(.1, cc.game.deltaTime) : 0;
                return steady >= .7;
            }, '上下两面真实篮球胶建立并稳定', 12000);
            cap.placed = true;
        }
        const joints = Array.from(bonds.values()).map(b => b.joint);
        if (duringContact) {
            const barrierSpec = data.OBJECTS.cardboard_box;
            const targetX = boundary.right + spec.width + 50;
            const barrier = world.create(barrierSpec, targetX + spec.width / 2 + barrierSpec.width / 2 - .5, upper.node.position.y);
            barrier.body.type = cc.ERigidBody2DType.Static; barrier.collider.enabled = true; barrier.collider.apply();
            await until(ctx, ({ frames }) => frames >= 2, '注册屏外真实静态碰撞探针');
        }
        const before = { lower: world.nativeBounds(lower), upper: world.nativeBounds(upper), lowerVelocity: clone(lower.body.linearVelocity),
            cap: cap ? { bounds: world.nativeBounds(cap), velocity: clone(cap.body.linearVelocity) } : null,
            joints: joints.map(j => ({ maxForce: j.maxForce, maxTorque: j.maxTorque, active: j.enabledInHierarchy })) };
        fail(before.joints.length > 0 && before.joints.every(j => j.active && j.maxForce > 0), '没有先建立有效物理连接', before);
        if (twoSided) fail(before.joints.length === 2, '未实际建立上下两个篮球MotorJoint', before);
        const native = upper.body.impl.impl;
        let injected = null;
        const inject = () => {
            native.SetTransform({ x: (boundary.right + spec.width + 50) / 32, y: native.GetPosition().y }, native.GetAngle());
            upper.body.linearVelocity = new cc.Vec2(15, 0); upper.body.wakeUp(); lower.body.wakeUp();
            injected = { node: world.bounds(upper), native: world.nativeBounds(upper), boundary };
        };
        if (!duringContact) inject();
        let physicalPhase = 'between-frames';
        const lossEvents = [], contacts = [];
        world.onLoss = b => lossEvents.push({ id: b.id, phase: physicalPhase, stepping: cc.PhysicsSystem2D.instance._steping,
            native: world.nativeBounds(b), node: world.bounds(b) });
        upper.collider.on(cc.Contact2DType.PRE_SOLVE, (self, other, contact) => contacts.push({
            native: world.nativeBounds(upper), disabled: !!contact.disabled, disabledOnce: !!contact.disabledOnce,
            otherId: world.bodies.find(b => b.collider === other)?.id ?? 0 }));
        // World.beforePhysics was subscribed first; an onLoss before this marker belongs to its pre-step guard.
        let injectionPending = duringContact;
        const beforeStep = () => { physicalPhase = 'solver'; if (injectionPending) { injectionPending = false; inject(); } };
        const afterStep = () => { physicalPhase = 'between-frames'; };
        cc.director.on(cc.Director.EVENT_BEFORE_PHYSICS, beforeStep);
        cc.director.on(cc.Director.EVENT_AFTER_PHYSICS, afterStep);
        try { await until(ctx, ({ frames }) => frames >= 1, '记录失效后的首个求解步'); }
        finally { cc.director.off(cc.Director.EVENT_BEFORE_PHYSICS, beforeStep); cc.director.off(cc.Director.EVENT_AFTER_PHYSICS, afterStep); }
        fail(injected && injected.native.left > boundary.right && injected.node.right < boundary.right, '原生越界注入没有保留旧Node位置', injected);
        const firstStep = { upperLost: upper.lost, lower: world.nativeBounds(lower), lowerVelocity: clone(lower.body.linearVelocity),
            retired: { enabled: upper.body.impl.impl.IsEnabled(), bounds: world.nativeBounds(upper) },
            cap: cap ? { bounds: world.nativeBounds(cap), velocity: clone(cap.body.linearVelocity) } : null,
            activeBonds: bonds.size, joints: joints.map(j => ({ valid: cc.isValid(j, true), enabled: j.enabled, maxForce: j.maxForce, maxTorque: j.maxTorque })) };
        await until(ctx, ({ elapsed }) => elapsed >= .35, '确认不再继续拖动下层');
        const after = { lower: world.nativeBounds(lower), lowerVelocity: clone(lower.body.linearVelocity), upperLost: upper.lost, activeBonds: bonds.size,
            retired: { enabled: upper.body.impl.impl.IsEnabled(), bounds: world.nativeBounds(upper) } };
        if (filtered) fail(!firstStep.retired.enabled && !after.retired.enabled &&
            Object.keys(after.retired.bounds).every(key => Math.abs(firstStep.retired.bounds[key] - after.retired.bounds[key]) < .00001),
            '连接失效后的原生刚体仍在继续模拟', { firstStep, after });
        return { kind, filtered, duringContact, before, injected, lossEvents, contacts, firstStep, after };
    }
    async function motors() {
        const cases = [];
        for (const kind of ['basketball', 'wood_plank', 'basketball-two-sided']) {
            const filtered = await motorVariant(kind, true), control = await motorVariant(kind, false);
            fail(filtered.lossEvents.some(e => e.phase === 'between-frames'), '没有证明失效在原生求解前发生', filtered);
            fail(filtered.firstStep.upperLost && filtered.firstStep.activeBonds === 0 && filtered.firstStep.joints.every(j => j.maxForce === 0 && j.maxTorque === 0), '失效后仍保留连接施力预算', filtered);
            fail(Math.abs(filtered.firstStep.lowerVelocity.x) < .03 && Math.abs(filtered.after.lower.left - filtered.before.lower.left) < .5,
                '失效连接仍拖拽下层', filtered);
            fail(Math.abs(control.firstStep.lowerVelocity.x) > Math.abs(filtered.firstStep.lowerVelocity.x) + .05,
                '无过滤对照未实际产生拖拽，不能证明该fixture覆盖MotorJoint风险', { filtered, control });
            if (kind === 'basketball-two-sided') fail(Math.abs(filtered.firstStep.cap.velocity.x) < .03, '双面胶失效后仍带动上方物体', filtered);
            cases.push({ kind, filtered, control });
        }
        const filtered = await motorVariant('basketball-two-sided', true, true);
        const control = await motorVariant('basketball-two-sided', false, true);
        fail(filtered.lossEvents.some(e => e.stepping) && filtered.contacts.some(c => c.disabled || c.disabledOnce),
            '未捕获真实接触求解期间的双连接失效；不能证明延迟销毁路径', filtered);
        fail(filtered.firstStep.upperLost && filtered.firstStep.joints.every(j => j.maxForce === 0 && j.maxTorque === 0), '接触期间失效仍保留双连接预算', filtered);
        fail(Math.abs(filtered.firstStep.lowerVelocity.x) < .03 && Math.abs(filtered.firstStep.cap.velocity.x) < .03,
            '多个MotorJoint在PRE失效后仍通过warmstart带动上/下层', { filtered, control });
        cases.push({ kind: 'basketball-two-sided-contact-stage', filtered, control });
        return { isolation: '真实落放建立单篮球胶、木板稳固、上下两面篮球胶。原生SetTransform保留旧Node并注入15m/s，先测BEFORE失效；最后在BEFORE规则检查后注入到已注册屏外静态探针，严格要求真实PRE/物理stepping中的双连接失效，比较首步速度与施力预算。未改材质参数。', cases };
    }
    async function assist() {
        const ctx = await isolatedWorld(), { world, cc } = ctx;
        const boundary = { left: -375, right: 375, bottom: -200, top: 800 };
        world.configureSafety(boundary, 100);
        const body = await stablePhysicalBox(ctx), start = world.nativeBounds(body), samples = [];
        // Keep this valid grounded old body below the view. Only confirmed tower-top reference changes.
        const highView = { ...boundary, bottom: 200, top: 1200 };
        for (const [label, depth, enabled] of [['near', 500, true], ['middle', 2000, true], ['deep', 3500, true], ['disabled', 3500, false]]) {
            world.configureSafety(highView, start.top + depth, enabled);
            await until(ctx, ({ elapsed }) => elapsed >= .9, `等待 ${label} 辅助收敛`);
            samples.push({ label, depth, enabled, extra: body.assistDamping, angularDamping: body.body.angularDamping,
                supported: body.supported, lost: body.lost, awake: body.body.isAwake(), dynamic: body.body.type === cc.ERigidBody2DType.Dynamic,
                position: world.nativeBounds(body), velocity: clone(body.body.linearVelocity) });
        }
        fail(samples[0].extra === 0 && samples[1].extra > 3.8 && samples[1].extra < 4.2 && samples[2].extra > 7.9 && samples[3].extra === 0, '深度平滑曲线/关闭开关不符合设定', samples);
        fail(samples.every(s => s.dynamic && s.supported && !s.lost && Math.abs(s.position.bottom - start.bottom) < .5), '深层辅助冻结、移动或删除旧塔', samples);
        world.configureSafety(highView, start.top + 3500, true);
        await until(ctx, () => body.assistDamping > 7.8, '再次启用辅助');
        world.platform.enabled = false;
        await until(ctx, () => !body.supported && body.assistDamping === 0, '脱离支撑立即停止辅助');
        const detached = clone(world.safetySnapshot());
        await until(ctx, () => body.lost, '辅助不阻止真实下坠失效', 5000);
        return { isolation: '同一个真实支撑旧体，固定 1000 单位视高，仅改变已确认塔顶参考；检查实际动态刚体阻尼、位置和脱离支撑后的失效。此项不证明真人难度收益。', samples, detached, lost: clone(world.safetySnapshot()) };
    }
    async function audioCheck() {
        const ctx = await fresh(), { g, cc, win } = ctx;
        g.enabled = false;
        const platform = await win.System.import('chunks:///_virtual/local-platform.ts');
        const settingsKey = 'zhynd.local-settings.v1', savedRaw = cc.sys.localStorage.getItem(settingsKey);
        const savedSettings = platform.readSettings(), audio = g.audio;
        const hudClips = g.approvedSounds.map(clip => ({ name: clip.name, duration: clip.getDuration() }));
        const events = [], playback = [], listeners = [];
        const startedType = cc.AudioSource.EventType.STARTED, endedType = cc.AudioSource.EventType.ENDED;
        const observedSources = new WeakSet();
        let restoreResultObserver = null;
        const observeSource = source => {
            if (observedSources.has(source)) return;
            observedSources.add(source);
            for (const type of [startedType, endedType]) {
                const callback = () => events.push({ type, clip: source.clip?.name,
                    scene: source.node.scene?.name, source: source.node.name, volume: source.volume, at: performance.now() });
                source.node.on(type, callback); listeners.push({ node: source.node, type, callback });
            }
        };
        const tick = () => audio.update(Math.min(.1, cc.game.deltaTime));
        const voices = () => audio.voices.map(v => ({ name: v.source.node.name, clip: v.source.clip?.name,
            playing: v.source.playing, reserved: v.availableAt > audio.clock, collision: v.collision,
            pairKey: v.pairKey, volume: v.source.volume }));
        const startedCount = () => events.filter(e => e.type === startedType).length;
        const silence = async () => {
            audio.pause(true);
            await until(ctx, ({ frames }) => frames >= 2 && voices().every(v => !v.playing), '等待真实音源停止');
            audio.pause(false);
        };
        try {
            fail(platform.writeSettings({ ...savedSettings, sound: true }), '无法为本地音效fixture临时开启声音');
            audio.interact(); audio.pause(true);
            cc.director.on(cc.Director.EVENT_AFTER_PHYSICS, tick);
            for (const voice of audio.voices) observeSource(voice.source);
            await silence();
            const mapping = [
                ['impact_cardboard_box', ['impact_paper_1', 'impact_paper_2', 'impact_paper_3']],
                ['impact_wood_plank', ['impact_wood_1', 'impact_wood_2', 'impact_wood_3']],
                ['impact_basketball', ['impact_rubber_1', 'impact_rubber_2', 'impact_rubber_3']],
                ['impact_fridge', ['impact_metal_1', 'impact_metal_2', 'impact_metal_3']],
                ['impact_dumbbell', ['impact_metal_1']],
                ['impact_toilet', ['impact_ceramic_1', 'impact_ceramic_2', 'impact_ceramic_3']],
                ['skill_rotate_90', ['rotate_90']], ['claw_release', ['claw_open']],
                ['claw_grip', ['claw_grip']], ['next_handoff', ['next_handoff']],
                ['ui_tap', ['next_handoff']], ['star_lost', ['star_lost']],
            ];
            for (const [eventName, expectedClips] of mapping) for (const expected of expectedClips) {
                const eventStart = events.length, key = `qa-a3:${playback.length}`;
                fail(audio.clips.has(expected), `当前构建缺少 ${expected}，请先完成 A3 导入。`);
                fail(audio.play(eventName, .55, key), `${eventName} 未被真实 GameAudio 接受`);
                await until(ctx, () => events.slice(eventStart).some(e => e.type === startedType && e.clip === expected) &&
                    events.slice(eventStart).some(e => e.type === endedType && e.clip === expected), `${eventName} / ${expected} 的 STARTED 与 ENDED`, 7000);
                const observed = events.slice(eventStart);
                fail(observed.filter(e => e.type === startedType && e.clip === expected).length === 1 &&
                    observed.filter(e => e.type === endedType && e.clip === expected).length === 1,
                    '同一映射播放次数或结束次数异常', observed);
                playback.push({ eventName, expected, events: observed });
            }
            await silence();
            const weakPair = audio.play('impact_cardboard_box', .25, 'qa-pair');
            await until(ctx, () => voices().some(v => v.pairKey === 'qa-pair' && v.playing), '同pair第一声真实开始');
            // Cooldown is measured from the actual first accepted play; refresh that same first-hit
            // fixture if the browser took unusually long to start playback, rather than claim coverage.
            fail(audio.clock - audio.playedAt.get('qa-pair') < .12, '首声启动延迟超出冷却窗口，本次无法验证同pair优先级');
            const weakerRejected = !audio.play('impact_cardboard_box', .2, 'qa-pair');
            const strongerAccepted = audio.play('impact_cardboard_box', .8, 'qa-pair');
            const samePair = { first: weakPair, weakerRejected, strongerAccepted, voices: voices() };
            fail(weakPair && weakerRejected && strongerAccepted && samePair.voices.filter(v => v.pairKey === 'qa-pair' && v.reserved).length === 1,
                '同pair弱拒/强替规则失败', samePair);
            await silence();
            const multiPairEventStart = events.length;
            const multiFirst = audio.play('impact_cardboard_box', .2, 'qa-multi-pair');
            // Explicit audio-only clock injection makes two clips for one pair overlap across
            // the cooldown boundary. It does not change playedAt or substitute AudioSource events.
            audio.update(.13);
            const multiSecond = audio.play('impact_cardboard_box', .5, 'qa-multi-pair');
            const multiBeforeWeak = voices().filter(v => v.pairKey === 'qa-multi-pair' && v.reserved);
            const multiWeak = audio.play('impact_cardboard_box', .3, 'qa-multi-pair');
            fail(multiFirst && multiSecond && multiBeforeWeak.length === 2 && !multiWeak,
                '同pair多busy音源时按旧弱声比较，错误接受中等碰撞', { multiFirst, multiSecond, multiBeforeWeak, multiWeak });
            await until(ctx, () => events.slice(multiPairEventStart).filter(e => e.type === startedType).length >= 2,
                '同pair两条真实音源均开始');
            const multiBusyPair = { explicitAudioClockAdvance: .13, first: multiFirst, second: multiSecond,
                beforeWeak: multiBeforeWeak, rejectedMedium: !multiWeak, events: events.slice(multiPairEventStart) };
            await silence();
            const fills = [.2, .3, .4, .5].map((volume, i) => audio.play('impact_fridge', volume, `qa-full:${i}`));
            const overflowWeak = audio.play('impact_fridge', .1, 'qa-full:weak');
            const overflowStrong = audio.play('impact_fridge', .85, 'qa-full:strong');
            const star = audio.play('star_lost', .65, 'qa-full:star');
            const operation = audio.play('skill_rotate_90', .65, 'qa-full:operation');
            const priority = { fills, overflowWeak, overflowStrong, star, operation, voices: voices() };
            fail(fills.every(Boolean) && !overflowWeak && overflowStrong && star && operation, '碰撞容量或操作/掉星优先级错误', priority);
            fail(priority.voices.filter(v => v.reserved && v.collision).length === 4 && priority.voices.filter(v => v.reserved).length <= 8 &&
                !priority.voices.some(v => v.pairKey === 'qa-full:0' && v.reserved), '强碰撞没有替换最弱或突破容量', priority);
            const eventIndex = events.length;
            await until(ctx, () => events.slice(eventIndex).some(e => e.type === startedType && e.clip === 'star_lost'), '满碰撞通道时真实掉星声音开始');
            await silence();
            const pauseStart = events.length;
            fail(audio.play('impact_toilet', .55, 'qa-pause'), '暂停探针启动失败');
            await until(ctx, () => events.slice(pauseStart).some(e => e.type === startedType && e.clip?.startsWith('impact_ceramic_')), '暂停前真实陶瓷音开始');
            audio.pause(true);
            await until(ctx, () => voices().every(v => !v.playing), '暂停真实停止所有音源');
            const paused = voices(), pauseRejected = !audio.play('star_lost', .65, 'qa-paused');
            const countAtPause = startedCount(); audio.pause(false);
            await until(ctx, ({ elapsed }) => elapsed >= .35, '恢复后的无补播观察');
            fail(pauseRejected && startedCount() === countAtPause && voices().every(v => !v.playing), '暂停/恢复重播了旧音效', { paused, events: events.slice(pauseStart) });
            const pauseEvidence = { stopped: paused, rejected: pauseRejected, noReplay: startedCount() === countAtPause };
            fail(platform.writeSettings({ ...savedSettings, sound: false }), '声音关闭状态写入失败');
            const mutedStart = startedCount();
            const muted = mapping.map(([name], i) => ({ name, accepted: audio.play(name, .5, `qa-muted:${i}`) }));
            await until(ctx, ({ elapsed }) => elapsed >= .2, '声音关闭后的无播放观察');
            fail(muted.every(r => !r.accepted) && startedCount() === mutedStart && platform.readSettings().music === savedSettings.music,
                'sound=false未拒播或错误改动music设置', { muted, settings: platform.readSettings() });
            const hudUsed = Array.from(new Set(playback.map(item => item.expected)));
            fail(hudUsed.length === 20 && !hudUsed.includes('stable') && !hudUsed.includes('run_end'), 'HUD在用映射数量或场景归属错误', hudUsed);
            // Result owns run_end. Observe its actual onLoad playback before invoking the real
            // controller finish path; do not attach a Result clip to HUD or call a substitute player.
            audio.pause(true); cc.director.off(cc.Director.EVENT_AFTER_PHYSICS, tick);
            fail(platform.writeSettings({ ...savedSettings, sound: true }), '结算声音fixture临时开启失败');
            const originalPlay = cc.AudioSource.prototype.play;
            cc.AudioSource.prototype.play = function (...args) {
                if (this.clip?.name === 'run_end') observeSource(this);
                return originalPlay.apply(this, args);
            };
            restoreResultObserver = () => { cc.AudioSource.prototype.play = originalPlay; };
            const resultEventStart = events.length;
            g.finish('audio_qa_end');
            await until(ctx, () => cc.director.getScene()?.name === 'Result' &&
                events.slice(resultEventStart).some(e => e.type === startedType && e.clip === 'run_end') &&
                events.slice(resultEventStart).some(e => e.type === endedType && e.clip === 'run_end'),
            '真实结束进入Result并完成run_end', 7000, { allowSceneChange: true, event: cc.Director.EVENT_AFTER_UPDATE });
            const resultAction = cc.director.getScene().getChildByName('Canvas').getComponent('StackSceneActions');
            const resultEvents = events.slice(resultEventStart).filter(e => e.clip === 'run_end');
            const result = { scene: cc.director.getScene().name, boundClip: resultAction.resultSound?.name,
                duration: resultAction.resultSound?.getDuration(), events: resultEvents };
            fail(result.boundClip === 'run_end' && resultEvents.every(e => e.scene === 'Result') &&
                resultEvents.filter(e => e.type === startedType).length === 1 && resultEvents.filter(e => e.type === endedType).length === 1,
                'Result原绑定或真实播放次数不正确', result);
            return { isolation: 'HUD真实调用compiled GameAudio.play映射并监听AudioSource STARTED/ENDED；音效fixture暂时停用玩法控制器、自行推进音频时钟。末尾通过真实finish进入Result，窄范围观察其onLoad的run_end。临时sound设置及play观察封装均在finally恢复；不声称HUD声音均由自然碰撞触发。',
                clips: hudClips, coverage: { hudBound: hudClips.length, hudUsed, hudUsedCount: 20, resultUsed: ['run_end'], totalUsedCount: 21, unused: ['stable'] },
                playback, samePair, multiBusyPair, priority, pause: pauseEvidence, muted, result, events,
                notProven: ['扬声器实际听感', '所有自然物理触发映射', '微信及移动设备中断恢复', '背景音乐或未启用stable高光事件'] };
        } finally {
            if (cc.isValid(g, true)) audio.pause(true);
            cc.director.off(cc.Director.EVENT_AFTER_PHYSICS, tick);
            restoreResultObserver?.();
            for (const { node, type, callback } of listeners) if (cc.isValid(node, true)) node.off(type, callback);
            if (savedRaw === null) cc.sys.localStorage.removeItem(settingsKey); else cc.sys.localStorage.setItem(settingsKey, savedRaw);
            fail(cc.sys.localStorage.getItem(settingsKey) === savedRaw, '音频fixture未恢复原始设置');
        }
    }
    const tests = [
        ['three-stars', '第三次分离事故立即失败', threeStars], ['chain', '同事故多件掉落只扣一星', chain],
        ['collapse', '旧塔数量型失败', collapse], ['resume', '规划、NEXT 与倒计时恢复', resume],
        ['frozen', 'N/K 与边界不随展示变化', frozen], ['support', '屏下有效支撑保留', support],
        ['presolve', '同子步越界不传递碰撞冲量', presolve], ['motor', '已有MotorJoint失效无后续拖拽', motors],
        ['toilet', '凹形马桶多Fixture失效过滤', toilet], ['assist', '深层辅助与脱离关闭', assist],
        ['audio', 'A3真实音源事件、强碰撞优先与停止', audioCheck],
    ];
    async function runChecks(list) {
        if (!report.ready || report.busy) return;
        report.busy = true; $('modeLabel').textContent = '定向故障检查 · 不代表正常玩法'; render();
        try {
            for (const [id, name, action] of list) {
                const item = { id, name, status: 'running', startedAt: new Date().toISOString() };
                report.results.push(item); status(`正在检查：${name}`); render();
                const errorStart = report.errors.length;
                try { item.evidence = await action(); item.status = 'passed'; }
                catch (error) { item.status = 'failed'; item.error = String(error.stack || error); item.evidence = error.evidence || currentState(); }
                finally {
                    item.finishedAt = new Date().toISOString(); item.engineErrors = report.errors.slice(errorStart);
                    fixtureCleanup?.(); fixtureCleanup = null;
                    const [w, h] = $('size').value.split(','); frame.width = w; frame.height = h;
                    render();
                }
            }
            status('本次定向检查完成；查看逐项结果。可以重新开始正常试玩。');
        } finally { report.busy = false; render(); }
    }
    async function begin(untimed) {
        if (!report.ready || report.busy) return;
        report.busy = true; render();
        try {
            await fresh(untimed);
            $('modeLabel').textContent = untimed ? '正常六物体试玩 · 无计时' : '正常六物体试玩 · 4 秒 / 首局前两件豁免';
            status('已开始，可拖动并松手释放；旋转仅通过右下按钮。');
        } catch (error) { status(String(error)); }
        finally { report.busy = false; render(); }
    }
    $('start').onclick = () => begin(false); $('untimed').onclick = () => begin(true);
    function manualAction(name, action) {
        if (!report.ready || report.busy) return;
        const win = frame.contentWindow, g = win.qaGame?.();
        if (!g || !g.enabled) { status('请先选择正常试玩模式。定向故障场景不能作为普通试玩。'); return; }
        const before = currentState();
        try {
            action(g);
            const after = currentState();
            report.manualActions.push({ name, at: new Date().toISOString(), before, after });
            status(name === 'center-release' && before.game?.releases === after.game?.releases ? '当前仍在进入、事故或等待阶段，本次没有释放。' : `已执行真实控制器操作：${name}`);
        } catch (error) { status(String(error)); captureError(error, 'manual-controller-action'); }
        render();
    }
    $('release-center').onclick = () => manualAction('center-release', g => { g.moveTo(0); g.release(); });
    $('rotate-current').onclick = () => manualAction('rotate', g => g.rotate());
    $('checkpoint').onclick = () => manualAction('checkpoint', () => {});
    $('finish').onclick = () => { if (!report.busy) { fixtureCleanup?.(); fixtureCleanup = null; frame.contentWindow.qaGame()?.finish(); status('已按审阅操作结束本轮。'); } };
    $('size').onchange = event => { const [w, h] = event.target.value.split(','); frame.width = w; frame.height = h; };
    for (const test of tests) $(`check-${test[0]}`).onclick = () => runChecks([test]);
    $('check-all').onclick = () => runChecks(tests);
    $('export').onclick = () => {
        const blob = new Blob([JSON.stringify({ ...report, exportedAt: new Date().toISOString(), finalState: currentState() }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob), link = document.createElement('a');
        link.href = url; link.download = `batch1b-checks-${new Date().toISOString().replaceAll(':', '-')}.json`; link.click(); URL.revokeObjectURL(url);
    };
    window.addEventListener('message', async event => {
        if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
        if (event.data?.type === 'play-error') { status(event.data.error); captureError(event.data.error, 'engine-startup'); return; }
        if (event.data?.type !== 'play-ready' || report.ready) return;
        try {
            installFrameErrors(frame.contentWindow);
            await frame.contentWindow.qaLoad('HUD');
            const g = frame.contentWindow.qaGame(); g.enabled = false;
            report.ready = true; status('引擎就绪。选择试玩模式或一项定向检查。'); render();
        } catch (error) { status(String(error)); captureError(error, 'engine-ready'); }
    });
    setInterval(() => {
        const state = currentState(); $('state').textContent = JSON.stringify(state, null, 2);
        const g = state.game;
        $('manualSummary').textContent = g ? `阶段 ${g.phase} · 已释放 ${g.releases} · 已放稳 ${g.placed} · ${g.peakMetres.toFixed(2)} m · ${g.stars} 星 · 当前 ${g.bodies.find(b => b.id === g.currentId)?.kind || '无'} · 已记录 ${report.manualActions.length} 次操作/检查点` : '当前不是试玩场景。';
    }, 200);
})();
