/* Controller-level Batch 2 orchestration against the existing engine doubles. */
const assert = require('node:assert/strict');
const { controller } = require('./check_director_integration.cjs');
const checks = [];
function check(name, run) { run(); checks.push(name); }

check('one-shot held effects are consumed at release and passed to the world', () => {
    const g = controller(); const applied = [];
    g.phase = 'planning'; g.world.applyHeldEffects = (_record, effects) => applied.push(effects);
    assert.equal(g.items.add('shrink'), true); assert.equal(g.items.add('feather'), true);
    assert.equal(g.useItem('shrink'), true); assert.equal(g.useItem('feather'), true);
    assert.equal(g.items.snapshot().active.shrinkNext, true);
    g.release();
    assert.deepEqual(applied, [{ glueSeconds: 0, shrinkNext: true, featherNext: true }]);
    assert.equal(g.items.snapshot().active.shrinkNext, false);
    assert.equal(g.items.snapshot().consumed.shrink, 1);
    assert.equal(g.items.snapshot().consumed.feather, 1);
});

check('ten confirmed placements expose a non-repeating three-choice offer', () => {
    const g = controller(); g.world.stable = true; g.current.collider.enabled = true; g.placedCount = 9;
    g.confirmStable(.7);
    assert.equal(g.placedCount, 10);
    const offer = g.items.pendingOffer;
    assert.equal(offer.length, 3); assert.equal(new Set(offer).size, 3);
    assert.equal(g.chooseItem(offer[0]), true);
    assert.equal(g.items.pendingOffer, null);
});

check('undo consumption survives restore without recreating its inventory slot', () => {
    const g = controller(); g.phase = 'planning'; g.release();
    assert.equal(g.items.add('undo'), true);
    assert.equal(g.useItem('undo'), true);
    const consumed = g.items.snapshot().consumed.undo;
    assert.equal(consumed, 1);
    assert.equal(g.items.snapshot().slots.some(stack => stack?.kind === 'undo'), false);
    assert.equal(g.restoreRequest, 'undo');
});

console.log(JSON.stringify({ status: 'passed', checks,
    scope: 'Controller/world/view doubles; no Cocos startup, build, render or device execution.' }, null, 2));
