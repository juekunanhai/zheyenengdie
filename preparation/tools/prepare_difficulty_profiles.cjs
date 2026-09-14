/** Reproducible, local-only calibration data. No game-side profile system. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('/Applications/CocosCreator/3.8.8/CocosCreator.app/Contents/Resources/resources/3d/engine/node_modules/typescript');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'preparation/review/evidence/difficulty-r1');
const DESIGN = path.join(ROOT, 'preparation/design/difficulty-r1');
const clone = value => JSON.parse(JSON.stringify(value));
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const area = spec => spec.circle ? Math.PI * spec.width ** 2 / 4 : Math.abs(spec.outline.reduce((sum, a, i) => {
    const b = spec.outline[(i + 1) % spec.outline.length];
    return sum + a[0] * b[1] - b[0] * a[1];
}, 0)) / 2;
const mass = spec => area(spec) * spec.density / 1024;
const setMass = (spec, value) => { spec.density = Number((value * 1024 / area(spec)).toFixed(12)); };
const beforeText = fs.readFileSync(path.join(OUT, 'before/assets/batch1/object-data.ts.txt'), 'utf8');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(beforeText, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
} }).outputText, context);
const before = clone(context.exports.OBJECTS);
const baseGeometry = read(path.join(DESIGN, 'PHYSICS_GEOMETRY_R2.json')).assets;
const fridgeGeometry = read(path.join(DESIGN, 'fridge-r2/GEOMETRY_150.json')).assets;
const selectedGeometry = [...baseGeometry.filter(row => ['cardboard_box', 'wood_plank'].includes(row.slug)), ...fridgeGeometry];
const geometry = clone(before);
for (const row of selectedGeometry) {
    if (row.outline.length !== 8) throw Error(row.slug + ': expected the checked single-convex contour');
    const spec = geometry[row.slug];
    for (const key of ['width', 'height', 'spriteWidth', 'spriteHeight', 'spriteOffset', 'outline']) spec[key] = row[key];
    setMass(spec, mass(before[row.slug]));
}
const lighter = clone(geometry);
setMass(lighter.fridge, mass(before.cardboard_box) * 1.6);
const cushion = clone(lighter);
for (const [kind, spec] of Object.entries(cushion)) if (kind !== 'basketball') spec.contactImpactSpeed = 2.4;
const stabilized = clone(cushion);
stabilized.wood_plank.stabilizer = { maxForce: 420, maxTorque: 95, maxImpactSpeed: 1.8, maxAngleError: 12 };
stabilized.wood_plank.description = '搭上一块稳固板，上下都踏实一点。';
const damped = clone(stabilized);
for (const [kind, spec] of Object.entries(damped)) if (kind !== 'basketball') spec.contactAngularDamping = 6;
const shortBoard = clone(damped), ratio = 225 / 260;
shortBoard.wood_plank.width *= ratio;
shortBoard.wood_plank.spriteWidth *= ratio;
shortBoard.wood_plank.spriteOffset[0] *= ratio;
shortBoard.wood_plank.outline = shortBoard.wood_plank.outline.map(([x, y]) => [x * ratio, y]);
setMass(shortBoard.wood_plank, mass(stabilized.wood_plank));
const profiles = { before, 'geometry-only': geometry, 'geometry-lighter': lighter,
    'geometry-cushion': cushion, stabilized, 'contact-damped': damped, 'stabilized-225-diagnostic': shortBoard };
fs.mkdirSync(path.join(OUT, 'profiles'), { recursive: true });
for (const [name, value] of Object.entries(profiles)) {
    fs.writeFileSync(path.join(OUT, 'profiles', name + '.json'), JSON.stringify(value, null, 2) + '\n');
}
fs.writeFileSync(path.join(OUT, 'SELECTED_GEOMETRY.json'), JSON.stringify({
    status: 'checked_geometry_pending_final_runtime', assets: selectedGeometry,
    notes: 'Paper/plank retain original PNGs and checked <=1-unit simplification. Fridge is the new true eight-sided image uniformly mapped to 150 world units for two-foot dumbbell support. Flat bearing segments match the alpha128 boundary exactly; the lower chamfer has an openly recorded 1.183-unit simplification error.',
}, null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'CANDIDATE_PARAMETERS.json'), JSON.stringify({
    status: 'candidates_pending_runtime', generation: 'single_convex_r2',
    baselineMass: Object.fromEntries(Object.entries(before).map(([kind, spec]) => [kind, mass(spec)])),
    candidateMass: Object.fromEntries(Object.entries(damped).map(([kind, spec]) => [kind, mass(spec)])),
    control: 'Geometry-only preserves each original mass; lighter changes only fridge to 1.6 paper mass; cushioning, stabilizer and contact angular damping are separate stages. Compiled current connections use correctionFactor=0; original positive-feedback evidence remains archived.225 is a same-height/mass collision diagnostic, not approved stretched artwork.',
}, null, 2) + '\n');

// Adopt the candidate for engine verification; all comparison profiles stay outside assets.
const runtime = path.join(ROOT, 'assets/batch1/object-data.ts');
let source = fs.readFileSync(runtime, 'utf8');
const start = source.indexOf('export const OBJECTS:');
const end = source.indexOf('// An explicit calibration sequence;', start);
if (start < 0 || end < 0) throw Error('Object block markers changed');
const rows = [];
for (const [kind, spec] of Object.entries(damped)) {
    const lines = [`    ${kind}: { kind: '${kind}', width: ${spec.width}, height: ${spec.height}, circle: ${spec.circle},`,
        `        spriteWidth: ${spec.spriteWidth}, spriteHeight: ${spec.spriteHeight}${spec.spriteOffset ? ', spriteOffset: ' + JSON.stringify(spec.spriteOffset) : ''},`];
    if (spec.outline) {
        lines.push('        outline: [');
        const points = spec.outline.map(point => JSON.stringify(point));
        for (let i = 0; i < points.length; i += 3) lines.push('            ' + points.slice(i, i + 3).join(', ') + ',');
        lines.push('        ],');
    }
    lines.push(`        friction: ${spec.friction}, restitution: ${spec.restitution}, density: ${spec.density},`);
    for (const key of ['contactAngularDamping', 'contactImpactSpeed', 'adhesion', 'stabilizer', 'description']) {
        if (spec[key] !== undefined) lines.push(`        ${key}: ${JSON.stringify(spec[key])},`);
    }
    lines.push('    },'); rows.push(lines.join('\n'));
}
source = source.slice(0, start) + 'export const OBJECTS: Record<ObjectKind, ObjectSpec> = {\n' + rows.join('\n') + '\n};\n' + source.slice(end);
fs.writeFileSync(runtime, source);
process.stdout.write('Prepared seven comparison profiles and checked single-convex runtime candidate.\n');
