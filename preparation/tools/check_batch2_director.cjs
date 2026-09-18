/* Static Batch 2 director gate. No Cocos startup, physics, render or build. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('/Applications/CocosCreator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const root = path.resolve(__dirname, '../..');
const modules = new Map();
function load(name) {
    if (modules.has(name)) return modules.get(name);
    const module = { exports: {} }; modules.set(name, module.exports);
    const file = path.join(root, 'assets/batch1', `${name}.ts`);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2018, module: ts.ModuleKind.CommonJS,
    }}).outputText;
    const req = id => id === './object-data' ? load('object-data') : load(id.replace('./', ''));
    new vm.Script(`(function(require,module,exports){${code}\n})`, { filename: file })
        .runInThisContext()(req, module, module.exports);
    return module.exports;
}
const { TowerDirector, DIRECTOR_OBJECTS, SECOND_BATCH_UNLOCKS } = load('tower-director');
const { CALIBRATION_SEQUENCE } = load('object-data');
const second = ['television','bathtub','piano','tire','bowling_ball','oil_drum','spring_pad','cat_bed','giraffe','ufo','rocket','vending_machine'];
assert.equal(Object.keys(DIRECTOR_OBJECTS).length, 24);
assert.equal(Object.keys(SECOND_BATCH_UNLOCKS).length, 24);
const base = { elapsedSeconds: 180, risk: 'Safe', stableSeconds: 0, incidentCount: 0, placedCount: 0 };
const locked = new TowerDirector(91);
for (let i = 0; i < 140; i++) locked.handoff(base);
assert.equal([...locked.exportState().lastSeen].some(row => second.includes(row.kind)), false);
const early = new TowerDirector(77);
for (let i = 0; i < 600; i++) early.handoff({ ...base, allowEarlyDiscovery: true });
assert.ok(early.snapshot().discovered.some(kind => second.includes(kind)), 'early discovery never recorded');
const unlocked = new TowerDirector(91);
let discovered = new Set();
for (let i = 0; i < 280; i++) {
    const pair = unlocked.handoff({ ...base, placedCount: 70 });
    if (second.includes(pair.next)) discovered.add(pair.next);
}
assert.ok(discovered.size > 0, 'unlocked pool never emitted a second-batch object');
const openingReroll = new TowerDirector(7);
assert.equal(openingReroll.reroll(base), null);
const opening = new TowerDirector(7);
for (let i = 0; i < CALIBRATION_SEQUENCE.length - 2; i++) opening.handoff({ ...base, placedCount: 70 });
const before = opening.snapshot(), current = opening.current;
const rerolled = opening.reroll({ ...base, placedCount: 70 });
assert.ok(rerolled && opening.current === current);
assert.equal(opening.snapshot().draws, before.draws + 1);
const checkpoint = opening.exportState();
opening.reroll({ ...base, placedCount: 70 });
opening.restoreState(checkpoint);
assert.deepEqual(opening.exportState(), checkpoint);
console.log(JSON.stringify({ status: 'passed', lockedTurns: 140, unlockedTurns: 280,
    discovered: [...discovered], earlyDiscovered: early.snapshot().discovered, rerollKeepsCurrent: true,
    scope: 'Pure director/data state only; no Cocos startup or playtest' }, null, 2));
