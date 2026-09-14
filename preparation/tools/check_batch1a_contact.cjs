/** Real-engine contact/scroll regression. Fixtures and overlays never enter game assets. */
const { chromium } = require('/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'preparation/review/evidence/batch1a');
const report = { status: 'running', checks: [], contacts: [], errors: [] };
let browser, page;
const add = (name, evidence) => { report.checks.push({ name, status: 'passed', evidence }); process.stdout.write(name + ': passed\n'); };
const wait = ms => page.evaluate(ms => new Promise(r => setTimeout(r, ms)), ms);

async function fresh() {
    await page.evaluate(() => {
        if (window.fixturePaint) window.qaCC.director.off(window.qaCC.Director.EVENT_AFTER_PHYSICS, window.fixturePaint);
    });
    await page.evaluate(() => window.qaLoad('HUD'));
    await page.waitForFunction(() => window.qaGame()?.snapshot().phase === 'planning');
    await page.evaluate(async () => {
        const cc = window.qaCC, g = window.qaGame();
        g.enabled = false; g.audio.pause(true); g.world.dispose(); g.display.dispose();
        await new Promise(r => requestAnimationFrame(r));
        const { TowerWorld } = await System.import('chunks:///_virtual/tower-world.ts');
        const { PlayView } = await System.import('chunks:///_virtual/play-view.ts');
        window.objectData = await System.import('chunks:///_virtual/object-data.ts');
        window.fixture = g.world = new TowerWorld(cc.director.getScene());
        g.display = new PlayView(g.node, new Map(g.frames.map(f => [f.name, f])));
        g.current = null; window.contactSamples = {}; window.stableFrames = 0;
        window.fixturePaint = () => {
            g.display.update(1 / 60, window.fixture.bodies, null, 1);
            window.stableFrames = window.fixture.isStable() ? window.stableFrames + 1 : 0;
        };
        cc.director.on(cc.Director.EVENT_AFTER_PHYSICS, window.fixturePaint);
        window.spawnFixture = (kind, x, y, angle = 0) => {
            window.stableFrames = 0;
            const r = window.fixture.create(window.objectData.OBJECTS[kind], x, y);
            r.node.setRotationFromEuler(0, 0, angle);
            r.collider.on(cc.Contact2DType.PRE_SOLVE, (self, other, contact) => {
                const m = contact.getWorldManifold();
                window.contactSamples[r.id + ':' + other.node.name] = {
                    kind, id: r.id, other: other.node.name, requestedAngle: angle,
                    spec: r.spec, points: m.points.map(p => {
                        const local = r.body.getLocalPoint(p, new cc.Vec2());
                        return { world: { x: p.x, y: p.y }, local: { x: local.x, y: local.y } };
                    }), separations: [...m.separations],
                };
            });
            window.fixture.release(r); return r.id;
        };
    });
}

async function capture(name, overlay = false) {
    if (overlay) await page.evaluate(() => {
        const cc = window.qaCC, g = window.qaGame(), view = g.display.snapshot();
        const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', `0 0 ${innerWidth} ${innerHeight}`);
        svg.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:10';
        const camera = g.node.getComponent(cc.Canvas).cameraComponent;
        const screen = p => {
            const world = g.display.safe.getComponent(cc.UITransform).convertToWorldSpaceAR(
                new cc.Vec3(p.x * view.scale, view.originY + (p.y - view.cameraY) * view.scale, 0));
            const pixel = camera.worldToScreen(world);
            return { x: pixel.x / cc.game.canvas.width * innerWidth, y: (1 - pixel.y / cc.game.canvas.height) * innerHeight };
        };
        const draw = (tag, attributes) => {
            const n = document.createElementNS(ns, tag);
            Object.entries(attributes).forEach(([k, v]) => n.setAttribute(k, String(v))); svg.append(n);
        };
        for (const r of window.fixture.bodies) {
            if (r.spec.circle) {
                const p = screen(r.node.position), edge = screen({ x: r.node.position.x + r.spec.width / 2, y: r.node.position.y });
                draw('circle', { cx: p.x, cy: p.y, r: edge.x - p.x, fill: 'none', stroke: '#00e69c', 'stroke-width': 1.5 });
            } else {
                const points = r.spec.outline.map(([x, y]) => {
                    const p = screen(r.body.getWorldPoint(new cc.Vec2(x, y), new cc.Vec2()));
                    return `${p.x},${p.y}`;
                }).join(' ');
                draw('polygon', { points, fill: 'none', stroke: '#00e69c', 'stroke-width': 1.5 });
            }
        }
        for (const sample of Object.values(window.contactSamples)) for (const point of sample.points) {
            const p = screen(point.world); draw('circle', { cx: p.x, cy: p.y, r: 2.5, fill: '#ff4650' });
        }
        document.body.append(svg); window.overlayNode = svg;
    });
    await wait(70);
    await page.screenshot({ path: path.join(OUT, name + '.png') });
    if (overlay) await page.evaluate(() => window.overlayNode.remove());
}

async function orientations() {
    await fresh();
    await page.evaluate(() => {
        const cc = window.qaCC;
        window.fixture.platform.size = new cc.Size(10000, 24); window.fixture.platform.apply();
        let i = 0;
        for (const kind of Object.keys(window.objectData.OBJECTS)) for (const angle of [0, 90, 180, 270]) {
            const half = window.objectData.halfExtents(window.objectData.OBJECTS[kind], angle);
            window.spawnFixture(kind, (i++ - 7.5) * 350, half.y + 160, angle);
        }
    });
    await page.waitForFunction(() => window.stableFrames >= 40, null, { timeout: 15000 });
    const states = await page.evaluate(() => window.fixture.bodies.map(r => ({ kind: r.spec.kind,
        angle: window.objectData.planarAngle(r.node.rotation), contacts: r.contacts.size,
        bodyScale: r.node.worldScale.x, bounds: window.fixture.bounds(r) })));
    assert.equal(states.length, 16);
    assert.ok(states.every(s => s.contacts > 0 && Math.abs(s.bodyScale - 1) < 1e-8));
    assert.ok(states.every(s => Math.abs(s.bounds.bottom) < 1));
    report.contacts.push(...await page.evaluate(() => Object.values(window.contactSamples)));
    add('four_materials_four_orientations_real_support', states);
}

async function stackAndCamera() {
    await fresh();
    for (const [kind, y] of [['cardboard_box', 180], ['wood_plank', 300], ['fridge', 380], ['basketball', 420]]) {
        report.stage = `stack:${kind}`;
        await page.evaluate(({ kind, y }) => window.spawnFixture(kind, 0, y), { kind, y });
        await page.waitForFunction(() => window.stableFrames >= 40, null, { timeout: 12000 });
    }
    const stack = await page.evaluate(() => window.fixture.bodies.map(r => ({ kind: r.spec.kind,
        x: r.node.position.x, angle: window.objectData.planarAngle(r.node.rotation), contacts: r.contacts.size })));
    assert.ok(stack.every(s => s.contacts > 0));
    report.contacts.push(...await page.evaluate(() => Object.values(window.contactSamples)));
    add('four_object_stack_contacts', stack);
    await page.evaluate(() => window.qaGame().display.setHeight(window.fixture.bodies.reduce((top, r) =>
        Math.max(top, window.fixture.bounds(r).top), 0)));
    await capture('10-contact-stack'); await capture('11-contact-overlay', true);
    const anchors = () => page.evaluate(() => {
        const g = window.qaGame(), cc = window.qaCC;
        const names = ['hud_pause', 'hud_rotate_90', 'InventoryColumn', 'Text:0.0', 'next_basketball'];
        return { view: g.display.snapshot(), physics: window.fixture.bodies.map(r => r.node.position.clone()),
            groundY: g.node.getChildByName('bg_ground_city').position.y,
            platformY: g.display.platform.position.y,
            hud: names.map(name => g.display.safe.getChildByName(name).worldPosition.clone()) };
    });
    const before = await anchors();
    await page.evaluate(() => {
        const d = window.qaGame().display, v = d.snapshot();
        const threshold = (v.height * .05 - v.originY) / v.scale;
        d.follow(threshold + 100);
    });
    await page.waitForFunction(() => window.qaGame().display.snapshot().cameraY > 99.99);
    const after = await anchors();
    assert.ok(Math.abs(after.groundY - before.groundY - (after.platformY - before.platformY)) < .01);
    assert.ok(after.groundY < before.groundY - 174);
    assert.deepEqual(after.hud, before.hud);
    assert.ok(after.physics.every((p, i) => Math.abs(p.y - before.physics[i].y) < 1));
    add('ground_platform_same_camera_hud_fixed_physics_preserved', { before, after });
    await capture('12-camera-one-metre');
    for (const metres of [8, 55, 160]) {
        await page.evaluate(m => {
            const d = window.qaGame().display, v = d.snapshot();
            d.follow((v.height * .05 - v.originY) / v.scale + m * 100);
        }, metres);
        await page.waitForFunction(m => window.qaGame().display.snapshot().cameraY > m * 100 - .01, metres);
        await capture(`13-altitude-${metres}m`);
        const coverage = await page.evaluate(() => {
            const cc = window.qaCC, g = window.qaGame(), canvas = g.node.getComponent(cc.UITransform);
            return g.node.children.filter(n => n.name.startsWith('bg_') && !n.name.endsWith(':sky') && n.active).map(n => {
                const rect = n.getComponent(cc.UITransform), edge = g.node.getChildByName(n.name + ':sky');
                return { name: n.name, imageTop: n.position.y + rect.height / 2,
                    skyBottom: edge.position.y - edge.getComponent(cc.UITransform).height / 2,
                    skyTop: edge.position.y + edge.getComponent(cc.UITransform).height / 2,
                    canvasTop: canvas.height / 2 };
            });
        });
        assert.ok(coverage.every(s => s.skyTop >= s.canvasTop && s.skyBottom <= Math.max(-s.canvasTop, s.imageTop) + 1));
        add(`altitude-${metres}-sky-coverage`, coverage);
    }
}

async function main() {
    fs.mkdirSync(OUT, { recursive: true });
    try {
        browser = await chromium.launch({ headless: true });
        page = await browser.newPage({ viewport: { width: 375, height: 667 } });
        page.on('pageerror', e => report.errors.push(String(e)));
        await page.goto('http://127.0.0.1:8767/preparation/review/play-player.html');
        await page.waitForFunction(() => !!window.qaLoad, null, { timeout: 45000 });
        await orientations(); await stackAndCamera();
        assert.deepEqual(report.errors, []); report.status = 'passed_runtime_contact_and_camera';
    } catch (e) {
        report.status = 'failed'; report.failure = String(e.stack || e); process.exitCode = 1;
        report.lastState = await page.evaluate(() => window.fixture?.bodies.map(r => ({ kind: r.spec.kind,
            x: r.node.position.x, y: r.node.position.y, velocity: r.body.linearVelocity.clone(),
            angle: window.objectData.planarAngle(r.node.rotation), contacts: r.contacts.size }))).catch(() => null);
    }
    finally {
        fs.writeFileSync(path.join(OUT, 'CONTACT_CAMERA.json'), JSON.stringify(report, null, 2) + '\n');
        process.stdout.write(JSON.stringify({ status: report.status, checks: report.checks.length,
            stage: report.stage, failure: report.failure, lastState: report.lastState, errors: report.errors }) + '\n');
        await browser?.close();
    }
}
main();
