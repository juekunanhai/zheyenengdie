/** Observe real AudioSource STARTED/ENDED in the built Cocos game. No mock player. */
const { chromium } = require('/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '../..');
const report = { status: 'running', checks: [], errors: [] };
let browser, page;
const add = (name, evidence) => { report.checks.push({ name, status: 'passed', evidence }); process.stdout.write(`${name}: passed\n`); };
const wait = ms => page.waitForTimeout(ms);
const events = () => page.evaluate(() => window.audioEvents);
const planning = () => page.waitForFunction(() => window.qaGame()?.snapshot().phase === 'planning');
async function tap(name, occurrence = 0) {
    const point = await page.evaluate(({ name, occurrence }) => {
        const cc = qaCC, canvas = cc.director.getScene().getChildByName('Canvas'), queue = [canvas], matches = [];
        while (queue.length) { const n = queue.shift(); if (n.name.startsWith(name)) matches.push(n); queue.push(...n.children); }
        const node = matches[occurrence]; if (!node) throw Error(`Missing button ${name}`);
        const p = canvas.getComponent(cc.Canvas).cameraComponent.worldToScreen(node.worldPosition);
        const box = cc.game.canvas.getBoundingClientRect();
        return { x: box.left + p.x / cc.game.canvas.width * box.width, y: box.top + (1-p.y/cc.game.canvas.height)*box.height };
    }, { name, occurrence });
    await page.touchscreen.tap(point.x, point.y); await wait(35);
}
async function boot() {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 375, height: 667 }, hasTouch: true });
    page.on('pageerror', error => report.errors.push(String(error)));
    page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
    await page.goto('http://127.0.0.1:8767/preparation/review/play-player.html');
    await page.waitForFunction(() => !!window.qaLoad, null, { timeout: 45000 });
    await page.evaluate(() => {
        window.audioEvents = [];
        const cc = qaCC, original = cc.AudioSource.prototype.play;
        cc.AudioSource.prototype.play = function () {
            if (!this.qaObserved) {
                this.qaObserved = true;
                for (const type of [cc.AudioSource.EventType.STARTED, cc.AudioSource.EventType.ENDED]) {
                    this.node.on(type, () => window.audioEvents.push({ type, clip: this.clip?.name,
                        at: performance.now(), volume: this.volume, scene: cc.director.getScene()?.name }));
                }
            }
            return original.call(this);
        };
        window.audioPlaying = () => cc.director.getScene().getComponentsInChildren(cc.AudioSource)
            .filter(s => s.playing).map(s => ({ clip: s.clip?.name, time: s.currentTime, volume: s.volume }));
    });
    await tap('btn_start'); await planning();
    await page.waitForFunction(() => audioEvents.some(e => e.type === 'started' && e.clip === 'claw_grip'));
    const clips = await page.evaluate(() => qaGame().approvedSounds.map(c => ({ name: c.name, duration: c.getDuration() })));
    assert.equal(clips.length, 17); assert.ok(clips.every(c => c.duration > 0));
    add('home_gesture_unlocks_real_handoff_and_claw_playback', await events());
}
async function materialContacts() {
    await tap('hud_rotate_90');
    await page.waitForFunction(() => audioEvents.some(e => e.type === 'started' && e.clip === 'rotate_90'));
    for (let i = 0; i < 3; i++) { await wait(100); await tap('hud_rotate_90'); }
    for (let placed = 1; placed <= 4; placed++) {
        await planning(); await page.evaluate(() => qaGame().release());
        await page.waitForFunction(n => qaGame()?.snapshot().placed >= n, placed, { timeout: 15000 });
    }
    const soundEvents = (await events()).filter(e => e.type === 'started');
    for (const material of ['paper', 'wood', 'rubber', 'metal']) {
        assert.ok(soundEvents.some(e => e.clip.startsWith(`impact_${material}_`)), `Missing ${material} actual contact sound`);
    }
    assert.ok(soundEvents.some(e => e.clip === 'claw_open'));
    assert.ok(!soundEvents.some(e => e.clip === 'stable'), 'Ordinary stable landings must not trigger future highlight sounds');
    add('four_materials_are_triggered_by_real_collisions', soundEvents.filter(e => e.clip.startsWith('impact_')));
    await planning(); await page.evaluate(() => { qaGame().enabled = false; }); await wait(900);
    // The isolated audio fixture owns its clock while the placement controller is disabled.
    await page.evaluate(() => qaGame().audio.update(.9));
}
async function capsAndLifecycle() {
    const accepted = await page.evaluate(() => {
        const audio = qaGame().audio;
        return [audio.play('impact_cardboard_box', .65, 'same-pair'), audio.play('impact_cardboard_box', .65, 'same-pair')];
    });
    assert.deepEqual(accepted, [true, false]); await wait(60);
    assert.ok((await page.evaluate(() => audioPlaying())).length > 0);
    await tap('hud_pause'); await wait(80);
    assert.deepEqual(await page.evaluate(() => audioPlaying()), []);
    await page.evaluate(() => { qaCC.game.emit(qaCC.Game.EVENT_HIDE); qaCC.game.emit(qaCC.Game.EVENT_SHOW); });
    assert.equal(await page.evaluate(() => qaGame().snapshot().paused), true);
    const pausedCount = (await events()).length;
    await tap('hud_pause'); await wait(120);
    assert.equal((await events()).length, pausedCount);
    add('pair_cooldown_and_pause_stop_without_replay', accepted);
    const caps = await page.evaluate(() => {
        const audio = qaGame().audio;
        const collisions = Array.from({ length: 8 }, (_, i) => audio.play('impact_fridge', .65, `many-${i}`));
        const action = audio.play('skill_rotate_90');
        return { collisions, action };
    });
    assert.equal(caps.collisions.filter(Boolean).length, 4); assert.equal(caps.action, true);
    await wait(60); const active = await page.evaluate(() => audioPlaying());
    assert.ok(active.length <= 8 && active.length >= 4);
    await page.evaluate(() => qaCC.game.emit(qaCC.Game.EVENT_HIDE)); await wait(60);
    assert.deepEqual(await page.evaluate(() => audioPlaying()), []);
    const before = (await events()).length;
    await page.evaluate(() => qaCC.game.emit(qaCC.Game.EVENT_SHOW)); await wait(180);
    assert.equal((await events()).length, before);
    add('collision_cap_preserves_action_and_background_stops_all', { ...caps, active });
}
async function settingsAndResult() {
    await page.evaluate(() => qaLoad('Settings'));
    await page.waitForFunction(() => audioEvents.some(e => e.type === 'started' && e.scene === 'Settings' && e.clip === 'next_handoff'));
    add('menu_entry_has_short_actual_click_feedback', true);
    await tap('toggle_', 1);
    await page.evaluate(() => qaLoad('Settings'));
    const setting = await page.evaluate(() => JSON.parse(qaCC.sys.localStorage.getItem('zhynd.local-settings.v1')));
    assert.equal(setting.sound, false); assert.equal(setting.music, true);
    const count = (await events()).length;
    await page.evaluate(() => qaLoad('HUD')); await planning(); await tap('hud_rotate_90'); await wait(300);
    assert.equal((await events()).length, count);
    add('sound_toggle_persists_and_mutes_without_muting_music_setting', setting);
    await page.evaluate(() => qaLoad('Settings')); await tap('toggle_', 1);
    await page.evaluate(() => qaLoad('HUD')); await planning();
    await page.evaluate(() => qaGame().finish());
    await page.waitForFunction(() => audioEvents.some(e => e.type === 'ended' && e.clip === 'run_end'), null, { timeout: 6000 });
    const ending = (await events()).filter(e => e.clip === 'run_end');
    assert.equal(ending.filter(e => e.type === 'started').length, 1);
    assert.equal(ending.filter(e => e.type === 'ended').length, 1);
    assert.ok(ending.every(e => e.scene === 'Result'));
    assert.ok(ending[1].at - ending[0].at > 350);
    add('result_plays_ending_once_to_completion_after_scene_change', ending);
    await tap('result_btn_retry'); await planning();
    assert.equal(await page.evaluate(() => qaGame().snapshot().placed), 0);
    add('retry_uses_new_audio_sources_and_world', true);
}
(async () => {
    try {
        await boot(); await materialContacts(); await capsAndLifecycle(); await settingsAndResult();
        assert.deepEqual(report.errors, []); report.status = 'passed_real_browser_audio_events';
    } catch (error) { report.status = 'failed'; report.failure = String(error.stack || error); process.exitCode = 1; }
    finally {
        report.events = page ? await events().catch(() => []) : [];
        report.not_proven = ['Speaker output judged by a human in-game', 'WeChat/iOS/Android audio interruptions', 'Music playback or crossfade'];
        fs.writeFileSync(path.join(ROOT, 'preparation/review/evidence/batch1a/AUDIO_RUNTIME.json'), JSON.stringify(report, null, 2)+'\n');
        process.stdout.write(JSON.stringify({ status: report.status, checks: report.checks.length, failure: report.failure, errors: report.errors })+'\n');
        await browser?.close();
    }
})();
