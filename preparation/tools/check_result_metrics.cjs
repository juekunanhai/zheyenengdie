/** Production ResultPresentation + Result.scene under a small cc mock.
 * No Creator, browser, build, game rendering, or persisted results are started/changed. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../..');
const ts = require('/Applications/CocosCreator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const sourcePath = path.join(ROOT, 'assets/batch0/presentation/ResultPresentation.ts');
const scenePath = path.join(ROOT, 'assets/batch0/scenes/Result.scene');
const scene = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
let assertions = 0;
function check(pass, message) { assert.ok(pass, message); assertions++; }
class UITransform { setContentSize(width, height) { Object.assign(this, { width, height }); } }
class Component {}
class UIOpacity {}
class Color { constructor(...values) { this.values = values; } }
class Sprite {}
Sprite.SizeMode = { CUSTOM: 0 };
class SpriteFrame {}
class Label {}
Label.HorizontalAlign = { CENTER: 1 }; Label.VerticalAlign = { CENTER: 1 }; Label.Overflow = { SHRINK: 2 };
class Graphics {
    clear() {} rect() {} roundRect() {} fill() {} moveTo() {} lineTo() {} stroke() {}
}
class Node {
    constructor(name) { this.name = name; this.children = []; this.components = new Map(); this.handlers = new Map(); }
    addChild(node) { node.parent = this; this.children.push(node); }
    removeFromParent() { this.parent.children.splice(this.getSiblingIndex(), 1); this.parent = null; }
    destroy() { this.destroyed = true; }
    addComponent(Type) { const value = new Type(); value.node = this; this.components.set(Type, value); return value; }
    getComponent(Type) { return this.components.get(Type); }
    getChildByName(name) { return this.children.find(node => node.name === name); }
    getSiblingIndex() { return this.parent.children.indexOf(this); }
    setSiblingIndex(index) { const nodes = this.parent.children; nodes.splice(this.getSiblingIndex(), 1); nodes.splice(index, 0, this); }
    setPosition(x, y, z) { this.position = { x, y, z }; }
    setScale(x, y, z) { this.scale = { x, y, z }; }
    on(name, callback) { this.handlers.set(name, callback); }
}
Node.EventType = { TOUCH_START: 'start', TOUCH_END: 'end', TOUCH_CANCEL: 'cancel' };
const cc = { _decorator: { ccclass: () => Type => Type, property: () => () => {} },
    game: { on() {}, off() {} }, Game: { EVENT_HIDE: 'hide', EVENT_SHOW: 'show' },
    Color, Component, Graphics, Label, Node, Sprite, SpriteFrame, UITransform, UIOpacity };
function load(file, imports = {}) {
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2015, module: ts.ModuleKind.CommonJS, experimentalDecorators: true,
    } }).outputText;
    const exports = {};
    vm.runInNewContext(code, { exports, require: key => {
        check(key in imports, `known import ${key}`); return imports[key];
    } });
    return exports;
}
const data = load(path.join(ROOT, 'assets/batch1/object-data.ts'));
const { runResult } = data;
check(runResult.technicalScore === 0 && Object.keys(runResult.highlights).length === 4
    && ['narrow_escape', 'edge_balance', 'bridge', 'large_rescue'].every(key => runResult.highlights[key] === 0),
'results start with four actual-zero highlight counters');
const { ResultPresentation } = load(sourcePath, { cc, '../../batch1/object-data': data });
const frames = new Map();
for (const name of fs.readdirSync(path.join(ROOT, 'assets/batch0/art')).filter(name => name.endsWith('.png.meta'))) {
    const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/batch0/art', name), 'utf8'));
    for (const item of Object.values(meta.subMetas || {})) {
        if (item.importer !== 'sprite-frame') continue;
        frames.set(item.uuid, { name: item.displayName, originalSize: {
            width: item.userData.rawWidth, height: item.userData.rawHeight,
        } });
    }
}
function fixture() {
    const nodes = new Map();
    scene.forEach((row, i) => { if (row.__type__ === 'cc.Node') nodes.set(i, new Node(row._name)); });
    for (const [i, node] of nodes) {
        const row = scene[i]; node.layer = row._layer;
        node.setPosition(row._lpos.x, row._lpos.y, row._lpos.z); node.setScale(row._lscale.x, row._lscale.y, row._lscale.z);
        for (const { __id__ } of row._children) node.addChild(nodes.get(__id__));
        for (const { __id__ } of row._components) {
            const config = scene[__id__];
            const Type = { 'cc.UITransform': UITransform, 'cc.Sprite': Sprite, 'cc.UIOpacity': UIOpacity }[config.__type__];
            if (!Type) continue;
            const value = node.addComponent(Type);
            if (Type === UITransform) value.setContentSize(config._contentSize.width, config._contentSize.height);
            if (Type === Sprite) { value.spriteFrame = frames.get(config._spriteFrame.__uuid__); check(!!value.spriteFrame, 'scene frame resolves'); }
        }
    }
    const presentation = new ResultPresentation();
    presentation.node = [...nodes.values()].find(node => node.name === 'Canvas');
    presentation.heightFrames = scene.find(row => row.heightFrames).heightFrames.map(ref => frames.get(ref.__uuid__));
    presentation.onLoad();
    return presentation;
}
const cases = [
    { score: 0, count: 0, expectedScore: '0', expectedCount: '0次' },
    { score: 820, count: 3, expectedScore: '820', expectedCount: '3次' },
    { score: 123456789, count: 12345, expectedScore: '123456789', expectedCount: '12345次' },
    { score: NaN, count: Infinity, expectedScore: '0', expectedCount: '0次' },
    { score: -10, count: -1, expectedScore: '0', expectedCount: '0次' },
    { score: 120.9, count: 4.9, expectedScore: '120', expectedCount: '4次' },
];
const screenSizes = [[375, 667, 375, 667], [300, 650, 300, 606], [450, 600, 450, 556], [375, 812, 375, 734]];
for (const sample of cases) {
    Object.assign(runResult, { height: 42.7, technicalScore: sample.score });
    Object.assign(runResult.highlights, { narrow_escape: sample.count, edge_balance: 100, bridge: 200, large_rescue: 300 });
    const presentation = fixture();
    const card = presentation.card, board = card.getChildByName('ResultMetrics');
    check(!!board && board.children.length === 4, 'one metric board with precisely four labels');
    const label = name => board.getChildByName(name).getComponent(Label);
    check(label('TechnicalScoreValue').string === sample.expectedScore, 'actual technical score or safe zero');
    check(label('NarrowEscapesValue').string === sample.expectedCount, 'only actual narrow escapes, not other highlight counters');
    check(label('TechnicalScoreTitle').string === '本次技术分' && label('NarrowEscapesTitle').string === '惊险稳住', 'honest metric labels');
    check(board.getSiblingIndex() < card.getChildByName('result_btn_retry').getSiblingIndex(), 'metrics below retry control');
    check(board.getSiblingIndex() > card.getChildByName('ResultHero').getSiblingIndex(), 'metrics overlay the decorative tower');
    check(!board.handlers.size && board.children.every(node => !node.handlers.size), 'metric region adds no hit target');
    for (const node of board.children) {
        const value = node.getComponent(Label), box = node.getComponent(UITransform), bounds = board.getComponent(UITransform);
        check(value.overflow === Label.Overflow.SHRINK && !value.enableWrapText, 'long values remain inside one line');
        check(Math.abs(node.position.x) + box.width / 2 <= bounds.width / 2
            && Math.abs(node.position.y) + box.height / 2 <= bounds.height / 2, 'label bounds stay in board');
    }
    const metricText = board.children.map(node => node.getComponent(Label).string).join(' ');
    check(!/%|超过|玩家|分享|新纪录/.test(metricText), 'no unsupported claims or sample percentile');
    // End the entrance so tests use final card bounds; layout uses the production fit implementation.
    presentation.elapsed = 1;
    for (const [width, height, safeWidth, safeHeight] of screenSizes) {
        presentation.node.getComponent(UITransform).setContentSize(width, height);
        presentation.safe.getComponent(UITransform).setContentSize(safeWidth, safeHeight);
        presentation.update(0);
        const scale = presentation.content.scale.x, bounds = board.getComponent(UITransform);
        check((Math.abs(board.position.x) + bounds.width / 2) * scale <= safeWidth / 2
            && (Math.abs(board.position.y) + bounds.height / 2) * scale <= safeHeight / 2, 'metric bounds in safe area');
        const retry = card.getChildByName('result_btn_retry');
        check(board.position.y - bounds.height / 2 > retry.position.y + retry.getComponent(UITransform).height / 2,
        'data board stays above retry hit target');
    }
    const height = card.getChildByName('HeightTreatment');
    check(height.children.map(node => node.name).join(',') === 'HeightGlyph:4,HeightGlyph:2,HeightGlyph:.,HeightGlyph:7,HeightGlyph:m', 'height remains genuine');
}
console.log(JSON.stringify({ status: 'passed', assertions, cases: cases.length, screenSizes,
    productionSourceSha256: hash(sourcePath), resultSceneSha256: hash(scenePath),
    limits: 'Transpiled production logic and static geometry under cc mock only. No font rendering, Creator/browser build, GPU or device verification.',
}, null, 2));
