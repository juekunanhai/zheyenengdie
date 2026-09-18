/* Actual PlayView/LandingFeedback/PlayFeedback against small engine doubles.
 * Checks checkpoint orchestration only; no project startup, browser, build or physics acceptance. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('/Applications/CocosCreator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const root = path.resolve(__dirname, '../..');

class Node {
    constructor(name) {
        this.name = name; this.children = []; this.components = new Map(); this.active = true; this.layer = 1;
        this.position = { x: 0, y: 0, z: 0 }; this.scale = { x: 1, y: 1, z: 1 };
        this.rotation = { x: 0, y: 0, z: 0, w: 1 };
    }
    get worldPosition() { return this.position; }
    addChild(node) { this.children.push(node); node.parent = this; }
    getChildByName(name) { return this.children.find(node => node.name === name); }
    addComponent(Type) { const value = new Type(); value.node = this; this.components.set(Type, value); return value; }
    getComponent(Type) { return this.components.get(Type); }
    setSiblingIndex(index) { const siblings = this.parent.children; siblings.splice(siblings.indexOf(this), 1); siblings.splice(index, 0, this); }
    setPosition(x, y, z = 0) { this.position = typeof x === 'object' ? { ...x } : { x, y, z }; }
    setScale(x, y, z = 1) { this.scale = { x, y, z }; }
    setRotation(value) { this.rotation = { ...value }; }
    // Keep node in its parent's list to expose Cocos's deferred-destruction flash hazard.
    destroy() { this.destroyed = true; this.children.forEach(node => node.destroy()); }
}
class UITransform {
    constructor() { this.contentSize = { width: 0, height: 0 }; }
    get width() { return this.contentSize.width; }
    get height() { return this.contentSize.height; }
    setContentSize(width, height) { this.contentSize = { width, height }; }
    convertToNodeSpaceAR(point) { return { x: point.x - this.node.position.x, y: point.y - this.node.position.y, z: 0 }; }
}
class UIOpacity { constructor() { this.opacity = 255; } }
class Sprite { static SizeMode = { CUSTOM: 0 }; }
class Label { constructor() { this.string = ''; } }
class Widget { updateAlignment() { this.alignments = (this.alignments || 0) + 1; } }
class Color { constructor(r, g, b, a = 255) { Object.assign(this, { r, g, b, a }); } }
Color.WHITE = new Color(255, 255, 255);
class Graphics { clear() {} rect() {} fill() {} }
class Vec3 { constructor(x = 0, y = 0, z = 0) { Object.assign(this, { x, y, z }); } }
class HeightBackdrop { setViewHeight(...args) { this.args = args; } }
const cc = { Node, UITransform, UIOpacity, Sprite, Label, Widget, Color, Graphics, Vec3, Vec2: Vec3,
    Layers: { Enum: { UI_2D: 1 } }, isValid: node => !!node && !node.destroyed };
const modules = new Map();
function load(name) {
    if (modules.has(name)) return modules.get(name);
    const module = { exports: {} }; modules.set(name, module.exports);
    const file = path.join(root, 'assets/batch1', name + '.ts');
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2018, module: ts.ModuleKind.CommonJS,
    } }).outputText;
    const requireLocal = id => id === 'cc' ? cc : id === '../batch0/presentation/HeightBackdrop'
        ? { HeightBackdrop } : load(id.replace('./', ''));
    new vm.Script(`(function(require,module,exports){${code}\n})`, { filename: file })
        .runInThisContext()(requireLocal, module, module.exports);
    return module.exports;
}
const { PlayView } = load('play-view');
const { OBJECTS } = load('object-data');
function child(parent, name, Type) {
    const node = new Node(name); parent.addChild(node); node.addComponent(UITransform);
    if (Type) node.addComponent(Type);
    return node;
}
function fixture(width = 750, height = 1334) {
    const canvas = new Node('Canvas'); canvas.addComponent(UITransform).setContentSize(width, height);
    const backdrop = canvas.addComponent(HeightBackdrop);
    const safe = child(canvas, 'SafeArea'); safe.getComponent(UITransform).setContentSize(width, height);
    child(safe, 'World_1x'); child(safe, 'hud_rotate_90', Sprite); child(safe, 'hud_pause', Sprite);
    child(safe, 'Text:0.0', Label); child(safe, 'next_basketball', Sprite).addComponent(Widget);
    for (let index = 0; index < 3; index++) child(safe, 'hud_star_full', Sprite);
    const names = ['platform_city_base', 'claw_cable_straight', 'claw_open_narrow', 'claw_open_mid',
        'claw_open_wide', 'fx_landing_ring_r1', 'fx_landing_dust_r1', 'hud_star_full', 'hud_star_empty',
        ...Object.keys(OBJECTS).flatMap(kind => [`object_${kind}`, `next_${kind}`])];
    const frames = new Map(names.map(name => [name, { name, originalSize: { width: 100, height: 100 } }]));
    return { view: new PlayView(canvas, frames), canvas, safe, backdrop, frames };
}
function body(id = 1, kind = 'cardboard_box', x = 0, y = 50) {
    const node = new Node(`Body:${id}`); node.setPosition(x, y, 0);
    return { id, node, spec: OBJECTS[kind], lost: false, placed: false, contacts: new Set(),
        collider: { enabledInHierarchy: true } };
}
function contact(record) {
    const support = { enabledInHierarchy: true }; record.contacts.add(support);
    return { record, support, speed: 5, point: { x: 0, y: 0 }, normal: { x: 0, y: 1 },
        localPoint: { x: 0, y: -50 }, localNormal: { x: 0, y: 1 } };
}
function ordinary(view) { view.beginPlacement(550, 170); view.update(.1, [], null, 1); return view.exportState(); }
const checks = [];
function check(name, fn) { fn(); checks.push(name); }

check('plain_three_field_state_is_detached', () => {
    const { view } = fixture(); const state = ordinary(view);
    assert.deepEqual(Object.keys(state).sort(), ['cameraY', 'heldTop', 'targetCameraY']);
    state.cameraY = 99999; state.targetCameraY = 99999; state.heldTop = 99999;
    assert.notEqual(view.exportState().cameraY, state.cameraY);
    const saved = view.exportState(); view.restoreState(saved); saved.heldTop = -100;
    assert.notEqual(view.exportState().heldTop, saved.heldTop);
});

check('normal_camera_and_boundary_restore_without_replaying_zoom', () => {
    const { view, backdrop, safe } = fixture();
    const state = ordinary(view), bounds = view.logicalBounds();
    const hud = safe.getChildByName('hud_rotate_90'); hud.setScale(.8, .8, 1);
    view.beginIncident(.6); view.update(.35, [], null, 1); view.setHint('旧事故提示');
    assert.equal(view.root.scale.x, .6);
    view.restoreState(state);
    assert.deepEqual(view.exportState(), state); assert.deepEqual(view.logicalBounds(), bounds);
    assert.equal(view.cameraRecovered(), true); assert.equal(view.root.scale.x, 1);
    assert.equal(view.snapshot().zoomTarget, 1); assert.equal(view.snapshot().incidentCamera, false);
    assert.deepEqual(hud.scale, { x: .8, y: .8, z: 1 }); assert.equal(safe.scale.x, 1);
    assert.equal(backdrop.args[0], state.cameraY / 100); assert.equal(backdrop.args[3], 1);
    assert.equal(safe.getChildByName('PlanningHint').getComponent(Label).string, '');
    assert.equal(view.root.getChildByName('claw_open_narrow').active, false);
    view.update(.2, [], null, 1); assert.equal(view.root.scale.x, 1);
});

check('invalid_camera_state_is_rejected_before_any_mutation', () => {
    const { view } = fixture(); const state = ordinary(view), record = body();
    view.update(0, [record], record, 0); view.land(contact(record));
    view.setRisk('Critical'); view.showHighlight('edge_balance');
    const before = JSON.stringify(view.snapshot()), node = view.views.get(1);
    const invalid = [null, {}, { ...state, cameraY: NaN }, { ...state, heldTop: Infinity },
        { ...state, targetCameraY: -1 }, { ...state, cameraY: -1 },
        { ...state, cameraY: state.targetCameraY + 1 }, { ...state, targetCameraY: '20' }];
    for (const value of invalid) {
        assert.throws(() => view.restoreState(value), RangeError);
        assert.equal(JSON.stringify(view.snapshot()), before); assert.equal(view.views.get(1), node);
        assert.equal(node.active, true); assert.equal(node.destroyed, undefined);
    }
});

check('reused_body_id_gets_fresh_sprite_and_no_old_view_flash', () => {
    const { view } = fixture(); const state = ordinary(view), old = body(9, 'cardboard_box');
    view.update(0, [old], old, 0); const previousNode = view.views.get(9);
    view.restoreState(state);
    assert.equal(previousNode.destroyed, true); assert.equal(previousNode.active, false);
    assert.equal(view.views.size, 0);
    const replacement = body(9, 'fridge'); view.update(0, [replacement], replacement, 0);
    const fresh = view.views.get(9); assert.notEqual(fresh, previousNode);
    assert.equal(fresh.getComponent(Sprite).spriteFrame.name, 'object_fridge');
    assert.equal(fresh.active, true);
});

check('landing_danger_and_highlight_are_cleared_and_can_restart', () => {
    const { view } = fixture(); const state = ordinary(view), old = body(4);
    view.land(contact(old)); view.setRisk('Critical'); view.showHighlight('bridge', { x: 0, y: 0 });
    view.update(.04, [old], old, 0);
    const particles = view.root.children.filter(node => node.name.startsWith('fx_landing_'));
    assert.ok(particles.length > 0); assert.equal(view.snapshot().landing.reactions.length, 1);
    assert.ok(view.snapshot().feedback.edgeOpacity > 0);
    view.restoreState(state);
    for (const particle of particles) { assert.equal(particle.active, false); assert.equal(particle.destroyed, true); }
    const snap = view.snapshot();
    assert.equal(snap.landing.reactions.length, 0); assert.equal(snap.landing.bursts, 0);
    assert.equal(snap.feedback.edgeOpacity, 0); assert.equal(snap.feedback.highlight, null);
    assert.equal(view.root.getChildByName('ContactHighlight').active, false);
    const replacement = body(4); view.land(contact(replacement));
    // A landing immediately after restore has a fresh burst budget, not the old .09 s cooldown.
    assert.equal(view.snapshot().landing.bursts, 1); assert.equal(view.snapshot().landing.reactions.length, 1);
    view.setRisk('Safe'); assert.equal(view.showHighlight('narrow_escape'), true);
});

check('resize_rebuilds_live_metrics_without_mutating_saved_held_pose', () => {
    const { view, safe } = fixture(); const state = ordinary(view), oldBounds = view.logicalBounds();
    safe.getComponent(UITransform).setContentSize(600, 900); view.restoreState(state);
    const snap = view.snapshot(), bounds = view.logicalBounds();
    assert.equal(snap.width, 600); assert.equal(snap.height, 900); assert.deepEqual(view.exportState(), state);
    assert.notEqual(bounds.left, oldBounds.left); assert.notEqual(bounds.bottom, oldBounds.bottom);
    assert.deepEqual(view.input.getComponent(UITransform).contentSize, { width: 600, height: 900 });
    assert.equal(view.root.scale.x, 1);
    const expected = fixture(600, 900).view; expected.restoreState(state);
    assert.deepEqual(bounds, expected.logicalBounds());
    // The controller may now refit the held body. View restore itself preserves its attachment.
    assert.deepEqual(view.beginPlacement(550, 170), expected.beginPlacement(550, 170));
});

check('initial_zero_camera_round_trip_is_valid', () => {
    const { view } = fixture(); const state = view.exportState();
    assert.deepEqual(state, { cameraY: 0, targetCameraY: 0, heldTop: 0 });
    view.restoreState(state); assert.deepEqual(view.exportState(), state);
});

console.log(JSON.stringify({ status: 'passed', scope: 'actual source against engine doubles; no startup or build',
    groups: checks.length, checks }, null, 2));
