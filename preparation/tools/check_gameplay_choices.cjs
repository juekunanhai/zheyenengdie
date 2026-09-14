/** Bounded real-engine experiments. Outcomes are evidence, not assertions that lateral play wins. */
const { chromium } = require('/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'preparation/review/evidence/gameplay-shapes/CHOICES.json');
const HOST = process.env.CHOICES_HOST || 'http://127.0.0.1:8767';
const MAX_TRIALS = 4000, MAX_PHYSICS_STEPS = 2200000, MAX_WALL_MS = 12 * 60 * 1000;
const ACTIONS = {
  A: [{ x: 0, angle: 0 }],
  B: [0, 90, 180, 270].map(angle => ({ x: 0, angle })),
  C: [0, -30, 30].flatMap(x => [0, 90, 180, 270].map(angle => ({ x, angle }))),
};
// Declared before running. The holdouts are not used to tune geometry or material parameters.
const SCENARIOS = [
  { id: 'S01_center_cycle', partition: 'development', supports: [], sequence: ['cardboard_box', 'wood_plank', 'fridge'] },
  { id: 'S02_narrow_column', partition: 'development', supports: [{ kind: 'fridge', x: 0 }], sequence: ['wood_plank', 'cardboard_box'] },
  { id: 'S03_toilet_step', partition: 'development', supports: [{ kind: 'toilet', x: 0 }], sequence: ['cardboard_box', 'wood_plank'] },
  { id: 'S04_dumbbell_cradle', partition: 'development', supports: [{ kind: 'dumbbell', x: 0 }], sequence: ['basketball', 'cardboard_box'] },
  { id: 'S05_offcentre_repair', partition: 'development', supports: [{ kind: 'cardboard_box', x: -32 }], sequence: ['wood_plank', 'fridge'] },
  { id: 'S06_two_dynamic_piers', partition: 'development', supports: [{ kind: 'cardboard_box', x: -55 }, { kind: 'cardboard_box', x: 55 }], sequence: ['wood_plank', 'toilet'] },
  { id: 'H01_toilet_dumbbell_bridge', partition: 'holdout', supports: [{ kind: 'toilet', x: 0 }], sequence: ['dumbbell', 'wood_plank'] },
  { id: 'H02_dumbbell_fridge_ball', partition: 'holdout', supports: [{ kind: 'dumbbell', x: 0 }], sequence: ['fridge', 'basketball'] },
];
const report = { status: 'running', createdAt: new Date().toISOString(), method: {
  actionSets: ACTIONS, primaryMetric: 'stable placements followed by confirmed height',
  search: 'B and C enumerate their available actions with exactly one visible NEXT. No unknown later object is passed to a search trial.',
  actionSampling: 'C uses x=0,+/-30 before the first run: the toilet cistern support is approximately x=-35..-12, so a +/-60-only grid would omit its visible ledge. +/-60 and +/-90 remain in the independent width probes.',
  circularActionDeduplication: 'Circle colliders use angle 0 only: rotating a perfect circle is not a new physical choice. Initial exhaustive rotation report is retained as CHOICES-initial-rotation-sampling.json.',
  tieBreak: 'More continuously stable drops, then greater stable height with 0.1 world-unit tolerance, then action enumeration order (center preferred on ties).',
  repeatability: 'Approximate physical repeatability, not bit-identical determinism. Separate position <=0.02 world units and angle <=0.02 degrees checks. Initial over-strict mixed-unit sanity report retained as CHOICES-method-check-initial.json.',
  frameEndCorrection: 'Initial results were invalidated because manual batched postUpdate lacked Director.tick frame-end Node.resetHasChangedFlags. The corrected helper performs that public operation after every step; fast/RAF parity is checked separately. No object/material parameter was changed.',
  caveat: 'C has more available actions and more simulation evaluations; this measures physical opportunity under a bounded search, not human skill or an optimal policy.',
  geometryAblation: 'Only toilet/dumbbell are replaced by their convex hulls. Same external bounds and total mass; COM and inertia may change as a consequence of geometry.',
  widthAblation: 'Only plank collision x coordinates change; height, friction, restitution and total mass fixed. Inertia is allowed to change. Stretched old art is not approved as production art.',
  fixtureBoundary: 'A common local test volume uses the 750-design-unit / 1.75 view width, bottom -100 world units, and 80 world units of clearance above the current tower. Camera motion, 4-second planning and incident/star rules are excluded from this geometry experiment.',
  limits: { MAX_TRIALS, MAX_PHYSICS_STEPS, MAX_WALL_MS },
  decisions: 'No game configuration, collider parameter or test case is tuned in response to this run.' },
  scenarios: SCENARIOS, checks: [], results: [], forecastTrials: [], widthProbes: [], selectedActionRepeats: [], errors: [], trials: 0, physicsSteps: 0 };
report.sourceHashes = Object.fromEntries([
  'assets/batch1/object-data.ts', 'assets/batch1/tower-world.ts', 'assets/batch1/play-view.ts',
  'preparation/design/gameplay-shapes/GEOMETRY.json', 'preparation/design/gameplay-shapes/assets/object_toilet.png',
  'preparation/design/gameplay-shapes/assets/object_dumbbell.png', 'preparation/tools/check_gameplay_choices.cjs',
  'preparation/review/gameplay-lab.js',
].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex')]));
let browser, page; const started = Date.now();
function checkpoint() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  report.elapsedMs = Date.now() - started; fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
}
function budget() {
  if (report.trials >= MAX_TRIALS || report.physicsSteps >= MAX_PHYSICS_STEPS || Date.now() - started > MAX_WALL_MS)
    throw Error('Experiment budget exhausted; partial outcomes are retained, not marked passed.');
}
async function trial(scenario, actions, variant) {
  budget(); report.trials++;
  const result = await page.evaluate(({ scenario, actions, variant }) => window.choiceLab.runTrial(scenario, actions, variant), { scenario, actions, variant });
  report.physicsSteps += result.steps;
  // Retain unsuccessful forecast branches too; selecting a best NEXT must not erase evidence
  // that the same current placement has many unsafe continuations.
  report.forecastTrials.push({ trial: report.trials, scenario: scenario.id, variant, actions,
    setup: result.setup, completed: result.completed, successfulDrops: result.successfulDrops,
    stableHeight: result.stableHeight, steps: result.steps,
    outcomes: result.outcomes.map(o => ({ kind: o.kind, action: o.action, status: o.status,
      reason: o.reason, lostId: o.lostId, maxPenetration: o.maxPenetration, heightAfter: o.heightAfter })) });
  if (report.trials % 50 === 0) process.stdout.write(`trials=${report.trials} physicsSteps=${report.physicsSteps} elapsed=${Math.round((Date.now() - started) / 1000)}s\n`);
  return result;
}
function better(a, b) {
  if (!b) return true;
  if (a.successfulDrops !== b.successfulDrops) return a.successfulDrops > b.successfulDrops;
  if (a.completed !== b.completed) return a.completed;
  return a.stableHeight > b.stableHeight + .1;
}
async function policy(scenario, policyName, variant) {
  const actions = [], decisions = []; let result;
  const available = kind => ACTIONS[policyName].filter(action => !report.engine.specs[kind]?.circle || action.angle === 0);
  for (let turn = 0; turn < scenario.sequence.length; turn++) {
    const candidates = available(scenario.sequence[turn]);
    if (policyName === 'A') actions.push(candidates[0]);
    else {
      let chosen, best; const rows = [];
      const visibleSequence = scenario.sequence.slice(0, turn + 2);
      // Search receives only committed history + current + NEXT, never later sequence entries.
      const visible = { ...scenario, sequence: visibleSequence };
      for (const action of candidates) {
        const prefix = [...actions, action]; let localBest;
        for (const next of turn + 1 < scenario.sequence.length ? available(scenario.sequence[turn + 1]) : [null]) {
          const sample = await trial(visible, next ? [...prefix, next] : prefix, variant);
          if (better(sample, localBest)) localBest = sample;
        }
        rows.push({ action, successfulDrops: localBest.successfulDrops, completed: localBest.completed,
          stableHeight: localBest.stableHeight, forecastActions: localBest.outcomes.map(o => o.action),
          status: localBest.outcomes.at(-1)?.status ?? localBest.setup.status });
        if (better(localBest, best)) { best = localBest; chosen = action; }
      }
      actions.push(chosen); decisions.push({ turn, current: scenario.sequence[turn], next: scenario.sequence[turn + 1] ?? null, chosen, candidates: rows });
    }
    result = await trial({ ...scenario, sequence: scenario.sequence.slice(0, actions.length) }, actions, variant);
    if (!result.completed) break;
  }
  const entry = { scenario: scenario.id, partition: scenario.partition, policy: policyName, variant,
    actions, decisions, ...result, completedSequence: result.completed && actions.length === scenario.sequence.length };
  report.results.push(entry); checkpoint();
  process.stdout.write(`${scenario.id} ${variant.geometry || 'profile'} ${policyName}: ${result.successfulDrops}/${scenario.sequence.length} stable, height=${result.stableHeight.toFixed(2)}, end=${result.outcomes.at(-1)?.status || result.setup.status}\n`);
}
async function widthProbes() {
  const supports = [{ kind: 'cardboard_box', x: -55 }, { kind: 'cardboard_box', x: 55 }];
  for (const width of [195, 225, 260]) for (const next of ['fridge', 'toilet']) for (const x of [-90, -60, -30, 0, 30, 60, 90]) {
    const scenario = { id: `W${width}_${next}_${x}`, supports, sequence: ['wood_plank', next] };
    const result = await trial(scenario, [{ x: 0, angle: 0 }, { x, angle: 0 }], { plankWidth: width });
    report.widthProbes.push({ width, next, x, ...result });
  }
  const masses = report.widthProbes.map(r => r.outcomes[0]?.state.find(s => s.kind === 'wood_plank')?.mass).filter(Number.isFinite);
  const relativeSpread = (Math.max(...masses) - Math.min(...masses)) / Math.max(...masses);
  report.checks.push({ name: 'width_probe_mass_control', passed: masses.length === 42 && relativeSpread < .0001, relativeSpread, sampleCount: masses.length });
  if (!(masses.length === 42 && relativeSpread < .0001)) throw Error('Width trial total mass was not controlled.');
  checkpoint();
}
async function repeatSelectedActions() {
  for (const entry of report.results) {
    const scenario = SCENARIOS.find(s => s.id === entry.scenario), repetitions = [];
    for (let repeat = 0; repeat < 3; repeat++) {
      const result = await trial(scenario, entry.actions, entry.variant);
      repetitions.push(result);
    }
    report.selectedActionRepeats.push({ scenario: entry.scenario, policy: entry.policy, variant: entry.variant,
      actions: entry.actions, originalSuccessfulDrops: entry.successfulDrops,
      stableDropRange: [Math.min(...repetitions.map(r => r.successfulDrops)), Math.max(...repetitions.map(r => r.successfulDrops))],
      stableHeightRange: [Math.min(...repetitions.map(r => r.stableHeight)), Math.max(...repetitions.map(r => r.stableHeight))],
      matchedOriginalCount: repetitions.filter(r => r.successfulDrops === entry.successfulDrops).length,
      repetitions });
  }
  checkpoint();
}
function summarize() {
  report.summary = {};
  for (const policyName of Object.keys(ACTIONS)) {
    const rows = report.results.filter(r => r.policy === policyName && !r.variant.geometry);
    report.summary[policyName] = { scenarios: rows.length, completedSequences: rows.filter(r => r.completedSequence).length,
      stableDrops: rows.reduce((sum, r) => sum + r.successfulDrops, 0),
      meanConfirmedHeight: rows.reduce((sum, r) => sum + r.stableHeight, 0) / rows.length,
      offcenterActions: rows.flatMap(r => r.actions).filter(a => a.x !== 0).length };
  }
  report.summary.interpretation = 'Compare each matched scenario as well as totals. Search-policy gains do not establish human fun, long-run balance, camera usability or production visual fidelity.';
}
async function main() {
  try {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 375, height: 667 } });
    page.on('pageerror', error => report.errors.push(String(error)));
    await page.goto(HOST + '/preparation/review/play-player.html');
    await page.waitForFunction(() => !!window.qaLoad, null, { timeout: 45000 });
    await page.addScriptTag({ url: HOST + '/preparation/review/gameplay-lab.js' });
    report.engine = await page.evaluate(() => window.choiceLab.initialize());
    // Repeated center fixture checks numerical determinism and real gravity/support before searching.
    const sanityCase = { id: 'sanity', supports: [], sequence: ['cardboard_box'] };
    const sanityA = await trial(sanityCase, ACTIONS.A, {}), sanityB = await trial(sanityCase, ACTIONS.A, {});
    const positionDelta = Math.max(...sanityA.finalState.flatMap((a, i) => ['x', 'y'].map(k => Math.abs(a[k] - sanityB.finalState[i][k]))));
    const angleDelta = Math.max(...sanityA.finalState.map((a, i) => Math.abs(a.angle - sanityB.finalState[i].angle)));
    const sanityPassed = sanityA.completed && sanityB.completed && positionDelta <= .02 && angleDelta <= .02;
    report.checks.push({ name: 'real_gravity_stable_support_and_approximate_repeatability', passed: sanityPassed,
      positionDelta, angleDelta, first: sanityA, second: sanityB });
    if (!sanityPassed) throw Error('Manual-step sanity failed.');
    for (const scenario of SCENARIOS) for (const policyName of Object.keys(ACTIONS)) await policy(scenario, policyName, {});
    for (const scenario of SCENARIOS.filter(s => ['S03_toilet_step', 'S04_dumbbell_cradle', 'H01_toilet_dumbbell_bridge', 'H02_dumbbell_fridge_ball'].includes(s.id)))
      for (const policyName of Object.keys(ACTIONS)) await policy(scenario, policyName, { geometry: 'convex-envelope' });
    await widthProbes(); await repeatSelectedActions(); summarize();
    if (report.errors.length) throw Error('Browser emitted runtime errors.');
    report.status = 'completed_experiments_not_human_playtest';
  } catch (error) { report.status = 'failed_or_incomplete'; report.failure = String(error.stack || error); process.exitCode = 1; }
  finally { checkpoint(); process.stdout.write(JSON.stringify({ status: report.status, summary: report.summary,
    trials: report.trials, physicsSteps: report.physicsSteps, failure: report.failure, errors: report.errors }) + '\n'); await browser?.close(); }
}
main();
