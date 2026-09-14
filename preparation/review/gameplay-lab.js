/* QA only. Real Cocos physics fixtures; this file never enters the game bundle. */
(function () {
  'use strict';
  const LIMITS = Object.freeze({ stableSeconds: .65, settleSeconds: 8, dropGap: 80,
    worldLeft: -750 / 3.5, worldRight: 750 / 3.5, floor: -100,
    deepPenetration: 4, persistentPenetrationSeconds: .15 });
  let cc, data, TowerWorld, physics, world, game, stepCount = 0, worstSeparation = 0, replayToken = 0;
  const area = points => Math.abs(points.reduce((s, a, i) => {
    const b = points[(i + 1) % points.length]; return s + a[0] * b[1] - b[0] * a[1];
  }, 0)) / 2;
  function hull(points) {
    const sorted = points.map(p => [...p]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const lower = [], upper = [];
    for (const p of sorted) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop(); lower.push(p); }
    for (const p of [...sorted].reverse()) { while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop(); upper.push(p); }
    return lower.slice(0, -1).concat(upper.slice(0, -1));
  }
  function specFor(kind, variant = {}) {
    const spec = JSON.parse(JSON.stringify(data.OBJECTS[kind]));
    if (!spec) throw Error('Object missing from built bundle: ' + kind);
    if (variant.geometry === 'convex-envelope' && ['toilet', 'dumbbell'].includes(kind)) {
      const oldArea = area(spec.outline); spec.outline = hull(spec.outline);
      spec.density *= oldArea / area(spec.outline);
    }
    if (kind === 'wood_plank' && variant.plankWidth) {
      const oldArea = area(spec.outline), ratio = variant.plankWidth / spec.width;
      spec.outline = spec.outline.map(([x, y]) => [x * ratio, y]); spec.width = variant.plankWidth;
      spec.density *= oldArea / area(spec.outline);
    }
    return spec;
  }
  function snapshot() {
    return world.bodies.map(r => ({ id: r.id, kind: r.spec.kind, x: r.node.position.x, y: r.node.position.y,
      angle: data.planarAngle(r.node.rotation), vx: r.body.linearVelocity.x, vy: r.body.linearVelocity.y,
      angularVelocity: r.body.angularVelocity, contacts: r.contacts.size, mass: r.body.getMass(),
      dynamic: r.body.type === cc.ERigidBody2DType.Dynamic, placed: r.placed, bounds: world.bounds(r) }));
  }
  function step() {
    // postUpdate is the public lifecycle method. Unlike step(), it also synchronizes nodes,
    // drains deferred contact work, and emits AFTER_PHYSICS for the actual glue implementation.
    // No await occurs while autoSimulation is true: the director cannot also step this world.
    const dt = physics.fixedTimeStep;
    worstSeparation = 0; physics.resetAccumulator(0); physics.autoSimulation = true;
    try { physics.postUpdate(dt + 1e-9); } finally { physics.autoSimulation = false; }
    // Director.tick clears these flags at the end of every real frame (3.8.8 director.ts:803).
    // Without this public frame-end operation, batched subframes repeatedly SetTransform
    // from physics-written Node poses, changing contacts/sleep compared with RAF playback.
    cc.Node.resetHasChangedFlags();
    stepCount++;
  }
  function create(spec, x, y, angle) {
    const r = world.create(spec, x, y); r.node.setRotationFromEuler(0, 0, angle);
    r.collider.on(cc.Contact2DType.PRE_SOLVE, (_self, _other, contact) => {
      const values = contact.getWorldManifold().separations;
      for (const separation of values) worstSeparation = Math.min(worstSeparation, separation);
    });
    world.release(r);
    // Replay yields to RAF before its first step. The ordinary director still clears Node
    // flags while autoSimulation is false, so publish the requested release pose first.
    // Otherwise a freshly requested 180/270 degree turn could remain 0 in Box2D.
    physics.physicsWorld.syncSceneToPhysics();
    return r;
  }
  function settlementObserver() {
    let stable = 0, penetration = 0, maxPenetration = 0, minY = Infinity;
    const dt = physics.fixedTimeStep, start = stepCount;
    return () => {
      const states = snapshot();
      if (states.some(s => ![s.x, s.y, s.angle, s.vx, s.vy, s.angularVelocity].every(Number.isFinite)))
        return { status: 'invalid', reason: 'non_finite_state', steps: stepCount - start };
      maxPenetration = Math.max(maxPenetration, -worstSeparation);
      penetration = worstSeparation < -LIMITS.deepPenetration ? penetration + dt : 0;
      if (penetration >= LIMITS.persistentPenetrationSeconds)
        return { status: 'invalid', reason: 'persistent_deep_penetration', maxPenetration, steps: stepCount - start };
      const lost = states.find(s => s.bounds.top < LIMITS.floor || s.bounds.right < LIMITS.worldLeft || s.bounds.left > LIMITS.worldRight);
      if (lost) return { status: 'fell', reason: 'whole_body_outside', lostId: lost.id, maxPenetration, steps: stepCount - start };
      minY = Math.min(minY, ...states.map(s => s.y));
      stable = world.isStable() ? stable + dt : 0;
      if (stable + 1e-8 >= LIMITS.stableSeconds)
        return { status: 'stable', stableSeconds: stable, maxPenetration, steps: stepCount - start };
      if (stepCount - start >= Math.ceil(LIMITS.settleSeconds / dt))
        return { status: 'timeout', reason: states.some(s => s.vy < -.3) ? 'continuing_fall' : 'not_continuously_stable',
          minY, maxPenetration, steps: stepCount - start };
      return null;
    };
  }
  function settle() {
    const observe = settlementObserver();
    for (;;) { step(); const result = observe(); if (result) return result; }
  }
  async function reset() {
    if (world && cc.isValid(world.root, true)) { world.root.active = false; world.dispose(); }
    // Flush Node.destroy through the director, with automatic physics disabled.
    await new Promise(resolve => requestAnimationFrame(resolve));
    world = game.world = new TowerWorld(cc.director.getScene()); game.current = null;
    worstSeparation = 0;
  }
  async function runTrial(scenario, actions, variant = {}) {
    await reset(); const start = stepCount, outcomes = [], initial = [];
    for (const support of scenario.supports) {
      const spec = specFor(support.kind, variant), angle = support.angle || 0;
      const y = support.y ?? -data.localBounds(spec, angle).bottom + .5;
      const r = create(spec, support.x, y, angle);
      initial.push({ kind: support.kind, x: support.x, y, angle, spec, id: r.id });
    }
    let setup = { status: 'stable', steps: 0 };
    if (scenario.supports.length) setup = settle();
    for (const r of world.bodies) if (setup.status === 'stable') r.placed = true;
    const supportState = snapshot();
    if (setup.status !== 'stable') return { scenario: scenario.id, variant, initial, setup, supportState,
      outcomes, completed: false, successfulDrops: 0, stableHeight: 0, finalState: snapshot(), steps: stepCount - start };
    let stableHeight = Math.max(0, ...world.bodies.map(r => world.bounds(r).top));
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i], kind = scenario.sequence[i], spec = specFor(kind, variant);
      const bounds = data.localBounds(spec, action.angle);
      if (action.x + bounds.left < LIMITS.worldLeft + 4 || action.x + bounds.right > LIMITS.worldRight - 4) {
        outcomes.push({ kind, action, status: 'invalid_action', reason: 'outside_release_range' }); break;
      }
      const top = Math.max(0, ...world.bodies.map(r => world.bounds(r).top));
      const y = top - bounds.bottom + LIMITS.dropGap;
      const r = create(spec, action.x, y, action.angle), outcome = settle();
      if (outcome.status === 'stable') {
        r.placed = true; stableHeight = Math.max(0, ...world.bodies.map(body => world.bounds(body).top));
      }
      outcomes.push({ kind, action, release: { x: action.x, y, angle: action.angle }, spec,
        ...outcome, heightAfter: outcome.status === 'stable' ? stableHeight : null, state: snapshot() });
      if (outcome.status !== 'stable') break;
    }
    return { scenario: scenario.id, variant, initial, setup, supportState, outcomes,
      completed: outcomes.length === actions.length && outcomes.every(o => o.status === 'stable'),
      successfulDrops: outcomes.filter(o => o.status === 'stable').length, stableHeight,
      finalState: snapshot(), steps: stepCount - start };
  }
  async function initialize() {
    cc = window.qaCC; await window.qaLoad('HUD');
    const deadline = Date.now() + 10000;
    while (window.qaGame()?.snapshot().phase !== 'planning') {
      if (Date.now() > deadline) throw Error('HUD never reached planning');
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    game = window.qaGame(); game.enabled = false; game.audio.pause(true);
    // TouchBinding remains registered when the component is disabled. QA owns the display,
    // so put the controller in a non-interactive phase before clearing its held object.
    game.phase = 'ended';
    physics = cc.PhysicsSystem2D.instance; physics.autoSimulation = false;
    game.world.root.active = false; game.world.dispose();
    world = null;
    ({ TowerWorld } = await System.import('chunks:///_virtual/tower-world.ts'));
    data = await System.import('chunks:///_virtual/object-data.ts');
    for (const kind of ['cardboard_box', 'wood_plank', 'fridge', 'basketball', 'toilet', 'dumbbell'])
      if (!data.OBJECTS[kind]) throw Error('Build is missing required object: ' + kind);
    let events = 0; const after = () => events++;
    cc.director.on(cc.Director.EVENT_AFTER_PHYSICS, after); step();
    cc.director.off(cc.Director.EVENT_AFTER_PHYSICS, after);
    if (events !== 1) throw Error('Expected exactly one physics event per manual step, got ' + events);
    return { engine: cc.VERSION, fixedTimeStep: physics.fixedTimeStep, gravity: physics.gravity,
      velocityIterations: physics.velocityIterations, positionIterations: physics.positionIterations,
      publicLifecycleStepping: 'autoSimulation false outside synchronous postUpdate; one AFTER_PHYSICS event per step; Node.resetHasChangedFlags at each frame end, matching Director.tick',
      limits: LIMITS, specs: data.OBJECTS };
  }
  async function replay(scenario, actions, variant = {}) {
    // Replays only the accepted six-object profiles. Hull/width ablations use diagnostic
    // colliders that deliberately do not match the production Sprite and must stay labelled data.
    if (variant.geometry || variant.plankWidth) throw Error('Visual replay is available for profile trials only.');
    const token = ++replayToken; await reset();
    game.display.dispose(); await new Promise(resolve => requestAnimationFrame(resolve));
    const { PlayView } = await System.import('chunks:///_virtual/play-view.ts');
    game.display = new PlayView(game.node, new Map(game.frames.map(frame => [frame.name, frame])));
    const notify = detail => {
      window.choiceLab.replayState = detail;
      window.dispatchEvent(new CustomEvent('choice-replay-state', { detail }));
    };
    const paint = () => game.display.update(physics.fixedTimeStep, world.bodies, null, 1);
    const animatedSettle = async () => {
      const observe = settlementObserver();
      for (;;) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        if (token !== replayToken) return { status: 'cancelled' };
        step(); paint(); const result = observe(); if (result) return result;
      }
    };
    notify({ phase: 'setup', scenario: scenario.id }); game.display.setHint('准备动态支撑');
    for (const support of scenario.supports) {
      const spec = specFor(support.kind), angle = support.angle || 0;
      create(spec, support.x, support.y ?? -data.localBounds(spec, angle).bottom + .5, angle);
    }
    paint(); const setup = scenario.supports.length ? await animatedSettle() : { status: 'stable' };
    if (token !== replayToken) return { setup: { status: 'cancelled' }, outcomes: [] };
    if (setup.status !== 'stable') { notify({ phase: 'ended', setup }); return { setup, outcomes: [] }; }
    for (const r of world.bodies) r.placed = true;
    const outcomes = [];
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i], kind = scenario.sequence[i], spec = specFor(kind);
      const top = Math.max(0, ...world.bodies.map(r => world.bounds(r).top));
      const r = create(spec, action.x, top - data.localBounds(spec, action.angle).bottom + LIMITS.dropGap, action.angle);
      game.display.setNext(scenario.sequence[i + 1] || kind);
      game.display.setHint(`第 ${i + 1} 件 · x ${action.x} · ${action.angle}°`);
      notify({ phase: 'falling', scenario: scenario.id, turn: i, kind, action, next: scenario.sequence[i + 1] || null });
      const outcome = await animatedSettle(); outcomes.push({ kind, action, ...outcome, state: snapshot() });
      if (token !== replayToken) return { setup, outcomes, completed: false, cancelled: true };
      if (outcome.status !== 'stable') break;
      r.placed = true; game.display.setHeight(world.confirmedTop()); game.display.follow(world.confirmedTop());
      notify({ phase: 'stable', scenario: scenario.id, turn: i, kind, action, height: world.confirmedTop() });
    }
    const result = { setup, outcomes, completed: outcomes.length === actions.length && outcomes.every(o => o.status === 'stable') };
    game.display.setHint(result.completed ? '回放完成 · 连续稳定 ≥ 0.65 秒' : `回放结束 · ${outcomes.at(-1)?.status || setup.status}`);
    notify({ phase: 'ended', scenario: scenario.id, ...result }); return result;
  }
  window.choiceLab = { initialize, runTrial, replay, stopReplay: () => { replayToken++; },
    snapshot, specFor, area, get steps() { return stepCount; } };
}());
