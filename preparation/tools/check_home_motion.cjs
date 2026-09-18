/** Actual compiled Home scene: sampled transforms, real canvas input and production lifecycle events. */
'use strict';
const { chromium } = require('/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'preparation/review/evidence/camera-impact-r1');
const URL = 'http://127.0.0.1:8767/preparation/review/play-player.html?home-motion=r1';
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report = { startedAt: new Date().toISOString(), status: 'running', url: URL, checks: [], errors: [],
    method: 'Compiled HomePresentation, real rendered frame samples and Playwright canvas pointer actions. '
        + 'Hide/show are explicit production Game events, not a claim of native browser or WeChat lifecycle acceptance.',
    sourceSha256: hash(path.join(ROOT, 'assets/batch0/presentation/HomePresentation.ts')), scriptSha256: hash(__filename) };
fs.mkdirSync(OUT, { recursive: true });
const save = () => fs.writeFileSync(path.join(OUT, 'home-r1.json'), JSON.stringify(report, null, 2) + '\n');
const check = (id, pass, evidence) => report.checks.push({ id, pass: !!pass, evidence });
const span = values => Math.max(...values) - Math.min(...values);
let browser, context;

function buildHash() {
    const base = path.join(ROOT, 'build/web-desktop'), lines = [];
    const visit = dir => { for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, item.name);
        if (item.isDirectory()) visit(file); else lines.push(`${path.relative(base, file)}:${hash(file)}`);
    } };
    visit(base);
    return crypto.createHash('sha256').update(lines.sort().join('\n')).digest('hex');
}

async function openPage(recordVideo = false) {
    context = await browser.newContext({ viewport: { width: 375, height: 667 }, hasTouch: true,
        ...(recordVideo ? { recordVideo: { dir: path.join(OUT, 'home-video-raw'), size: { width: 375, height: 667 } } } : {}) });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(String(error)));
    await page.goto(URL);
    await page.waitForFunction(() => window.qaLoad && qaCC.director.getScene()?.name === 'Home'
        && qaCC.director.getScene().getChildByName('Canvas').getComponent('HomePresentation')?.motionSnapshot,
    null, { timeout: 45000 });
    await page.evaluate(() => {
        const canvas = () => qaCC.director.getScene().getChildByName('Canvas');
        const content = () => canvas().getChildByName('SafeArea').getChildByName('Content_1230');
        window.homeQA = {
            component: () => canvas().getComponent('HomePresentation'),
            node: name => content().getChildByName(name),
            snapshot: () => {
                const motion = homeQA.component().motionSnapshot();
                const hero = homeQA.node('R9Hero'), board = homeQA.node('R9WoodBoard');
                const anchor = (node, normalizedY) => {
                    const ui = node.getComponent(qaCC.UITransform);
                    const p = ui.convertToWorldSpaceAR(new qaCC.Vec3(0, ui.height * (normalizedY - .5), 0));
                    return { x: p.x, y: p.y, z: p.z };
                };
                return { ...motion, heroAnchor: anchor(hero, 29 / 1536), boardAnchor: anchor(board, .94),
                    scene: qaCC.director.getScene().name, viewport: { width: innerWidth, height: innerHeight } };
            },
            point: name => {
                const node = homeQA.node(name), camera = canvas().getComponent(qaCC.Canvas).cameraComponent;
                const screen = camera.worldToScreen(node.worldPosition);
                const element = document.getElementById('GameCanvas'), rect = element.getBoundingClientRect();
                const point = { x: rect.left + screen.x / element.width * rect.width,
                    y: rect.top + (1 - screen.y / element.height) * rect.height };
                return { ...point, node: name, screen: { x: screen.x, y: screen.y },
                    canvas: { width: element.width, height: element.height, left: rect.left, top: rect.top,
                        cssWidth: rect.width, cssHeight: rect.height }, inside: point.x > 0 && point.x < innerWidth
                            && point.y > 0 && point.y < innerHeight };
            },
            sample: seconds => new Promise((resolve, reject) => {
                const rows = [], started = performance.now();
                const timer = setTimeout(() => { qaCC.director.off(qaCC.Director.EVENT_AFTER_DRAW, read);
                    reject(Error('Rendered Home sample timed out')); }, seconds * 1000 + 6000);
                const read = () => {
                    rows.push({ wallSeconds: (performance.now() - started) / 1000, ...homeQA.snapshot() });
                    if (performance.now() - started >= seconds * 1000) {
                        clearTimeout(timer); qaCC.director.off(qaCC.Director.EVENT_AFTER_DRAW, read); resolve(rows);
                    }
                };
                qaCC.director.on(qaCC.Director.EVENT_AFTER_DRAW, read);
            }),
        };
    });
    return page;
}

async function clickNode(page, name) {
    const point = await page.evaluate(name => homeQA.point(name), name);
    check(`${name}_input_center_in_viewport`, point.inside, point);
    await page.mouse.click(point.x, point.y);
    return point;
}

