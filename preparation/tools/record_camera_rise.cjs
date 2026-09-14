/** Directed six-box drops in the real engine. No repositioning or freezing landed bodies. */
const { chromium } = require('/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'preparation/review/evidence/batch1a');
const report = { status: 'running', kind: 'directed_real_engine_drops', steps: [], errors: [] };
(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 375, height: 667 },
        recordVideo: { dir: path.join(ROOT, 'temp/contact-video'), size: { width: 375, height: 667 } } });
    const page = await context.newPage();
    const start = Date.now();
    page.on('pageerror', e => report.errors.push(String(e)));
    try {
        await page.goto('http://127.0.0.1:8767/preparation/review/play-player.html');
        await page.waitForFunction(() => !!window.qaLoad, null, { timeout: 45000 });
        await page.evaluate(() => window.qaLoad('HUD'));
        await page.waitForFunction(() => window.qaGame()?.snapshot().phase === 'planning');
        await page.evaluate(async () => {
            const cc = window.qaCC, g = window.qaGame();
            g.enabled = false; g.audio.pause(true); g.world.dispose(); g.display.dispose();
            await new Promise(r => requestAnimationFrame(r));
            const { TowerWorld } = await System.import('chunks:///_virtual/tower-world.ts');
            const { PlayView } = await System.import('chunks:///_virtual/play-view.ts');
            const { OBJECTS } = await System.import('chunks:///_virtual/object-data.ts');
            window.specs = OBJECTS; window.steady = 0; window.heldFixture = null;
            g.world = new TowerWorld(cc.director.getScene());
            g.display = new PlayView(g.node, new Map(g.frames.map(f => [f.name, f])));
            g.display.setNext('cardboard_box');
            cc.director.on(cc.Director.EVENT_AFTER_PHYSICS, () => {
                g.display.update(1 / 60, g.world.bodies, window.heldFixture, 1);
                window.steady = g.world.isStable() ? window.steady + 1 : 0;
            });
        });
        report.video_start_seconds = (Date.now() - start) / 1000;
        for (let i = 0; i < 6; i++) {
            await page.evaluate(() => {
                const g = window.qaGame(), boundary = g.display.beginPlacement();
                window.heldFixture = g.world.create(window.specs.cardboard_box, 0, boundary.top - 50);
                g.display.setHint(''); window.steady = 0;
            });
            await page.evaluate(() => new Promise(r => setTimeout(r, 350)));
            await page.evaluate(() => {
                window.qaGame().world.release(window.heldFixture); window.heldFixture = null; window.steady = 0;
            });
            await page.waitForFunction(() => window.steady >= 40, null, { timeout: 15000 });
            const step = await page.evaluate(() => {
                const g = window.qaGame(); g.world.bodies.at(-1).placed = true;
                const top = g.world.confirmedTop(); g.display.setHeight(top); g.display.follow(top);
                return { top, bodies: g.world.bodies.map(r => ({ id: r.id, position: r.node.position.clone(),
                    contacts: r.contacts.size, type: r.body.type, scale: r.node.worldScale.x })) };
            });
            report.steps.push(step);
            process.stdout.write(`Box ${i + 1}: ${(step.top / 100).toFixed(2)}m\n`);
            await page.evaluate(() => new Promise(r => setTimeout(r, 700)));
            if (i === 0 || i === 5) await page.screenshot({ path: path.join(OUT, `14-tower-${i + 1}-boxes.png`) });
        }
        report.final_view = await page.evaluate(() => window.qaGame().display.snapshot());
        if (report.errors.length) throw Error(JSON.stringify(report.errors));
        report.status = 'passed_six_consecutive_drops';
        await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));
    } catch (e) { report.status = 'failed'; report.failure = String(e.stack || e); process.exitCode = 1; }
    finally {
        report.video_duration_seconds = (Date.now() - start) / 1000 - (report.video_start_seconds || 0);
        await context.close();
        await page.video().saveAs(path.join(OUT, 'camera-rise-raw.webm'));
        fs.writeFileSync(path.join(OUT, 'CAMERA_RISE.json'), JSON.stringify(report, null, 2) + '\n');
        await browser.close();
        process.stdout.write(JSON.stringify({ status: report.status, steps: report.steps.length, failure: report.failure }) + '\n');
    }
})();
