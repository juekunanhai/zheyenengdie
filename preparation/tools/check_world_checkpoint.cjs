/* Actual TowerWorld/ContactAssistance source with small Cocos doubles.
 * This verifies restoration data/order and orchestration, not a Box2D simulation. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('/Applications/CocosCreator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const root = path.resolve(__dirname, '../..');
const events = [], checks = [];
class Vec2 {
    constructor(x = 0, y = 0) { this.x = x; this.y = y; }
    clone() { return new Vec2(this.x, this.y); }
    length() { return Math.hypot(this.x, this.y); }
    add(p) { this.x += p.x; this.y += p.y; return this; }
    subtract(p) { this.x -= p.x; this.y -= p.y; return this; }
    multiplyScalar(v) { this.x *= v; this.y *= v; return this; }
    dot(p) { return this.x * p.x + this.y * p.y; }
    static distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    static dot(a, b) { return a.dot(b); }
}
class Node {
    static TransformBit = { ROTATION: 2 };
    constructor(name = '') { this.name = name; this.children = []; this.components = []; this.active = true;
        this.position = { x: 0, y: 0, z: 0 }; this.scale = { x: 1, y: 1, z: 1 }; this.rotation = { z: 0, w: 1 };
        this.nativeAngle = 0; this.hasChangedFlags = 0; }
    get worldPosition() { return this.position; }
    get worldScale() { return this.scale; }
    addChild(node) { this.children.push(node); node.parent = this; }
    addComponent(Type) { const c = new Type(); c.node = this; this.components.push(c); return c; }
    getComponent(Type) { return this.components.find(c => c instanceof Type); }
    setPosition(x, y, z) { this.position = { x, y, z }; }
    setScale(x, y, z) { this.scale = { x, y, z }; }
    setRotationFromEuler(x, y, angle) { const a = angle * Math.PI / 180;
        this.rotation = { z: Math.sin(a / 2), w: Math.cos(a / 2) }; this.nativeAngle = Math.atan2(Math.sin(a), Math.cos(a));
        this.hasChangedFlags |= 2; }
    destroy() { events.push(`destroy:${this.name}`); this.destroyed = true; }
}
class RigidBody2D {
    constructor() { this._enabled = true; this.type = 2; this.linearVelocity = new Vec2(); this.angularVelocity = 0;
        this.allowSleep = true; this.bullet = false; this.fixedRotation = false; this.gravityScale = 1;
        this.linearDamping = this.angularDamping = 0; this.group = 1;
        this.impl = { impl: { GetAngle: () => this.node.nativeAngle,
            GetPosition: () => new Vec2(this.node.position.x / 32, this.node.position.y / 32),
            SetTransform: (p, a) => { this.node.nativeAngle = a; } } }; }
    get enabled() { return this._enabled; }
    set enabled(v) { this._enabled = v; if (!v) events.push(`body-off:${this.node.name}`); }
    get enabledInHierarchy() { return this.enabled && this.node.active; }
    getWorldPoint(p) { const a = this.node.nativeAngle;
        return new Vec2(this.node.position.x + p.x * Math.cos(a) - p.y * Math.sin(a),
            this.node.position.y + p.x * Math.sin(a) + p.y * Math.cos(a)); }
    getLocalPoint(p) { const a = -this.node.nativeAngle, x = p.x - this.node.position.x, y = p.y - this.node.position.y;
        return new Vec2(x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)); }
    getWorldVector(p) { const a = this.node.nativeAngle; return new Vec2(p.x * Math.cos(a) - p.y * Math.sin(a), p.x * Math.sin(a) + p.y * Math.cos(a)); }
    getLocalVector(p) { const a = -this.node.nativeAngle; return new Vec2(p.x * Math.cos(a) - p.y * Math.sin(a), p.x * Math.sin(a) + p.y * Math.cos(a)); }
    getLinearVelocityFromWorldPoint() { return this.linearVelocity.clone(); }
    getMass() { return 1; }
    wakeUp() { this.awake = true; }
}
let colliderSerial = 0;
class Collider2D {
    constructor() { this.enabled = true; this.sensor = false; this.handlers = new Map(); this.friction = .2; this.density = 1; this.restitution = 0;
        this._uuid = `collider:${++colliderSerial}`; }
    get enabledInHierarchy() { return this.enabled && this.node.active && this.body.enabled; }
    get body() { return this.node.getComponent(RigidBody2D); }
    get uuid() { return this._uuid; }
    on(name, fn) { this.handlers.set(name, fn); }
    emit(name, other, contact) { this.handlers.get(name)?.(this, other, contact); }
    apply() {}
}
class BoxCollider2D extends Collider2D {}
class CircleCollider2D extends Collider2D {}
class PolygonCollider2D extends Collider2D {}
class RelativeJoint2D {
    constructor() { this._enabled = true; }
    get enabled() { return this._enabled; }
    set enabled(v) { this._enabled = v; if (!v) events.push(`joint-off:${this.node.name}`); }
    apply() {}
    destroy() { this.destroyed = true; events.push(`joint-destroy:${this.node.name}`); }
}
const cc = { Vec2, Node, RigidBody2D, Collider2D, BoxCollider2D, CircleCollider2D, PolygonCollider2D, RelativeJoint2D,
    Size: class { constructor(width, height) { this.width = width; this.height = height; } },
    ERigidBody2DType: { Static: 0, Kinematic: 1, Dynamic: 2 },
    Contact2DType: { BEGIN_CONTACT: 'begin', END_CONTACT: 'end', PRE_SOLVE: 'pre' },
    director: { on() {}, off() {} }, Director: { EVENT_BEFORE_PHYSICS: 'before', EVENT_AFTER_PHYSICS: 'after' },
    game: { deltaTime: 1 / 60 }, PhysicsSystem2D: { instance: { fixedTimeStep: 1 / 60, maxSubSteps: 4 } },
    isValid: obj => !!obj && !obj.destroyed };
const modules = new Map();
function load(name) {
    if (modules.has(name)) return modules.get(name);
    const module = { exports: {} }; modules.set(name, module.exports);
    const file = path.join(root, 'assets/batch1', name + '.ts');
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2018, module: ts.ModuleKind.CommonJS,
    } }).outputText;
    new vm.Script(`(function(require,module,exports){${code}\n})`, { filename: file })
        .runInThisContext()(id => id === 'cc' ? cc : load(id.replace('./', '')), module, module.exports);
    return module.exports;
}
const { TowerWorld } = load('tower-world');
const { OBJECTS } = load('object-data');
const clone = data => structuredClone(data);
function test(name, fn) { fn(); checks.push(name); }
function contact(record, lower, y = 0) {
    return { colliderA: record.collider, colliderB: lower, getWorldManifold: () => ({
        normal: new Vec2(0, -1), points: [new Vec2(-20, y), new Vec2(20, y)], separations: [0, 0] }) };
}
function bear(world, record, lower, y = 0) {
    const c = contact(record, lower, y);
    record.collider.emit('begin', lower, c); record.collider.emit('pre', lower, c); return c;
}
function sample() {
    const world = new TowerWorld(new Node('scene'));
    const box = world.create(OBJECTS.cardboard_box, 0, 50); world.release(box); box.placed = true;
    bear(world, box, world.platform); world.contactAssistance.afterPhysics();
    world.configureSafety({ left: -300, right: 300, bottom: 300, top: 900 }, 250);
    const ball = world.create(OBJECTS.basketball, 0, 150); world.release(ball); ball.placed = true;
    const plank = world.create(OBJECTS.wood_plank, 0, 210); world.release(plank); plank.placed = true;
    const held = world.create(OBJECTS.fridge, 0, 850);
    const state = world.exportState();
    const motor = { offset: { x: 0, y: 100 }, angle: 0, maxForce: 100, maxTorque: 20, correctionFactor: 0, collideConnected: true };
    state.assistance = { adhesion: [{ ballId: ball.id, otherId: box.id, side: -1, ...motor }],
        stabilizers: [{ plankId: plank.id, supportId: ball.id, ...motor, offset: { x: 0, y: 60 } }],
        cushionedIds: [box.id, ball.id], brokenPairs: [`${plank.id}:${box.id}`] };
    state.bodies.forEach(body => { if (body.collider.enabled) { body.contactSeconds = .8; body.supported = true; } });
    return { world, state, box, ball, plank, held };
}
function complete(world, makeContacts = true) {
    cc.game.deltaTime = 1 / 60; world.beforePhysics(); world.afterPhysics();
    assert.equal(world.restoring, true, 'equal fixed timestep does not prove a substep ran');
    world.beforePhysics();
    if (makeContacts) {
        bear(world, world.bodies[0], world.platform);
        if (world.bodies[1]?.collider.enabled) bear(world, world.bodies[1], world.bodies[0].collider, 100);
        if (world.bodies[2]?.collider.enabled) bear(world, world.bodies[2], world.bodies[1].collider, 180);
    }
    world.afterPhysics(); assert.equal(world.restoring, false);
}
test('Deep copy includes whole offscreen tower, held body, current specs and native full turns', () => {
    const { world, state } = sample();
    assert.equal(state.bodies.length, 4); assert.equal(state.bodies[0].position.y, 50);
    assert.equal(state.bodies[3].collider.enabled, false);
    world.bodies[0].node.nativeAngle = Math.PI * 4.5;
    const exported = world.exportState(); assert.ok(Math.abs(exported.bodies[0].angle - 810) < 1e-9);
    exported.bodies[0].spec.outline[0][0] = 999; exported.safety.boundary.bottom = -999;
    assert.notEqual(world.bodies[0].spec.outline[0][0], 999); assert.equal(world.safety.boundary.bottom, 300);
});
test('Same-frame held move/rotate uses node pose while released bodies keep native pose', () => {
    const { world, held } = sample();
    held.node.setPosition(73, 912, 0); held.node.setRotationFromEuler(0, 0, -90);
    held.body.getWorldPoint = () => new Vec2(0, 850); held.node.nativeAngle = 0;
    const state = world.exportState(), saved = state.bodies.find(body => body.id === held.id);
    assert.deepEqual(saved.position, { x: 73, y: 912 }); assert.ok(Math.abs(saved.angle + 90) < 1e-9);
    world.restoreState(state); assert.equal(world.bodies[3].node.position.x, 73);
    assert.ok(Math.abs(world.bodies[3].body.impl.impl.GetAngle() + Math.PI / 2) < 1e-9);
});
test('Validation rejects malformed geometry / IDs / joints before mutating the existing world', () => {
    const { world, state, box } = sample();
    for (const corrupt of [s => s.bodies[0].position.x = NaN, s => s.bodies[1].id = s.bodies[0].id,
        s => s.bodies[0].spec.outline[0][1] = Infinity, s => s.bodies[0].scale.x = 0,
        s => s.assistance.adhesion[0].otherId = 999, s => s.assistance.stabilizers[0].supportId = 4,
        s => s.assistance.brokenPairs.push('3:2'), s => s.nextId = 1,
        s => s.bodies[0].collider.enabled = false]) {
        const bad = clone(state); corrupt(bad); events.length = 0;
        assert.throws(() => world.restoreState(bad), /checkpoint/);
        assert.equal(world.bodies[0], box); assert.equal(box.node.active, true); assert.equal(events.length, 0);
    }
});
test('Restore zeros velocities, retains ID holes/next ID and current native physical configuration', () => {
    const { world, state } = sample();
    const first = state.bodies[0]; first.angle = 720; first.body.bullet = false; first.body.gravityScale = .6;
    first.body.linearDamping = .2; first.body.angularDamping = 7; first.assistDamping = 1;
    first.collider.friction = .8; first.collider.restitution = .12;
    state.bodies[3].id = 9; state.nextId = 12;
    world.restoreState(state);
    assert.deepEqual(world.bodies.map(body => body.id), [1, 2, 3, 9]);
    const restored = world.bodies[0];
    assert.equal(restored.body.impl.impl.GetAngle(), 4 * Math.PI); assert.equal(restored.node.hasChangedFlags & 2, 0);
    assert.equal(restored.body.gravityScale, .6); assert.equal(restored.body.bullet, false);
    assert.equal(restored.collider.friction, .8); assert.equal(restored.body.angularDamping, 7);
    assert.ok(world.bodies.every(body => body.body.linearVelocity.length() === 0 && body.body.angularVelocity === 0));
    assert.equal(world.bodies[3].body.type, 1); assert.equal(world.bodies[3].collider.enabled, false);
    assert.throws(() => world.exportState(), /restoring/); complete(world);
    assert.equal(world.create(OBJECTS.cardboard_box, 0, 900).id, 12);
});
test('Real motor topology, offsets, force budget, cushions and broken pairs survive replacement', () => {
    const { world, state } = sample(); world.restoreState(state); complete(world);
    assert.deepEqual(world.exportState().assistance, state.assistance);
    const oldBodies = [...world.bodies]; events.length = 0;
    world.restoreState(state);
    const firstBodyOff = events.findIndex(event => event.startsWith('body-off:'));
    const lastJointOff = events.reduce((index, event, i) => event.startsWith('joint-off:') ? i : index, -1);
    assert.ok(firstBodyOff > lastJointOff && lastJointOff >= 0);
    assert.ok(oldBodies.every(body => body.lost && !body.node.active && !body.body.enabled && body.node.destroyed));
    complete(world); assert.deepEqual(world.exportState().assistance, state.assistance);
});
test('No-step AFTER cannot unlock; restored offscreen contacts are allowed before saved safety returns', () => {
    const { world, state } = sample(); world.restoreState(state);
    cc.game.deltaTime = 0; world.beforePhysics(); world.afterPhysics(); assert.equal(world.restoring, true);
    assert.equal(world.safety, null); assert.equal(world.canSaveCheckpoint(), false);
    world.configureSafety({ left: 999, right: 1000, bottom: 999, top: 1000 }, 999);
    complete(world);
    assert.equal(world.safety.boundary.bottom, 300); assert.equal(world.safety.referenceTop, 250);
    assert.ok(world.bodies.slice(0, 3).every(body => body.supported));
    assert.equal(world.canSaveCheckpoint(), true);
});
test('Bootstrap never fabricates a support edge when native contacts were not observed', () => {
    const { world, state } = sample(); state.assistance.adhesion = []; state.assistance.stabilizers = [];
    world.restoreState(state); complete(world, false);
    assert.ok(world.bodies.every(body => !body.supported)); assert.equal(world.isStable(), false);
    assert.equal(world.canSaveCheckpoint(), false);
});
test('Stale teardown callbacks cannot erase pooled contacts or emit impacts into new bodies', () => {
    let impacts = 0;
    const { world, state, box } = sample(); world.impact = () => impacts++;
    world.restoreState(state);
    const restored = world.bodies[0], c = contact(restored, world.platform);
    restored.collider.emit('begin', world.platform, c); restored.collider.emit('pre', world.platform, c);
    assert.equal(impacts, 0); assert.equal(world.supportContacts.size, 1);
    box.collider.emit('end', world.platform, c); assert.equal(world.supportContacts.size, 1);
    box.collider.emit('pre', world.platform, c); assert.equal(c.disabled, true);
    assert.equal(world.supportContacts.size, 1);
});
test('Saved qualification keeps supported offscreen bases but rejects sides and unfinished lower objects', () => {
    const { world, state } = sample(); world.restoreState(state); complete(world);
    assert.equal(world.canSaveCheckpoint(), true);
    world.bodies[0].node.position.x = 1000; assert.equal(world.canSaveCheckpoint(), false);
    world.bodies[0].node.position.x = 0; world.bodies[0].placed = false;
    assert.equal(world.canSaveCheckpoint(), false);
});
test('Lost bodies are omitted without reusing consumed IDs and restore input data is detached', () => {
    const { world, state } = sample(); world.restoreState(state); complete(world);
    world.bodies[3].lost = true; world.bodies[3].node.active = false;
    const checkpoint = world.exportState(); assert.equal(checkpoint.bodies.length, 3); assert.equal(checkpoint.nextId, 5);
    world.restoreState(checkpoint); checkpoint.bodies[0].spec.width = 999; checkpoint.safety.referenceTop = 999;
    complete(world); assert.notEqual(world.bodies[0].spec.width, 999); assert.equal(world.assistanceTop(), 250);
});
function returningSample() {
    const world = new TowerWorld(new Node('scene'));
    const base = world.create(OBJECTS.cardboard_box, 0, 50);
    const upper = world.create(OBJECTS.cardboard_box, 0, 150);
    const different = world.create(OBJECTS.cardboard_box, 120, 50);
    for (const record of world.bodies) { world.release(record); record.placed = true; }
    bear(world, base, world.platform); bear(world, different, world.platform);
    const c = bear(world, upper, base.collider, 100);
    world.contactAssistance.afterPhysics();
    world.configureSafety({ left: -300, right: 300, bottom: 300, top: 900 }, 250);
    upper.body.linearVelocity.y = -.08;
    upper.collider.emit('end', base.collider, c);
    world.safetyTime = .035;
    return { world, state: world.exportState(), upper, base, different };
}
function restoreReturning(world, state) {
    world.restoreState(state);
    cc.game.deltaTime = 1 / 60; world.beforePhysics(); world.afterPhysics();
    world.beforePhysics();
    bear(world, world.bodies[0], world.platform); bear(world, world.bodies[2], world.platform);
    world.afterPhysics();
    assert.equal(world.restoring, false);
    assert.equal(world.bodies[1].supported, false, 'a return permission does not create a contact edge');
    return { base: world.bodies[0], upper: world.bodies[1], different: world.bodies[2] };
}
test('A live support-return permission preserves only its remaining TTL and remaps the collider ID', () => {
    const { world, state, base: oldBase } = returningSample();
    assert.deepEqual(state.supportReturns, [{ upperId: 2, lowerId: 1, remainingSeconds: .12 - .035 }]);
    const oldUuid = oldBase.collider.uuid;
    const { base, upper, different } = restoreReturning(world, state);
    assert.notEqual(base.collider.uuid, oldUuid);
    assert.ok(world.supportReturns.has(`2:${base.collider.uuid}`));
    assert.equal(world.mayReturnToSupport(upper, base.collider, contact(upper, base.collider)), true);
    assert.equal(world.mayReturnToSupport(upper, different.collider, contact(upper, different.collider)), false);
    assert.equal(world.rejectContact(upper, different.collider, contact(upper, different.collider)), true);
    assert.equal(world.supportContacts.size, 2);
    const real = contact(upper, base.collider);
    assert.equal(world.rejectContact(upper, base.collider, real), false);
    upper.collider.emit('begin', base.collider, real); upper.collider.emit('pre', base.collider, real);
    world.afterPhysics(); assert.equal(upper.supported, true);
});
test('Return permissions still require genuine low-speed upward contact and expire at the original deadline', () => {
    const { world, state } = returningSample(); const { base, upper } = restoreReturning(world, state);
    upper.body.linearVelocity.y = -.5;
    assert.equal(world.mayReturnToSupport(upper, base.collider, contact(upper, base.collider)), false);
    upper.body.linearVelocity.y = -.08; upper.body.angularVelocity = .6;
    assert.equal(world.mayReturnToSupport(upper, base.collider, contact(upper, base.collider)), false);
    upper.body.angularVelocity = 0;
    const side = contact(upper, base.collider); side.getWorldManifold = () => ({ normal: new Vec2(1, 0), points: [new Vec2()] });
    assert.equal(world.mayReturnToSupport(upper, base.collider, side), false);
    base.supported = false;
    assert.equal(world.mayReturnToSupport(upper, base.collider, contact(upper, base.collider)), false);
    base.supported = true;
    world.safetyTime = state.supportReturns[0].remainingSeconds;
    assert.equal(world.mayReturnToSupport(upper, base.collider, contact(upper, base.collider)), true);
    world.safetyTime += .00001;
    assert.equal(world.mayReturnToSupport(upper, base.collider, contact(upper, base.collider)), false);
    assert.deepEqual(world.exportState().supportReturns, []);
});
test('Rebuild isolates detached offscreen pieces from new supports while permitting the saved real return', () => {
    const { world, state } = returningSample(); world.restoreState(state);
    const [base, upper, different] = world.bodies;
    assert.equal(base.supported, false); assert.equal(upper.supported, false);
    assert.equal(world.rejectContact(upper, different.collider, contact(upper, different.collider)), true);
    const real = contact(upper, base.collider);
    assert.equal(world.rejectContact(upper, base.collider, real), false);
    assert.equal(world.supportContacts.size, 0);
    assert.equal(world.rejectContact(base, world.platform, contact(base, world.platform)), false);
    upper.placed = false;
    assert.equal(world.rejectContact(upper, base.collider, contact(upper, base.collider)), true);
    upper.placed = true; base.node.position.x = 1000;
    assert.equal(world.rejectContact(base, world.platform, contact(base, world.platform)), true);
});
test('Invalid or dead support-return records cannot mutate the world or become new support', () => {
    const { world, state, upper } = returningSample();
    for (const corrupt of [s => s.supportReturns[0].remainingSeconds = NaN,
        s => s.supportReturns[0].remainingSeconds = .121, s => s.supportReturns[0].remainingSeconds = -.01,
        s => s.supportReturns[0].lowerId = 999, s => s.supportReturns[0].upperId = 999,
        s => s.supportReturns.push({ ...s.supportReturns[0] })]) {
        const bad = clone(state); corrupt(bad); events.length = 0;
        assert.throws(() => world.restoreState(bad), /checkpoint/); assert.equal(world.bodies[1], upper);
        assert.equal(events.length, 0);
    }
    world.bodies[0].lost = true; world.bodies[0].collider.enabled = false;
    assert.deepEqual(world.exportState().supportReturns, []);
});
console.log(JSON.stringify({ scope: 'Source-level Cocos doubles; no build/start/native Box2D verification', checks: checks.length, passed: checks }, null, 2));
