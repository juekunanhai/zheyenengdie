/** Actual compiled Home scene: local facial acting, static illustrated bodies, arm contact, and real input. */
'use strict';
const MODULES = '/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const { chromium } = require(MODULES + 'playwright');
const { PNG } = require(MODULES + 'pngjs');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'preparation/review/evidence/home-expression-r1');
const URL = 'http://127.0.0.1:8767/preparation/review/play-player.html?home-expression=r1';
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const span = rows => rows.length ? Math.max(...rows) - Math.min(...rows) : Infinity;
const canonicalAngle = value => ((value + 180) % 360 + 360) % 360 - 180;
const report = { startedAt: new Date().toISOString(), status: 'running', url: URL, checks: [], errors: [],
    method: 'Compiled HomePresentation with real after-draw frame sampling and Playwright canvas pointer input. '
        + 'Frame captures read the rendered canvas synchronously after draw, without changing scene time. '
        + 'Lifecycle checks emit production Game events, not native browser/WeChat lifecycle acceptance.',
    sourceSha256: hash(path.join(ROOT, 'assets/batch0/presentation/HomePresentation.ts')), scriptSha256: hash(__filename) };
const check = (id, pass, evidence) => report.checks.push({ id, pass: !!pass, evidence });
const save = () => fs.writeFileSync(path.join(OUT, 'home-expression-r1.json'), JSON.stringify(report, null, 2) + '\n');
const SOURCE_RECTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'preparation/design/home-expression-r1/face/manifest.json'))).assets;
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

async function installGeometry(page) {
    await page.evaluate(registry => {
        const canvas = () => qaCC.director.getScene().getChildByName('Canvas');
        const content = () => canvas().getChildByName('SafeArea').getChildByName('Content_1230');
        const vec = p => ({ x: p.x, y: p.y, z: p.z });
        const sourcePoint = (node, x, y, width, height) => {
            const ui = node.getComponent(qaCC.UITransform);
            return ui.convertToWorldSpaceAR(new qaCC.Vec3((x / width - ui.anchorX) * ui.width,
                (1 - y / height - ui.anchorY) * ui.height, 0));
        };
        const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
        const screen = p => canvas().getComponent(qaCC.Canvas).cameraComponent.worldToScreen(p);
        window.homeQA = { component: () => canvas().getComponent('HomePresentation'),
            node: name => content().getChildByName(name), sourcePoint, screen, distance, vec,
            snapshot: () => {
                const motion = homeQA.component().motionSnapshot(), hero = homeQA.node('R9Hero');
                const arm = hero.getChildByName('ToiletArm'), aui = arm.getComponent(qaCC.UITransform);
                const shoulder = sourcePoint(hero, 423.9, 800.9, 1024, 1536);
                const target = sourcePoint(hero, 262, 992, 1024, 1536);
                const fingertip = sourcePoint(arm, 88, 231, 291, 276);
                const faces = [['DuckBlink', 'R9Hero', 'duck'], ['CrateBlink', 'R9Hero', 'crate'],
                    ['ToiletLook', 'R9Hero', 'toilet'], ['SlipperFrontBlink', 'R9SlipperFront', 'slipper'],
                    ['SlipperBackBlink', 'R9SlipperBack', 'slipper']].map(([name, parentName, assetName]) => {
                    const parent = homeQA.node(parentName), node = parent.getChildByName(name);
                    const entry = registry.find(item => item.name === assetName), rect = entry.rect;
                    const expected = sourcePoint(parent, rect.left + rect.width / 2, rect.top + rect.height / 2,
                        ...entry.sourceSize), ui = node.getComponent(qaCC.UITransform);
                    const parentUI = parent.getComponent(qaCC.UITransform), sprite = node.getComponent(qaCC.Sprite);
                    return { name, active: node.active, centerError: distance(node.worldPosition, expected),
                        widthError: Math.abs(ui.width - rect.width * parentUI.width / entry.sourceSize[0]),
                        heightError: Math.abs(ui.height - rect.height * parentUI.height / entry.sourceSize[1]),
                        textureSize: sprite.spriteFrame && vec({ x: sprite.spriteFrame.originalSize.width,
                            y: sprite.spriteFrame.originalSize.height, z: 0 }),
                        expectedTextureSize: [rect.width, rect.height], trim: sprite.trim };
                });
                return { ...motion, geometry: { faces, shoulder: vec(arm.worldPosition), fingertip: vec(fingertip),
                    expectedShoulder: vec(shoulder), expectedTarget: vec(target),
                    shoulderError: distance(arm.worldPosition, shoulder), fingertipError: distance(fingertip, target),
                    armAnchor: { x: aui.anchorX, y: aui.anchorY }, frameCount: homeQA.component().characterFrames.length,
                    armFramePresent: !!arm.getComponent(qaCC.Sprite).spriteFrame },
                    scene: qaCC.director.getScene().name, viewport: { width: innerWidth, height: innerHeight } };
            },
        };
    }, SOURCE_RECTS);
}