function checkMotion(samples) {
    const names = ['R9Hero', 'R9SlipperBack', 'R9SlipperFront', 'R9WoodBoard', 'logo_main', 'HomeAirship', 'HomeAirplane', 'btn_start'];
    report.motionRanges = {};
    for (const name of names) {
        const rows = samples.map(sample => sample.elements.find(element => element.name === name));
        const ranges = Object.fromEntries(['x', 'y', 'scaleX', 'scaleY', 'angle'].map(key => [key, span(rows.map(row => row[key]))]));
        report.motionRanges[name] = ranges;
        check(`${name}_actually_animates`, ranges.x > .1 || ranges.y > .1 || ranges.angle > .1 || ranges.scaleX > .003, ranges);
    }
    for (const anchor of ['heroAnchor', 'boardAnchor']) {
        const drift = Math.hypot(span(samples.map(row => row[anchor].x)), span(samples.map(row => row[anchor].y)));
        check(`${anchor}_stays_at_illustrated_support`, drift < .005, { driftWorldUnits: drift });
    }
    const settings = samples.map(row => row.elements.find(element => element.name === 'btn_settings_icon'));
    check('settings_stays_readable_static', ['x', 'y', 'scaleX', 'scaleY', 'angle'].every(key => span(settings.map(row => row[key])) < .0001));
    check('frames_sampled_for_seven_seconds', samples.length > 120 && samples.at(-1).wallSeconds >= 7,
        { frames: samples.length, seconds: samples.at(-1).wallSeconds });
}

async function verifyTapAndLifecycle(page) {
    await clickNode(page, 'R9Hero');
    report.heroTap = await page.evaluate(() => homeQA.sample(.7));
    const peak = Math.max(...report.heroTap.map(sample => Math.abs(sample.elements.find(e => e.name === 'R9Hero').angle)));
    check('real_hero_tap_wobbles_without_navigation', peak > .8 && report.heroTap.every(sample => sample.scene === 'Home'), { peakDegrees: peak });
    report.lifecycle = await page.evaluate(async () => {
        const before = homeQA.snapshot();
        qaCC.game.emit(qaCC.Game.EVENT_HIDE);
        const hidden = [homeQA.snapshot()];
        await new Promise(resolve => setTimeout(resolve, 450));
        hidden.push(homeQA.snapshot());
        qaCC.game.emit(qaCC.Game.EVENT_SHOW);
        const resumed = await homeQA.sample(.45);
        return { before, hidden, resumed };
    });
    check('production_hide_event_freezes_motion_clock', report.lifecycle.hidden.every(row => row.hidden)
        && span(report.lifecycle.hidden.map(row => row.elapsed)) < .0001);
    check('production_show_event_resumes_motion_clock', report.lifecycle.resumed.every(row => !row.hidden)
        && report.lifecycle.resumed.at(-1).elapsed - report.lifecycle.hidden.at(-1).elapsed > .25);
}

async function verifyFitAndInput(page) {
    report.fit = [];
    for (const viewport of [{ width: 375, height: 667 }, { width: 390, height: 844 }, { width: 375, height: 667 }]) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(250);
        const sample = await page.evaluate(() => homeQA.snapshot());
        report.fit.push(sample);
        for (const name of ['btn_start', 'btn_settings_icon']) {
            const point = await page.evaluate(name => homeQA.point(name), name);
            check(`${name}_responsive_input_${viewport.width}x${viewport.height}_${report.fit.length}`, point.inside, point);
        }
    }
    const first = report.fit[0].elements, returned = report.fit[2].elements;
    check('resize_return_rest_poses_do_not_accumulate', first.every(item => {
        const other = returned.find(element => element.name === item.name);
        return Math.abs(item.restX - other.restX) < .001 && Math.abs(item.restY - other.restY) < .001;
    }));
    await clickNode(page, 'btn_settings_icon');
    await page.waitForFunction(() => qaCC.director.getScene()?.name === 'Settings');
    check('real_settings_click_enters_settings', true);
    await clickNode(page, 'btn_settings_base');
    await page.waitForFunction(() => qaCC.director.getScene()?.name === 'Home');
    const point = await page.evaluate(() => homeQA.point('btn_start'));
    await page.mouse.move(point.x, point.y); await page.mouse.down();
    await page.waitForTimeout(220);
    report.startHeld = await page.evaluate(() => homeQA.snapshot());
    const button = report.startHeld.elements.find(element => element.name === 'btn_start');
    check('real_start_press_retains_point96_scale', Math.abs(button.scaleX - .96) < .002 && Math.abs(button.scaleY - .96) < .002,
        { scaleX: button.scaleX, scaleY: button.scaleY, scene: report.startHeld.scene });
    await page.mouse.up();
    await page.waitForFunction(() => qaCC.director.getScene()?.name === 'HUD');
    check('real_start_release_enters_gameplay', true);
}

(async () => {
    try {
        report.buildSha256Before = buildHash(); save();
        browser = await chromium.launch({ headless: true });
        let page = await openPage(true);
        report.motion = await page.evaluate(() => homeQA.sample(7));
        checkMotion(report.motion);
        await page.screenshot({ path: path.join(OUT, 'home-current.png') });
        const video = page.video();
        await context.close(); context = null;
        await video.saveAs(path.join(OUT, 'home-current.webm'));
        report.video = 'home-current.webm';
        report.videoNote = 'Actual recorded 375x667 engine page; includes load followed by seven seconds of untouched Home animation.';
        page = await openPage(false);
        await verifyTapAndLifecycle(page);
        await verifyFitAndInput(page);
        report.buildSha256After = buildHash();
        check('built_package_unchanged_during_run', report.buildSha256After === report.buildSha256Before);
        report.status = report.checks.every(item => item.pass) && !report.errors.length ? 'passed' : 'failed';
    } catch (error) {
        report.status = 'failed'; report.failure = String(error.stack || error);
    } finally {
        await context?.close(); await browser?.close();
        report.finishedAt = new Date().toISOString(); save();
        process.stdout.write(JSON.stringify({ status: report.status, checks: report.checks, errors: report.errors, failure: report.failure }) + '\n');
        if (report.status !== 'passed') process.exitCode = 1;
    }
})();
