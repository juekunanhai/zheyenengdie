'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('/Applications/CocosCreator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const ROOT = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(ROOT, 'assets/batch1/item-system.ts'), 'utf8');
const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const compiled = { exports: {} };
new Function('require', 'module', 'exports', js)(require, compiled, compiled.exports);
const { ItemLedger } = compiled.exports;
const checks = [];
const test = (name, fn) => { fn(); checks.push(name); };

test('two slots and same-kind stack cap are enforced', () => {
    const items = new ItemLedger();
    assert.equal(items.add('undo'), true);
    assert.equal(items.add('undo'), true);
    assert.equal(items.add('undo'), false);
    assert.equal(items.add('shrink'), true);
    assert.equal(items.add('feather'), false);
    assert.deepEqual(items.snapshot().slots, [{ kind: 'undo', count: 2 }, { kind: 'shrink', count: 1 }]);
});

test('milestones open one deterministic three-choice offer and never repeat', () => {
    const items = new ItemLedger();
    assert.equal(items.maybeOpenOffer(9), false);
    assert.equal(items.maybeOpenOffer(10), true);
    assert.deepEqual(items.pendingOffer, ['strong_glue', 'undo', 'shrink']);
    assert.equal(items.maybeOpenOffer(10), false);
    assert.equal(items.chooseOffer('undo'), true);
    assert.equal(items.pendingOffer, null);
    assert.equal(items.maybeOpenOffer(10), false);
    assert.equal(items.maybeOpenOffer(20), true);
});

test('full inventory requires an explicit replacement choice', () => {
    const items = new ItemLedger();
    items.add('undo'); items.add('shrink');
    items.maybeOpenOffer(10);
    assert.equal(items.chooseOffer('strong_glue'), false);
    assert.equal(items.chooseOffer('strong_glue', 1), true);
    assert.deepEqual(items.snapshot().slots, [{ kind: 'undo', count: 1 }, { kind: 'strong_glue', count: 1 }]);
});

test('use decrements exactly once and arms finite effects', () => {
    const items = new ItemLedger();
    items.add('strong_glue'); items.add('shrink');
    const glue = items.use('strong_glue');
    assert.equal(glue?.kind, 'strong_glue');
    assert.equal(items.snapshot().active.glueSeconds, 10);
    const shrink = items.use('shrink');
    assert.equal(shrink?.effects.shrinkNext, true);
    const effects = items.takeNextEffects();
    assert.deepEqual(effects, { glueSeconds: 10, shrinkNext: true, featherNext: false });
    assert.deepEqual(items.snapshot().active, { glueSeconds: 0, shrinkNext: false, featherNext: false });
    items.tick(20);
    assert.equal(items.snapshot().consumed.strong_glue, 1);
});

test('checkpoint restore preserves post-checkpoint consumption instead of copying inventory', () => {
    const items = new ItemLedger();
    items.add('undo'); items.add('feather');
    const checkpoint = items.exportState();
    assert.ok(items.use('undo'));
    items.restoreCheckpoint(checkpoint);
    assert.deepEqual(items.snapshot().slots, [null, { kind: 'feather', count: 1 }]);
    assert.equal(items.snapshot().consumed.undo, 1);
});

test('checkpoint restore keeps active effects from the saved point while consuming later items', () => {
    const items = new ItemLedger();
    items.add('strong_glue');
    items.use('strong_glue');
    const checkpoint = items.exportState();
    items.add('shrink');
    items.use('shrink');
    items.restoreCheckpoint(checkpoint);
    assert.equal(items.snapshot().active.glueSeconds, 10);
    assert.equal(items.snapshot().active.shrinkNext, false);
    assert.equal(items.snapshot().consumed.shrink, 1);
});

test('revive usage is monotonic across checkpoint restore', () => {
    const items = new ItemLedger();
    const checkpoint = items.exportState();
    assert.equal(items.markReviveUsed(), true);
    assert.equal(items.markReviveUsed(), false);
    items.restoreCheckpoint(checkpoint);
    assert.equal(items.reviveAvailable, false);
});

test('invalid state is rejected without mutating the ledger', () => {
    const items = new ItemLedger();
    items.add('undo');
    const before = items.exportState();
    const invalid = { ...before, slots: [{ kind: 'undo', count: 3 }, null] };
    assert.throws(() => items.restoreState(invalid), /Invalid item checkpoint/);
    assert.deepEqual(items.exportState(), before);
});

console.log(JSON.stringify({ status: 'passed', groups: checks.length, checks,
    boundary: 'Pure ItemLedger source under Node transpilation; no Cocos UI, physics, build, ad or device execution.' }, null, 2));