async function installSampling(page) {
    await page.evaluate(() => {
        homeQA.point = name => {
            const node = homeQA.node(name), p = homeQA.screen(node.worldPosition);
            const element = document.getElementById('GameCanvas'), rect = element.getBoundingClientRect();
            const point = { x: rect.left + p.x / element.width * rect.width,
                y: rect.top + (1 - p.y / element.height) * rect.height };
            return { ...point, node: name, inside: point.x > 0 && point.x < innerWidth && point.y > 0 && point.y < innerHeight };
        };
        homeQA.pixelRect = (name, rect, source) => {
            const node = homeQA.node(name), canvas = document.getElementById('GameCanvas');
            const a = homeQA.screen(homeQA.sourcePoint(node, rect[0], rect[1], ...source));
            const b = homeQA.screen(homeQA.sourcePoint(node, rect[2], rect[3], ...source));
            const x = Math.max(0, Math.floor(Math.min(a.x, b.x))), y = Math.max(0, Math.floor(canvas.height - Math.max(a.y, b.y)));
            return { x, y, width: Math.min(canvas.width - x, Math.ceil(Math.abs(b.x - a.x))),
                height: Math.min(canvas.height - y, Math.ceil(Math.abs(b.y - a.y))) };
        };
        homeQA.sample = seconds => new Promise((resolve, reject) => {
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
        });
        homeQA.capture = kind => new Promise((resolve, reject) => {
            const timer = setTimeout(() => { qaCC.director.off(qaCC.Director.EVENT_AFTER_DRAW, read);
                reject(Error(`No actual rendered ${kind} frame in capture window`)); }, 12000);
            const read = () => {
                const snapshot = homeQA.snapshot();
                const wanted = kind === 'grip' ? snapshot.acting.arm.active && snapshot.acting.arm.gripping
                    : snapshot.acting.faces.some(face => face.name === kind && face.active);
                if (!wanted) return;
                const rect = kind === 'CrateBlink' ? [260, 1040, 690, 1380] : kind === 'grip'
                    ? [60, 730, 500, 1140] : [310, 40, 670, 600];
                const detail = homeQA.pixelRect('R9Hero', rect, [1024, 1536]);
                const png = document.getElementById('GameCanvas').toDataURL('image/png');
                clearTimeout(timer); qaCC.director.off(qaCC.Director.EVENT_AFTER_DRAW, read);
                resolve({ snapshot, png, detail });
            };
            qaCC.director.on(qaCC.Director.EVENT_AFTER_DRAW, read);
        });
    });
}

async function openPage(recordVideo = false) {
    context = await browser.newContext({ viewport: { width: 375, height: 667 }, hasTouch: true,
        ...(recordVideo ? { recordVideo: { dir: path.join(OUT, 'video-raw'), size: { width: 375, height: 667 } } } : {}) });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(String(error)));
    await page.goto(URL);
    await page.waitForFunction(() => window.qaLoad && qaCC.director.getScene()?.name === 'Home'
        && qaCC.director.getScene().getChildByName('Canvas').getComponent('HomePresentation')?.motionSnapshot?.().acting,
    null, { timeout: 45000 });
    await installGeometry(page); await installSampling(page);
    return page;
}

