/* Engine QA only: explicit interaction markers and synthetic button events are not real touch evidence. */
(() => {
    'use strict';
    const $ = id => document.getElementById(id), frame = $('player'), clone = x => JSON.parse(JSON.stringify(x));
    const report = window.homeMusicR4QA = { schema: 'home-music-r4-engine', createdAt: new Date().toISOString(), results: [], errors: [], ready: false, busy: false };
    const assert = (ok, message, evidence) => {
        if (!ok) {
            const e = Error(message);
            e.evidence = evidence;
            throw e;
        }
    };
    const status = message => {
        $('status').textContent = message;
    };
    const actions = ctx => ctx.cc.director.getScene()?.getChildByName('Canvas')?.getComponent('StackSceneActions');
    const scene = ctx => ctx.cc.director.getScene()?.name;
    const sourceState = (ctx, source) => ({ valid: !!source && ctx.cc.isValid(source, true), clip: source && ctx.cc.isValid(source, true) ? source.clip?.name : null, playing: !!source && ctx.cc.isValid(source, true) && source.playing, time: source && ctx.cc.isValid(source, true) ? source.currentTime : null, volume: source && ctx.cc.isValid(source, true) ? source.volume : null });
    function state() {
        try {
            const win = frame.contentWindow, cc = win.qaCC, ctx = { win, cc }, a = cc && actions(ctx);
            return { scene: cc?.director.getScene()?.name, home: a && { suspended: a.homeSuspended, gain: a.homeMusicGain, music: sourceState(ctx, a.homeMusic) }, game: win.qaGame?.()?.snapshot() ?? null };
        }
        catch (e) {
            return { error: String(e) };
        }
    }
    function render() {
        $('qaResults').textContent = JSON.stringify(report, null, 2);
        $('summary').textContent = `${report.results.filter(r => r.status === 'passed').length} 项通过 / ${report.results.filter(r => r.status === 'failed').length} 项失败`;
        document.querySelectorAll('button').forEach(b => b.disabled = !report.ready || report.busy);
        $('export').disabled = report.busy || !report.results.length;
        frame.style.pointerEvents = report.busy ? 'none' : 'auto';
    }
    function until(ctx, predicate, label, timeout = 15000) {
        return new Promise((resolve, reject) => {
            let elapsed = 0, done = false;
            const finish = (e, v) => {
                if (done)
                    return;
                done = true;
                clearTimeout(timer);
                ctx.cc.director.off(ctx.cc.Director.EVENT_AFTER_UPDATE, tick);
                e ? reject(e) : resolve(v);
            };
            const tick = () => {
                try {
                    elapsed += Math.min(.1, Math.max(0, ctx.cc.game.deltaTime));
                    const value = predicate(elapsed);
                    if (value)
                        finish(null, value);
                }
                catch (e) {
                    finish(e);
                }
            };
            const timer = setTimeout(() => {
                const e = Error(`${label}：超时`);
                e.evidence = state();
                finish(e);
            }, timeout);
            ctx.cc.director.on(ctx.cc.Director.EVENT_AFTER_UPDATE, tick);
        });
    }
    function watch(ctx, source, tag) {
        if (!source)
            return null;
        const known = ctx.sources.find(v => v.source === source);
        if (known)
            return known;
        const item = { source, tag, id: ctx.sources.length + 1 };
        ctx.sources.push(item);
        for (const type of ['STARTED', 'ENDED']) {
            const event = ctx.cc.AudioSource.EventType[type], listener = () => ctx.events.push({ id: item.id, tag, type, at: performance.now(), clip: source.clip?.name ?? null });
            source.node.on(event, listener);
            ctx.cleanups.push(() => source.node?.off(event, listener));
        }
        return item;
    }
    function scan(ctx) {
        const a = actions(ctx);
        if (a?.homeMusic)
            watch(ctx, a.homeMusic, 'A');
        const g = ctx.win.qaGame?.();
        for (const v of g?.music?.voices ?? [])
            watch(ctx, v.source, 'B');
        for (const v of g?.audio?.voices ?? [])
            watch(ctx, v.source, 'sfx');
    }
    const started = (ctx, item) => ctx.events.filter(e => e.id === item.id && e.type === 'STARTED').length;
    const playingMusic = ctx => ctx.sources.filter(v => v.tag !== 'sfx' && sourceState(ctx, v.source).playing);
    function tap(ctx, node) {
        assert(node, '按钮节点不存在');
        const e = { getID: () => 902, propagationStopped: false };
        node.emit(ctx.cc.Node.EventType.TOUCH_START, e);
        node.emit(ctx.cc.Node.EventType.TOUCH_END, e);
    }
    const content = ctx => ctx.cc.director.getScene().getChildByName('Canvas').getChildByName('SafeArea').getChildByName('Content_1230');
    async function freshHome(ctx, start = true) {
        ctx.platform.writeSettings({ ...ctx.settings, music: false, sound: true });
        await ctx.win.qaLoad('Home');
        const a = actions(ctx);
        assert(a && typeof a.syncHomeMusic === 'function' && a.homeMusicClip, '当前构建没有首页音乐 R4');
        ctx.platform.markUserInteraction();
        ctx.platform.writeSettings({ ...ctx.settings, music: true, sound: true });
        if (start) {
            a.syncHomeMusic();
            scan(ctx);
            assert(a.homeMusic, '首页音乐请求未创建声源');
        }
        return a;
    }
    async function audibleHome(ctx) {
        const a = await freshHome(ctx), item = watch(ctx, a.homeMusic, 'A');
        await until(ctx, () => started(ctx, item) > 0 && a.homeMusic?.playing && a.homeMusicGain >= .275, '首页 A 实际开始');
        return { a, item };
    }
    async function enterHUD(ctx) {
        const a = actions(ctx);
        assert(scene(ctx) === 'Home', '导航应从首页开始');
        tap(ctx, content(ctx).getChildByName('btn_start'));
        await until(ctx, () => scene(ctx) === 'HUD' && ctx.win.qaGame?.(), '真实开始按钮进入 HUD');
        const g = ctx.win.qaGame();
        assert(g.configureCalibration(g.snapshot().sequence, true), 'HUD 无计时校准不可用');
        scan(ctx);
        await until(ctx, () => g.music.snapshot().gain >= .275 && g.music.snapshot().sources.some(s => s.playing), 'B 实际播放至 0.28');
        assert(ctx.events.some(e => e.tag === 'B' && e.type === 'STARTED'), '没有捕获 B 的实际 STARTED', ctx.events);
        return g;
    }
    async function loop(ctx) {
        const { a, item } = await audibleHome(ctx), source = item.source, duration = source.duration;
        assert(Number.isFinite(duration) && duration > 0 && duration < 100, '首页音乐长度不可用于本轮循环检查', { duration });
        let previous = source.currentTime, wrap = null;
        const before = sourceState(ctx, source);
        await until(ctx, elapsed => {
            const current = source.currentTime;
            if (previous > duration - .4 && current < .4 && previous - current > duration / 2)
                wrap = { previous, current, elapsed, duration, playing: source.playing };
            previous = current;
            return wrap;
        }, '首页 A 自然回绕', (duration + 12) * 1000);
        assert(wrap.playing && a.homeMusic === source && playingMusic(ctx).length === 1, '循环时声源失效或重复播放', state());
        return { mode: 'actual A AudioSource / natural wrap / no currentTime changes', before, wrap, after: sourceState(ctx, source), events: ctx.events };
    }
    async function navigation(ctx) {
        const { item } = await audibleHome(ctx), old = item.source, g = await enterHUD(ctx);
        await until(ctx, elapsed => elapsed >= .3, '导航后取消完成');
        assert(!sourceState(ctx, old).valid && playingMusic(ctx).length === 1, '首页旧声源未销毁或与 B 叠播', ctx.sources.map(v => ({ tag: v.tag, ...sourceState(ctx, v.source) })));
        const normal = { old: sourceState(ctx, old), music: g.music.snapshot() };
        const a = await freshHome(ctx, false);
        a.syncHomeMusic();
        const pending = watch(ctx, a.homeMusic, 'A'), before = started(ctx, pending);
        assert(before === 0 && !pending.source.playing, '未建立播放开始前的导航取消夹具', sourceState(ctx, pending.source));
        tap(ctx, content(ctx).getChildByName('btn_start'));
        const immediate = { source: sourceState(ctx, pending.source), homeMusic: a.homeMusic };
        assert(!pending.source.clip && !sourceState(ctx, pending.source).playing, '导航没有立即解除首页 clip', { source: immediate.source });
        await until(ctx, () => scene(ctx) === 'HUD', '在途取消后进入 HUD');
        const next = ctx.win.qaGame();
        next.configureCalibration(next.snapshot().sequence, true);
        await until(ctx, elapsed => elapsed >= .4, '检查迟到 A');
        assert(started(ctx, pending) === before && !sourceState(ctx, pending.source).valid, '取消后首页音频迟到启动', { events: ctx.events, old: sourceState(ctx, pending.source) });
        return { mode: 'actual bound start-button handler; interaction marker set explicitly', normal, immediate: immediate.source, cancelled: sourceState(ctx, pending.source), events: ctx.events };
    }
    async function settings(ctx) {
        const { item } = await audibleHome(ctx), observations = [];
        for (const enabled of [false, true]) {
            tap(ctx, content(ctx).getChildByName('btn_settings_icon'));
            await until(ctx, () => scene(ctx) === 'Settings', '进入设置');
            assert(playingMusic(ctx).length === 0, '设置页面残留音乐');
            const toggle = content(ctx).children.filter(n => n.name.startsWith('toggle_'))[0];
            tap(ctx, toggle);
            assert(ctx.platform.readSettings().music === enabled, '音乐按钮未保存预期设置');
            tap(ctx, content(ctx).getChildByName('btn_settings_base'));
            await until(ctx, () => scene(ctx) === 'Home', '从设置返回首页');
            if (enabled)
                await until(ctx, () => actions(ctx).homeMusic?.playing && actions(ctx).homeMusicGain >= .275, '重新打开音乐后 A 播放');
            else
                await until(ctx, elapsed => elapsed >= .35, '关闭音乐后保持静音');
            assert(playingMusic(ctx).length === (enabled ? 1 : 0), '返回首页音乐源数量错误', state());
            observations.push({ enabled, home: state().home, playing: playingMusic(ctx).length });
        }
        assert(!sourceState(ctx, item.source).valid, '第一次首页声源仍未销毁');
        return { mode: 'synthetic touch events through existing Settings handlers; no Settings BGM', observations, events: ctx.events };
    }
    async function visibility(ctx) {
        const { a, item } = await audibleHome(ctx);
        ctx.cc.game.emit(ctx.cc.Game.EVENT_HIDE);
        const hidden = { suspended: a.homeSuspended, music: sourceState(ctx, item.source), current: a.homeMusic };
        assert(hidden.suspended && !hidden.music.playing && !item.source.clip, '后台没有停止首页声音', { suspended: hidden.suspended, music: hidden.music });
        ctx.cc.game.emit(ctx.cc.Game.EVENT_SHOW);
        await until(ctx, () => a.homeMusic?.playing && a.homeMusic !== item.source, '后台返回新源播放');
        scan(ctx);
        const returned = sourceState(ctx, a.homeMusic);
        assert(playingMusic(ctx).length === 1, '后台返回重复声源');
        const quick = await freshHome(ctx, false);
        quick.syncHomeMusic();
        const pending = watch(ctx, quick.homeMusic, 'A'), before = started(ctx, pending);
        assert(before === 0 && !pending.source.playing, '未建立播放开始前的后台取消夹具', sourceState(ctx, pending.source));
        ctx.cc.game.emit(ctx.cc.Game.EVENT_HIDE);
        ctx.cc.game.emit(ctx.cc.Game.EVENT_SHOW);
        scan(ctx);
        await until(ctx, elapsed => elapsed >= .4, '快速隐藏返回后的迟到回调');
        assert(started(ctx, pending) === before && !sourceState(ctx, pending.source).valid, '快速返回使旧异步加载复活', { events: ctx.events, old: sourceState(ctx, pending.source) });
        await until(ctx, () => quick.homeMusic?.playing, '快速返回当前源播放');
        assert(playingMusic(ctx).length === 1, '快速后台返回存在叠音');
        return { mode: 'simulated Game hide/show including immediate pending-play cancellation', hidden: { suspended: hidden.suspended, music: hidden.music }, returned, rapidReturned: sourceState(ctx, quick.homeMusic), events: ctx.events };
    }
    async function mix(ctx) {
        await freshHome(ctx);
        const g = await enterHUD(ctx), before = clone(g.music.snapshot());
        assert(Math.abs(before.gain - .28) < .005, '正常 B 增益不是 0.28', before);
        assert(g.audio.play('voice_chuckle'), '人声未接受播放');
        await until(ctx, () => ctx.events.some(e => e.tag === 'sfx' && e.type === 'STARTED' && e.clip === 'voice_chuckle'), '短笑实际开始');
        await until(ctx, () => g.music.snapshot().gain <= .095, '人声期间降到 0.09');
        const ducked = clone(g.music.snapshot());
        await until(ctx, () => !g.audio.isReacting() && g.music.snapshot().gain >= .275, 'B 恢复至 0.28');
        const restored = clone(g.music.snapshot()), transitions = [];
        let height = 0;
        g.enabled = false;
        const drive = () => g.music.update(Math.min(.067, Math.max(0, ctx.cc.game.deltaTime)), height);
        ctx.cc.director.on(ctx.cc.Director.EVENT_AFTER_UPDATE, drive);
        try {
            for (const [target, nextHeight] of [['bgm_cloud', 60], ['bgm_space', 170]]) {
                height = nextHeight;
                const samples = [];
                await until(ctx, () => {
                    const m = g.music, current = m.voices[m.active], old = m.voices[m.fadingFrom];
                    if (old && current.ready && old.source.playing && current.source.playing) {
                        const length = current.source.duration, d = Math.abs(old.source.currentTime - current.source.currentTime) % length, gap = Math.min(d, length - d);
                        samples.push({ old: old.source.currentTime, current: current.source.currentTime, gap });
                        assert(gap <= .15, '三高度切换相位差超过 0.15s', samples.at(-1));
                    }
                    return m.snapshot().region === target && !m.snapshot().fading && current.ready && current.source.playing;
                }, `${target} 淡化完成`);
                assert(samples.length > 0, '未捕获真实两源交叉淡化');
                transitions.push({ height, samples, snapshot: g.music.snapshot() });
            }
            return { mode: 'actual HUD ducking; controlled height 60/170, not natural tower-height evidence', before, ducked, restored, transitions, events: ctx.events };
        }
        finally {
            ctx.cc.director.off(ctx.cc.Director.EVENT_AFTER_UPDATE, drive);
            g.enabled = true;
        }
    }
    async function rapid(ctx) {
        const observations = [];
        for (let i = 0; i < 3; i++) {
            const a = await freshHome(ctx), item = watch(ctx, a.homeMusic, 'A');
            if (i % 2 === 0)
                await until(ctx, () => item.source.playing, '交替用例首页播放');
            const g = await enterHUD(ctx);
            await until(ctx, elapsed => elapsed >= .2, '旧首页节点销毁');
            assert(!sourceState(ctx, item.source).valid && playingMusic(ctx).length === 1, '交替场景残留首页声源');
            const oldB = g.music.voices.map(v => v.source);
            await ctx.win.qaLoad('Home');
            await until(ctx, () => actions(ctx)?.homeMusic?.playing, 'QA 切回首页');
            await until(ctx, elapsed => elapsed >= .2, '旧 HUD 节点销毁');
            assert(oldB.every(source => !sourceState(ctx, source).valid) && playingMusic(ctx).length === 1, '切回首页残留 B 或叠音');
            observations.push({ round: i + 1, oldA: sourceState(ctx, item.source), oldB: oldB.map(source => sourceState(ctx, source)), home: state().home });
        }
        return { mode: '3 lifecycle stress rounds; Home start uses bound handler, HUD-to-Home uses explicit QA scene load', observations, events: ctx.events };
    }
    const checks = { loop, navigation, settings, visibility, mix, rapid };
    async function run(name) {
        const row = { name, status: 'running', startedAt: new Date().toISOString() };
        report.results.push(row);
        render();
        status(`正在检查：${name}`);
        let ctx;
        try {
            const win = frame.contentWindow, cc = win.qaCC, platform = await win.System.import('chunks:///_virtual/local-platform.ts');
            ctx = { win, cc, platform, settings: platform.readSettings(), events: [], sources: [], cleanups: [] };
            const observer = () => scan(ctx);
            cc.director.on(cc.Director.EVENT_BEFORE_UPDATE, observer);
            ctx.cleanups.push(() => cc.director.off(cc.Director.EVENT_BEFORE_UPDATE, observer));
            row.evidence = await checks[name](ctx);
            row.status = 'passed';
        }
        catch (e) {
            row.status = 'failed';
            row.error = String(e.stack || e);
            row.evidence = e.evidence ?? state();
            if (ctx)
                row.events = ctx.events;
        }
        finally {
            if (ctx) {
                ctx.platform.writeSettings(ctx.settings);
                ctx.cc.game.emit(ctx.cc.Game.EVENT_SHOW);
                const g = ctx.win.qaGame?.();
                if (g && ctx.cc.isValid(g, true)) {
                    g.enabled = true;
                    if (g.lifecycle.paused)
                        g.lifecycle.togglePause();
                }
                ctx.cleanups.forEach(off => off());
            }
            row.completedAt = new Date().toISOString();
            render();
        }
    }
    async function batch(names) {
        report.busy = true;
        render();
        try {
            for (const name of names)
                await run(name);
        }
        finally {
            report.busy = false;
            status('检查完成，结果与失败原因见 JSON。');
            render();
        }
    }
    for (const name of Object.keys(checks))
        $(`check-${name}`).onclick = () => batch([name]);
    $('check-all').onclick = () => batch(Object.keys(checks));
    $('home').onclick = async () => {
        await frame.contentWindow.qaLoad('Home');
        status('普通试玩：真实触碰首页后开始。');
    };
    $('practice').onclick = async () => {
        const win = frame.contentWindow;
        await win.qaLoad('HUD');
        const g = win.qaGame();
        g.configureCalibration(g.snapshot().sequence, true);
        status('对局无计时试玩：请在游戏内真实拖放。');
    };
    $('export').onclick = () => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })), a = document.createElement('a');
        a.href = url;
        a.download = `home-music-r4-${Date.now()}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    window.addEventListener('message', async (e) => {
        if (e.origin !== location.origin || e.source !== frame.contentWindow)
            return;
        if (e.data?.type === 'play-ready') {
            const win = frame.contentWindow;
            win.addEventListener('error', error => {
                report.errors.push({ source: 'engine', message: String(error.error || error.message) });
                render();
            });
            win.addEventListener('unhandledrejection', error => {
                report.errors.push({ source: 'engine-promise', message: String(error.reason) });
                render();
            });
            await win.qaLoad('Home');
            report.ready = true;
            status('首页已准备；冷启动请真实触碰解锁音乐。');
            render();
        }
        else if (e.data?.type === 'play-error') {
            report.errors.push(e.data.error);
            status(e.data.error);
            render();
        }
    });
    window.addEventListener('error', e => {
        report.errors.push(String(e.error || e.message));
        render();
    });
    window.addEventListener('unhandledrejection', e => {
        report.errors.push(String(e.reason));
        render();
    });
    setInterval(() => {
        $('state').textContent = JSON.stringify(state(), null, 2);
    }, 1000);
})();
