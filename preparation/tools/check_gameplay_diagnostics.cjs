/** Follow-up diagnostics of predeclared negative results; never changes gameplay parameters. */
const { chromium } = require('/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../..'), OUT = path.join(ROOT, 'preparation/review/evidence/gameplay-shapes/CHOICES_DIAGNOSTICS.json');
const report = { status: 'running', createdAt: new Date().toISOString(), method: {
  purpose: 'Diagnose negative outcomes after the primary experiment. These finer samples are not substituted into its strategy scores.',
  scan: 'Dynamic upright toilet support; one box or fridge at x=-40..5 in increments of 5, angle 0, unchanged 80-unit release clearance.',
  supportInterpretation: 'Current whole-system mass-weighted COM x and observed ground contact x span are a static necessary clue, not a sufficient dynamic stability criterion.',
  separationUnits: 'Creator 3.8.8 box2d-wasm/physics-contact.ts lines130-145 reads native manifold pointCount, truncates points/separations to that count, and multiplies both by PTM_RATIO=32. Recorded separations therefore use Cocos world units, not metres.',
  boundary: 'These fixtures exclude the normal claw/camera placement height and incident rules. They do not estimate normal demo survival rate.' },
  sources: {}, toiletScan: [], continuations: [], traces: [], replay: [], errors: [] };
for (const file of ['assets/batch1/object-data.ts', 'assets/batch1/tower-world.ts', 'preparation/review/gameplay-lab.js'])
  report.sources[file] = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex');