async function clickNode(page, name) {
    const point = await page.evaluate(name => homeQA.point(name), name);
    check(`${name}_input_center_in_viewport_${report.checks.length}`, point.inside, point);
    await page.mouse.click(point.x, point.y);
    return point;
}

function saveCapture(name, capture) {
    const file = `${name}.png`, bytes = Buffer.from(capture.png.split(',')[1], 'base64');
    fs.writeFileSync(path.join(OUT, file), bytes);
    const png = PNG.sync.read(bytes), rect = capture.detail;
    const cropped = new PNG({ width: rect.width, height: rect.height });
    PNG.bitblt(png, cropped, rect.x, rect.y, rect.width, rect.height, 0, 0);
    fs.writeFileSync(path.join(OUT, `${name}-detail.png`), PNG.sync.write(cropped));
    let opaque = 0, min = 255, max = 0;
    for (let i = 0; i < png.data.length; i += 4) {
        if (png.data[i + 3] > 200) opaque++;
        min = Math.min(min, png.data[i]); max = Math.max(max, png.data[i]);
    }
    check(`${name}_actual_canvas_is_not_blank`, opaque > png.width * png.height * .85 && max - min > 150,
        { opaqueFraction: opaque / (png.width * png.height), redRange: [min, max] });
    return { file, detailFile: `${name}-detail.png`, detailBounds: rect, snapshot: capture.snapshot };
}

function verifyNatural(samples) {
    report.motionRanges = {};
    for (const name of ['R9Hero', 'R9SlipperBack', 'R9SlipperFront', 'R9WoodBoard', 'logo_main']) {
        const rows = samples.map(sample => sample.elements.find(element => element.name === name));
        const ranges = Object.fromEntries(['x', 'y', 'scaleX', 'scaleY', 'angle'].map(key => [key, span(rows.map(row => row[key]))]));
        report.motionRanges[name] = ranges;
        check(`${name}_remains_planted_for_ten_seconds`, Object.values(ranges).every(value => value < .00001), ranges);
    }
    report.faceTransitions = {};
    for (const name of ['DuckBlink', 'CrateBlink', 'ToiletLook', 'SlipperFrontBlink', 'SlipperBackBlink']) {
        const transitions = samples.filter((row, index) => row.acting.faces.find(face => face.name === name).active
            && (!index || !samples[index - 1].acting.faces.find(face => face.name === name).active)).map(row => row.elapsed);
        report.faceTransitions[name] = transitions;
        check(`${name}_has_real_on_and_off_frames`, transitions.length > 0
            && samples.some(row => !row.acting.faces.find(face => face.name === name).active), { onAt: transitions });
    }
    const first = Object.values(report.faceTransitions).map(times => times[0]).sort((a, b) => a - b);
    check('five_characters_begin_expressions_at_distinct_times', first.every(Number.isFinite)
        && first.slice(1).every((value, index) => value - first[index] > .12), first);
    const active = samples.filter(row => row.acting.arm.active);
    const hold = active.filter(row => row.acting.arm.gripping);
    const reach = active.filter(row => row.acting.age < .62), retract = active.filter(row => row.acting.age > 1.12);
    check('arm_reaches_holds_and_retracts', reach.length > 3 && hold.length > 3 && retract.length > 3
        && canonicalAngle(reach[0].acting.arm.angle) < canonicalAngle(reach.at(-1).acting.arm.angle)
        && canonicalAngle(retract[0].acting.arm.angle) > canonicalAngle(retract.at(-1).acting.arm.angle),
    { reachFrames: reach.length, holdFrames: hold.length, retractFrames: retract.length });
    check('arm_shoulder_stays_attached_through_entire_gesture', active.length > 0
        && active.every(row => row.geometry.shoulderError < .005)
        && span(active.map(row => row.geometry.shoulder.x)) < .005
        && span(active.map(row => row.geometry.shoulder.y)) < .005);
    check('gripping_fingertips_stay_at_illustrated_crate_contact', hold.length > 3
        && hold.every(row => row.geometry.fingertipError < .005 && Math.abs(canonicalAngle(row.acting.arm.angle)) < .001
            && row.acting.arm.opacity > 254), { maximumContactError: Math.max(...hold.map(row => row.geometry.fingertipError), 0) });
    check('natural_sample_is_ten_seconds_of_rendered_frames', samples.length > 150 && samples.at(-1).wallSeconds >= 10,
        { frames: samples.length, seconds: samples.at(-1).wallSeconds });
}

async function verifyTapAndLifecycle(page) {
    await page.waitForFunction(() => homeQA.snapshot().acting.age < -.5);
    const before = await page.evaluate(() => homeQA.snapshot());
    await clickNode(page, 'R9Hero');
    await page.waitForTimeout(45);
    const triggered = await page.evaluate(() => homeQA.snapshot());
    const schedule = triggered.elapsed - triggered.acting.age;
    report.tap = { before, triggered, repeats: [] };
    check('real_hero_tap_starts_expression_without_navigation', before.acting.age < 0 && triggered.acting.age >= 0
        && triggered.acting.age < .3 && triggered.scene === 'Home' && schedule >= before.elapsed - .05);
    for (let i = 0; i < 3; i++) {
        await clickNode(page, 'R9Hero'); await page.waitForTimeout(65);
        report.tap.repeats.push(await page.evaluate(() => homeQA.snapshot()));
    }
    check('repeated_real_taps_do_not_restart_or_queue_current_gesture', report.tap.repeats.every(row =>
        Math.abs(row.elapsed - row.acting.age - schedule) < .0001)
        && report.tap.repeats.at(-1).acting.age > triggered.acting.age + .1);
    await page.waitForFunction(() => homeQA.snapshot().acting.arm.active);
    report.lifecycle = await page.evaluate(async () => {
        const before = homeQA.snapshot(); qaCC.game.emit(qaCC.Game.EVENT_HIDE);
        const hidden = [homeQA.snapshot()]; await new Promise(resolve => setTimeout(resolve, 450));
        hidden.push(homeQA.snapshot()); qaCC.game.emit(qaCC.Game.EVENT_SHOW);
        const resumed = await homeQA.sample(.5); return { before, hidden, resumed };
    });
    check('hide_event_clears_local_faces_and_hand', report.lifecycle.before.acting.arm.active
        && report.lifecycle.hidden.every(row => row.hidden && !row.acting.arm.active && row.acting.faces.every(face => !face.active)));
    check('hide_event_freezes_clock_and_show_resumes_without_stale_hand', span(report.lifecycle.hidden.map(row => row.elapsed)) < .0001
        && report.lifecycle.resumed.every(row => !row.hidden && !row.acting.arm.active)
        && report.lifecycle.resumed.at(-1).elapsed - report.lifecycle.hidden.at(-1).elapsed > .3);
}

function verifyRegistration(sample, suffix) {
    check(`six_finished_expression_frames_present_${suffix}`, sample.geometry.frameCount === 6 && sample.geometry.armFramePresent);
    check(`eye_frames_match_source_pixels_${suffix}`, sample.geometry.faces.every(face => face.centerError < .005
        && face.widthError < .001 && face.heightError < .001 && !face.trim && face.textureSize
        && face.textureSize.x === face.expectedTextureSize[0] && face.textureSize.y === face.expectedTextureSize[1]), sample.geometry.faces);
    check(`shoulder_anchor_matches_art_${suffix}`, Math.abs(sample.geometry.armAnchor.x - 249.9 / 291) < .00001
        && Math.abs(sample.geometry.armAnchor.y - (1 - 39.9 / 276)) < .00001 && sample.geometry.shoulderError < .005,
    { anchor: sample.geometry.armAnchor, error: sample.geometry.shoulderError });
}