let browser, page;
const save = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
async function tracedTrial(scenario, actions) {
  return page.evaluate(async ({ scenario, actions }) => {
    const cc = window.qaCC, physics = cc.PhysicsSystem2D.instance, original = physics.postUpdate;
    const observed = new WeakSet(), groundContacts = new Map(), frames = [], deepContacts = [];
    let index = 0, stepContacts = [];
    const summary = () => {
      const world = window.qaGame().world;
      const bodies = world.bodies.map(r => {
        const center = r.body.getWorldCenter(new cc.Vec2());
        return { id: r.id, kind: r.spec.kind, x: r.node.position.x, y: r.node.position.y,
          angle: Math.atan2(2 * r.node.rotation.w * r.node.rotation.z, 1 - 2 * r.node.rotation.z ** 2) * 180 / Math.PI,
          mass: r.body.getMass(), com: { x: center.x, y: center.y }, vx: r.body.linearVelocity.x, vy: r.body.linearVelocity.y,
          angularVelocity: r.body.angularVelocity, contacts: r.contacts.size };
      });
      const totalMass = bodies.reduce((s, b) => s + b.mass, 0);
      const comX = bodies.reduce((s, b) => s + b.mass * b.com.x, 0) / totalMass;
      const xs = [...groundContacts.values()].flatMap(contact => contact.points.map(point => point.x));
      const groundSpan = xs.length ? [Math.min(...xs), Math.max(...xs)] : null;
      return { step: index, bodies, totalMass, comX, groundSpan,
        comInsideObservedGroundSpan: groundSpan ? comX >= groundSpan[0] && comX <= groundSpan[1] : null };
    };
    physics.postUpdate = function (dt) {
      if (!this.autoSimulation) return original.call(this, dt);
      stepContacts = []; index++;
      const world = window.qaGame().world;
      for (const r of world?.bodies || []) if (!observed.has(r.collider)) {
        observed.add(r.collider);
        r.collider.on(cc.Contact2DType.PRE_SOLVE, (self, other, contact) => {
          const manifold = contact.getWorldManifold();
          const value = { a: self.node.name, b: other.node.name, points: manifold.points.map(p => ({ x: p.x, y: p.y })),
            separations: [...manifold.separations], normal: { x: manifold.normal.x, y: manifold.normal.y } };
          if (other === world.platform) groundContacts.set(contact, value);
          if (value.separations.some(s => s < -3.5)) stepContacts.push(value);
        });
        r.collider.on(cc.Contact2DType.END_CONTACT, (_a, _b, contact) => groundContacts.delete(contact));
      }
      const result = original.call(this, dt);
      if (index % 6 === 0) frames.push(summary());
      if (stepContacts.length && deepContacts.length < 100) deepContacts.push({ ...summary(), contacts: stepContacts });
      return result;
    };
    try {
      const result = await window.choiceLab.runTrial(scenario, actions);
      return { scenario, actions, result, final: summary(), frames, deepContacts };
    } finally { physics.postUpdate = original; }
  }, { scenario, actions });
}
async function automaticBaseline() {
  return page.evaluate(async () => {
    const cc = window.qaCC, g = window.qaGame(), p = cc.PhysicsSystem2D.instance;
    const { TowerWorld } = await System.import('chunks:///_virtual/tower-world.ts');
    const data = await System.import('chunks:///_virtual/object-data.ts');
    g.world.root.active = false; g.world.dispose(); await new Promise(resolve => requestAnimationFrame(resolve));
    const world = g.world = new TowerWorld(cc.director.getScene());
    p.resetAccumulator(0); p.autoSimulation = true;
    const outcomes = [];
    try {
      for (const kind of ['cardboard_box', 'wood_plank', 'fridge']) {
        const spec = data.OBJECTS[kind], top = Math.max(0, ...world.bodies.map(r => world.bounds(r).top));
        const record = world.create(spec, 0, top - data.localBounds(spec, 0).bottom + 80); world.release(record);
        const started = performance.now(); let stableSince = null, stable = false;
        while (performance.now() - started < 8100) {
          await new Promise(resolve => requestAnimationFrame(resolve));
          if (world.isStable()) { stableSince ??= performance.now(); if (performance.now() - stableSince >= 650) { stable = true; break; } }
          else stableSince = null;
        }
        if (stable) record.placed = true;
        outcomes.push({ kind, stable, elapsedWallMs: performance.now() - started,
          state: world.bodies.map(r => ({ kind: r.spec.kind, x: r.node.position.x, y: r.node.position.y,
          angle: data.planarAngle(r.node.rotation), vx: r.body.linearVelocity.x, vy: r.body.linearVelocity.y,
          angularVelocity: r.body.angularVelocity, contacts: r.contacts.size })) });
        if (!stable) break;
      }
      return { mode: 'normal automatic Cocos postUpdate, wall-clock stable 650ms, timeout8100ms', outcomes };
    } finally { p.autoSimulation = false; world.root.active = false; world.dispose(); }
  });
}
async function main() {
  try {
    browser = await chromium.launch({ headless: true }); page = await browser.newPage({ viewport: { width: 375, height: 667 } });
    page.on('pageerror', e => report.errors.push(String(e)));
    await page.goto('http://127.0.0.1:8767/preparation/review/play-player.html');
    await page.waitForFunction(() => !!window.qaLoad, null, { timeout: 45000 });
    await page.addScriptTag({ url: 'http://127.0.0.1:8767/preparation/review/gameplay-lab.js' });
    report.engine = await page.evaluate(() => window.choiceLab.initialize());
    for (const kind of ['cardboard_box', 'fridge']) for (let x = -40; x <= 5; x += 5) {
      const scenario = { id: `toilet_${kind}_${x}`, supports: [{ kind: 'toilet', x: 0 }], sequence: [kind] };
      const row = await tracedTrial(scenario, [{ x, angle: 0 }]); report.toiletScan.push(row);
      process.stdout.write(`${scenario.id}: ${row.result.outcomes.at(-1)?.status || row.result.setup.status}\n`);
      if (kind === 'cardboard_box' && row.result.completed)
        report.continuations.push(await tracedTrial({ ...scenario, sequence: [kind, 'wood_plank'] }, [{ x, angle: 0 }, { x: 0, angle: 0 }]));
    }
    report.traces.push(await tracedTrial({ id: 'S01_center_cycle', supports: [], sequence: ['cardboard_box', 'wood_plank', 'fridge'] },
      [{ x: 0, angle: 0 }, { x: 0, angle: 0 }, { x: 0, angle: 0 }]));
    for (const x of [-90, 90]) report.traces.push(await tracedTrial({ id: `W195_fridge_${x}`,
      supports: [{ kind: 'cardboard_box', x: -55 }, { kind: 'cardboard_box', x: 55 }], sequence: ['wood_plank', 'fridge'] },
    [{ x: 0, angle: 0 }, { x, angle: 0 }]));
    save(); report.automaticBaseline = await automaticBaseline();
    // A fresh scene returns the helper to its own world after the independent auto-mode check.
    await page.evaluate(() => window.choiceLab.initialize());
    const mainReport = JSON.parse(fs.readFileSync(path.join(ROOT, 'preparation/review/evidence/gameplay-shapes/CHOICES.json')));
    for (const id of ['S04_dumbbell_cradle', 'H01_toilet_dumbbell_bridge']) {
      const entry = mainReport.results.find(r => r.scenario === id && r.policy === 'C' && !r.variant.geometry);
      const scenario = mainReport.scenarios.find(s => s.id === id);
      report.replay.push({ id, actions: entry.actions,
        result: await page.evaluate(({ scenario, entry }) => window.choiceLab.replay(scenario, entry.actions), { scenario, entry }) });
      await page.screenshot({ path: path.join(path.dirname(OUT), `replay-${id}.png`) });
      // The QA phase guard must keep a click on the scene from dereferencing current=null.
      await page.mouse.click(187, 320);
    }
    report.status = report.errors.length ? 'runtime_errors' : 'completed_diagnostics';
  } catch (error) { report.status = 'failed_or_incomplete'; report.failure = String(error.stack || error); process.exitCode = 1; }
  finally { save(); process.stdout.write(JSON.stringify({ status: report.status, errors: report.errors, failure: report.failure }) + '\n'); await browser?.close(); }
}
main();