async function verifyFitAndInput(page) {
    report.fit = []; report.fitCaptures = [];
    for (const viewport of [{ width: 375, height: 667 }, { width: 390, height: 844 }, { width: 375, height: 667 }]) {
        await page.setViewportSize(viewport); await page.waitForTimeout(250);
        const suffix = `${viewport.width}x${viewport.height}_${report.fit.length}`;
        const sample = await page.evaluate(() => homeQA.snapshot());
        report.fit.push(sample); verifyRegistration(sample, suffix);
        for (const name of ['btn_start', 'btn_settings_icon']) {
            const point = await page.evaluate(name => homeQA.point(name), name);
            check(`${name}_responsive_input_${suffix}`, point.inside, point);
        }
        if (report.fit.length <= 2) {
            await page.waitForFunction(() => homeQA.snapshot().acting.age < -.2);
            await clickNode(page, 'R9Hero');
            const capture = await page.evaluate(() => homeQA.capture('grip'));
            report.fitCaptures.push(saveCapture(`grip-${viewport.width}x${viewport.height}`, capture));
            check(`real_tap_grip_contact_registered_${suffix}`, capture.snapshot.geometry.fingertipError < .005);
        }
    }
    check('return_to_short_screen_has_no_accumulated_layout_offset', report.fit[0].elements.every(item => {
        const other = report.fit[2].elements.find(element => element.name === item.name);
        return Math.abs(item.restX - other.restX) < .001 && Math.abs(item.restY - other.restY) < .001;
    }));
    await clickNode(page, 'btn_settings_icon');
    await page.waitForFunction(() => qaCC.director.getScene()?.name === 'Settings');
    check('real_settings_click_enters_settings', true);
    await clickNode(page, 'btn_settings_base');
    await page.waitForFunction(() => qaCC.director.getScene()?.name === 'Home');
    check('real_settings_return_enters_home', true);
    const point = await page.evaluate(() => homeQA.point('btn_start'));
    await page.mouse.move(point.x, point.y); await page.mouse.down(); await page.waitForTimeout(220);
    report.startHeld = await page.evaluate(() => homeQA.snapshot());
    const button = report.startHeld.elements.find(element => element.name === 'btn_start');
    check('start_button_keeps_pressed_feedback', Math.abs(button.scaleX - .96) < .002 && Math.abs(button.scaleY - .96) < .002,
        { scaleX: button.scaleX, scaleY: button.scaleY });
    await page.mouse.up(); await page.waitForFunction(() => qaCC.director.getScene()?.name === 'HUD');
    check('real_start_release_enters_gameplay', true);
}

(async () => {
    try {
        fs.mkdirSync(OUT, { recursive: true });
        report.buildSha256Before = buildHash(); save();
        browser = await chromium.launch({ headless: true });
        let page = await openPage(true);
        const [samples, duck, crate, grip] = await Promise.all([
            page.evaluate(() => homeQA.sample(10)), page.evaluate(() => homeQA.capture('DuckBlink')),
            page.evaluate(() => homeQA.capture('CrateBlink')), page.evaluate(() => homeQA.capture('grip')),
        ]);
        report.natural = samples; verifyNatural(samples); verifyRegistration(samples[0], 'natural-short');
        report.captures = [saveCapture('natural-duck-blink', duck), saveCapture('natural-crate-blink', crate),
            saveCapture('natural-grip', grip)];
        const video = page.video(); await context.close(); context = null;
        await video.saveAs(path.join(OUT, 'home-expression-natural-375x667.webm'));
        report.video = 'home-expression-natural-375x667.webm';
        report.videoNote = 'Actual 375x667 engine recording includes loading and ten seconds of untouched natural Home animation.';
        page = await openPage(false);
        await verifyTapAndLifecycle(page); await verifyFitAndInput(page);
        report.buildSha256After = buildHash();
        check('built_package_unchanged_during_qa', report.buildSha256After === report.buildSha256Before);
        check('source_unchanged_during_qa', report.sourceSha256 === hash(path.join(ROOT, 'assets/batch0/presentation/HomePresentation.ts')));
        report.status = report.checks.every(item => item.pass) && !report.errors.length ? 'passed' : 'failed';
    } catch (error) { report.status = 'failed'; report.failure = String(error.stack || error); }
    finally {
        await context?.close(); await browser?.close();
        report.finishedAt = new Date().toISOString(); save();
        process.stdout.write(JSON.stringify({ status: report.status, checks: report.checks, errors: report.errors, failure: report.failure }) + '\n');
        if (report.status !== 'passed') process.exitCode = 1;
    }
})();
