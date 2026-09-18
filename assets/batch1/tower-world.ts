import { BoxCollider2D, CircleCollider2D, Collider2D, Contact2DType, director, Director, ERigidBody2DType, game,
    IPhysics2DContact, isValid, Node, PhysicsSystem2D, PolygonCollider2D, RigidBody2D, Size, Vec2 } from 'cc';
import { localBounds, OBJECTS, ObjectSpec, planarAngle, PLATFORM_WIDTH } from './object-data';
import { ContactAssistance, ContactAssistanceState } from './contact-assistance';
import type { TowerRiskSignals } from './tower-director';
import type { HighlightPlacement } from './run-highlights';

// Small contact gaps do not turn an old supported tower into a loss. These are 1B tuning candidates.
const DETACH_GRACE_SECONDS = .12;
const FALL_SPEED = -.75;
const FALL_SECONDS = .12;
// World units, not pixels or Box2D metres: preserve the newest 1.5 display metres.
const ASSIST_NEAR_DISTANCE = 150;
const ASSIST_HALF_DISTANCE = 250;
const MAX_ASSIST_WEIGHT = .85;
const ASSIST_ANGULAR_RATE = 48;
const ASSIST_RESPONSE_RATE = 8;

interface SafetyBoundary { top: number; bottom: number; left: number; right: number }
interface SafetyState { boundary: SafetyBoundary; referenceTop: number; assist: boolean }
export interface TowerBodyState {
    id: number;
    spec: ObjectSpec;
    position: { x: number; y: number };
    /** Full native angle, preserving complete turns used by existing motor offsets. */
    angle: number;
    scale: { x: number; y: number; z: number };
    placed: boolean;
    /** Eligibility during first-step recontact only; never restored as a support edge. */
    supported: boolean;
    contactSeconds: number | null;
    lossBoundary?: { left: number; right: number; bottom: number };
    assistDamping: number;
    body: { type: ERigidBody2DType; allowSleep: boolean; bullet: boolean; fixedRotation: boolean;
        gravityScale: number; linearDamping: number; angularDamping: number; group: number };
    collider: { enabled: boolean; density: number; friction: number; restitution: number; sensor: boolean };
}
export interface TowerWorldState {
    nextId: number;
    bodies: TowerBodyState[];
    safety: SafetyState | null;
    assistance: ContactAssistanceState;
    /** A short-lived permission to recontact the original bearing, never a support edge. */
    supportReturns: { upperId: number; lowerId: number; remainingSeconds: number }[];
}

function cloneSpec(spec: ObjectSpec): ObjectSpec {
    return { ...spec, ...(spec.spriteOffset ? { spriteOffset: [...spec.spriteOffset] as [number, number] } : {}),
        ...(spec.outline ? { outline: spec.outline.map(point => [point[0], point[1]] as [number, number]) } : {}),
        ...(spec.adhesion ? { adhesion: { ...spec.adhesion } } : {}),
        ...(spec.stabilizer ? { stabilizer: { ...spec.stabilizer } } : {}) };
}

/** Copied at contact time; the native manifold itself is pooled by Cocos. */
export interface LandingContact {
    record: TowerBody;
    support: Collider2D;
    point: Vec2;
    localPoint: Vec2;
    localNormal: Vec2;
    normal: Vec2;
    speed: number;
}

export interface TowerBody {
    id: number;
    spec: ObjectSpec;
    node: Node;
    body: RigidBody2D;
    collider: Collider2D;
    contacts: Set<Collider2D>;
    placed: boolean;
    lost: boolean;
    supported: boolean;
    detachedSeconds: number;
    fallingSeconds: number;
    /** Extra angular damping from deep-tower assistance, not the material damping. */
    assistDamping: number;
    /** Null until the first actual contact, including a brief touch between game updates. */
    contactSeconds: number | null;
    /** A later camera move must not move a released body's loss boundary. */
    lossBoundary?: { left: number; right: number; bottom: number };
}

/** Physics nodes never inherit a screen, Canvas or presentation scale. */
export class TowerWorld {
    readonly root: Node;
    readonly bodies: TowerBody[] = [];
    readonly platform: BoxCollider2D;
    private nextId = 1;
    private readonly contactAssistance = new ContactAssistance(this.bodies);
    private safety: SafetyState | null = null;
    private restoration: { safety: SafetyState | null; elapsed: number; supportedIds: Set<number> } | null = null;
    // Keep copied support directions, never query a pooled Cocos contact after END_CONTACT.
    private readonly supportContacts = new Map<IPhysics2DContact, { upper: TowerBody; lower: Collider2D;
        points: { x: number; y: number }[] }>();
    // A brief contact gap may reconnect only to its original, still grounded bearing surface.
    private readonly supportReturns = new Map<string, { upper: TowerBody; lower: Collider2D; expires: number }>();
    private readonly losing = new Set<number>();
    private safetyTime = 0;
    private safetyDt = 0;
    private filteredContacts = 0;

    constructor(scene: Node, private readonly impact?: (record: TowerBody, pair: string, speed: number, landing?: LandingContact) => void,
        private readonly onLoss?: (record: TowerBody) => void) {
        this.root = new Node('TowerPhysics');
        scene.addChild(this.root);
        const node = new Node('GroundSupport');
        this.root.addChild(node);
        node.setPosition(0, -12, 0);
        node.addComponent(RigidBody2D).type = ERigidBody2DType.Static;
        this.platform = node.addComponent(BoxCollider2D);
        this.platform.size = new Size(PLATFORM_WIDTH, 24);
        this.platform.friction = .65;
        this.platform.restitution = 0;
        this.platform.apply();
        director.on(Director.EVENT_BEFORE_PHYSICS, this.beforePhysics, this);
        director.on(Director.EVENT_AFTER_PHYSICS, this.afterPhysics, this);
    }

    create(spec: ObjectSpec, x: number, y: number, saved?: TowerBodyState): TowerBody {
        const node = new Node(`Body:${this.nextId}:${spec.kind}`);
        // Configure off-scene: Creator reads the plain `bullet` field only when creating the
        // native body. Adding an active node first silently left native IsBullet() false.
        node.setPosition(x, y, 0);
        if (saved) {
            node.setScale(saved.scale.x, saved.scale.y, saved.scale.z);
            node.setRotationFromEuler(0, 0, saved.angle);
        }
        const body = node.addComponent(RigidBody2D);
        body.type = ERigidBody2DType.Kinematic;
        body.allowSleep = true;
        body.enabledContactListener = true;
        body.linearDamping = .05;
        // Modest rotational drag damps impact chatter; unsupported bodies still tip and fall.
        const freeAngularDamping = spec.circle ? .1 : 1.5;
        body.angularDamping = freeAngularDamping;
        body.bullet = true;
        if (saved) {
            body.type = saved.body.type; body.allowSleep = saved.body.allowSleep; body.bullet = saved.body.bullet;
            body.fixedRotation = saved.body.fixedRotation; body.gravityScale = saved.body.gravityScale;
            body.linearDamping = saved.body.linearDamping; body.angularDamping = saved.body.angularDamping;
            body.group = saved.body.group;
        }
        const collider = spec.circle ? node.addComponent(CircleCollider2D) :
            spec.outline ? node.addComponent(PolygonCollider2D) : node.addComponent(BoxCollider2D);
        collider.enabled = false;
        if (collider instanceof CircleCollider2D) collider.radius = spec.width / 2;
        else if (collider instanceof PolygonCollider2D) collider.points = spec.outline!.map(([x, y]) => new Vec2(x, y));
        else collider.size = new Size(spec.width, spec.height);
        collider.density = spec.density;
        collider.friction = spec.friction;
        collider.restitution = spec.restitution;
        if (saved) {
            collider.density = saved.collider.density; collider.friction = saved.collider.friction;
            collider.restitution = saved.collider.restitution; collider.sensor = saved.collider.sensor;
        }
        const record: TowerBody = { id: this.nextId++, spec, node, body, collider, contacts: new Set(),
            placed: false, lost: false, supported: false, detachedSeconds: 0, fallingSeconds: 0,
            assistDamping: 0, contactSeconds: null };
        if (saved) {
            record.placed = saved.placed; record.contactSeconds = saved.contactSeconds;
            record.assistDamping = saved.assistDamping;
            if (saved.lossBoundary) record.lossBoundary = { ...saved.lossBoundary };
        }
        // A concave PolygonCollider is partitioned into native fixtures. Keep public contacts
        // at object level, but retain each live native contact until its matching END event.
        const fixtureContacts = new Map<Collider2D, Set<IPhysics2DContact>>();
        collider.on(Contact2DType.BEGIN_CONTACT, (_self: Collider2D, other: Collider2D, contact: IPhysics2DContact) => {
            if (this.rejectContact(record, other, contact)) return;
            if (record.contactSeconds === null) record.contactSeconds = 0;
            let active = fixtureContacts.get(other);
            if (active?.has(contact)) return;
            if (!active) { active = new Set(); fixtureContacts.set(other, active); }
            active.add(contact);
            if (active.size > 1) { this.emitImpact(record, other, contact, false); return; }
            record.contacts.add(other);
            if (spec.contactAngularDamping !== undefined) body.angularDamping = spec.contactAngularDamping + record.assistDamping;
            this.emitImpact(record, other, contact, true);
        });
        collider.on(Contact2DType.END_CONTACT, (_self: Collider2D, other: Collider2D, contact: IPhysics2DContact) => {
            if (record.lost) return;
            const previous = this.supportContacts.get(contact);
            if (this.safety && previous?.upper.placed && previous.upper.supported && !previous.upper.lost) {
                this.supportReturns.set(`${previous.upper.id}:${previous.lower.uuid}`,
                    { ...previous, expires: this.safetyTime + DETACH_GRACE_SECONDS });
            }
            this.supportContacts.delete(contact);
            if (this.safety) this.refreshSupport();
            const active = fixtureContacts.get(other);
            if (!active?.delete(contact)) return;
            this.contactAssistance.endContact(record, contact);
            if (active.size > 0) return;
            fixtureContacts.delete(other);
            record.contacts.delete(other);
            if (record.contacts.size === 0) body.angularDamping = freeAngularDamping + record.assistDamping;
        });
        collider.on(Contact2DType.PRE_SOLVE,
            (_self: Collider2D, other: Collider2D, contact: IPhysics2DContact) => {
                if (this.rejectContact(record, other, contact)) return;
                this.recordSupport(record, other, contact);
                this.contactAssistance.preSolve(record, other, contact, spec);
        });
        this.bodies.push(record);
        this.root.addChild(node);
        if (saved) {
            // A quaternion drops whole turns. Restore the original native angle as well,
            // so a motor's saved angular offset does not acquire a full-turn error.
            const native = body.impl!.impl as { GetPosition(): Vec2; SetTransform(position: Vec2, angle: number): void };
            native.SetTransform(native.GetPosition(), saved.angle * Math.PI / 180);
            // The coming syncSceneToPhysics would otherwise reapply the quaternion's
            // wrapped angle in this same frame. Position/scale dirtiness stays intact.
            node.hasChangedFlags &= ~Node.TransformBit.ROTATION;
            body.linearVelocity = new Vec2(); body.angularVelocity = 0;
            collider.enabled = saved.collider.enabled;
            if (saved.collider.enabled) collider.apply();
            body.wakeUp();
        }
        return record;
    }

    private emitImpact(record: TowerBody, other: Collider2D, contact: IPhysics2DContact, audible: boolean): void {
        if (this.restoring) return;
        const peer = this.bodies.find(r => r.collider === other);
        if (peer && peer.id > record.id) return;
        const velocity = record.body.linearVelocity.clone();
        if (other.body) velocity.subtract(other.body.linearVelocity);
        // Audio remains object-deduplicated; a concave side contact must not consume
        // a later real floor contact from another fixture. Presentation has its own cooldown.
        this.impact?.(record, `${record.id}:${peer?.id ?? 0}`, audible ? velocity.length() : 0,
            this.landingContact(record, other, contact));
    }

    private landingContact(record: TowerBody, other: Collider2D, contact: IPhysics2DContact): LandingContact | undefined {
        if (other.sensor) return;
        const manifold = contact.getWorldManifold();
        if (!manifold.points.length) return;
        const sign = contact.colliderA === record.collider ? -1 : 1;
        const normal = new Vec2(manifold.normal.x * sign, manifold.normal.y * sign);
        const peer = this.bodies.find(candidate => candidate.collider === other);
        const upper = normal.y > .3 ? record : normal.y < -.3 ? peer : undefined;
        const lower = upper === record ? other.body : record.body;
        if (!upper || !lower || upper.placed || upper.lost) return;
        if (upper !== record) normal.multiplyScalar(-1);
        const point = new Vec2();
        for (const p of manifold.points) point.add(p);
        point.multiplyScalar(1 / manifold.points.length);
        const velocity = upper.body.getLinearVelocityFromWorldPoint(point, new Vec2());
        velocity.subtract(lower.getLinearVelocityFromWorldPoint(point, new Vec2()));
        // This point API includes angular velocity and returns world units/s (PTM=32),
        // unlike linearVelocity. Keep the existing impact-strength unit, metres/s.
        const speed = -Vec2.dot(velocity, normal) / 32;
        if (speed < .8) return;
        return { record: upper, support: upper === record ? other : record.collider, point, normal, speed,
            localPoint: upper.body.getLocalPoint(point, new Vec2()),
            localNormal: upper.body.getLocalVector(normal, new Vec2()) };
    }

    /** The controller freezes this normal-view boundary during an incident. Visual zoom never enters physics. */
    configureSafety(boundary: SafetyBoundary, referenceTop: number, assist = true): void {
        if (this.restoration) return;
        this.safety = { boundary: { ...boundary }, referenceTop: Math.max(0, referenceTop), assist };
        this.refreshSupport();
    }

    assistanceTop(): number { return this.safety?.referenceTop ?? 0; }

    private beforePhysics(): void {
        if (this.restoration) {
            // Creator emits AFTER_PHYSICS even when its accumulator ran no substep.
            // More than one fixed step of observed time guarantees a real solver pass.
            const dt = Number.isFinite(game.deltaTime) ? Math.min(.1, Math.max(0, game.deltaTime)) : 0;
            this.restoration.elapsed += dt;
            this.safetyTime += dt;
            return;
        }
        if (!this.safety) return;
        this.safetyDt = Math.min(.1, Math.max(0, game.deltaTime));
        this.safetyTime += this.safetyDt;
        for (const [key, relation] of this.supportReturns) if (relation.expires < this.safetyTime) this.supportReturns.delete(key);
        this.refreshSupport();
        this.checkLosses();
        this.updateAssistance(this.safetyDt);
    }

    /** PRE_SOLVE may run several substeps before Cocos copies native transforms to Nodes. */
    nativeBounds(record: TowerBody): { left: number; right: number; bottom: number; top: number } {
        const p = record.body.getWorldPoint(new Vec2(), new Vec2());
        const axis = record.body.getWorldVector(new Vec2(1, 0), new Vec2());
        const bounds = localBounds(record.spec, Math.atan2(axis.y, axis.x) * 180 / Math.PI);
        return { left: p.x + bounds.left, right: p.x + bounds.right, bottom: p.y + bounds.bottom, top: p.y + bounds.top };
    }

    private recordSupport(record: TowerBody, other: Collider2D, contact: IPhysics2DContact): void {
        if (other.sensor) return;
        const peer = this.bodies.find(candidate => candidate.collider === other);
        const manifold = contact.getWorldManifold();
        const towardY = manifold.normal.y * (contact.colliderA === record.collider ? 1 : -1);
        this.supportContacts.delete(contact);
        if (!manifold.points.length) return;
        // Cocos pools manifolds. Save scalar contact evidence while the solver owns it,
        // never retain a native point object for later stable-placement highlights.
        const points = manifold.points.map(point => ({ x: point.x, y: point.y }));
        if (towardY < -.3) this.supportContacts.set(contact, { upper: record, lower: other, points });
        else if (towardY > .3 && peer) this.supportContacts.set(contact, { upper: peer, lower: record.collider, points });
    }

    /** Directed contacts and finite local glue must ultimately reach the real ground. A floating pair is not a root. */
    private refreshSupport(): void {
        const supported = new Set<Collider2D>();
        if (this.platform.enabledInHierarchy && this.platform.body?.enabledInHierarchy) supported.add(this.platform);
        const edges: { upper: Collider2D; lower: Collider2D }[] = [];
        const active = (collider: Collider2D): boolean => collider.enabledInHierarchy &&
            !this.bodies.some(record => record.collider === collider && record.lost);
        for (const { upper, lower } of this.supportContacts.values()) {
            if (active(upper.collider) && active(lower)) edges.push({ upper: upper.collider, lower });
        }
        const connect = (a: Collider2D, b: Collider2D): void => {
            if (!active(a) || !active(b)) return;
            edges.push({ upper: a, lower: b }, { upper: b, lower: a });
        };
        for (const [a, b] of this.contactAssistance.supportPairs()) connect(a, b);
        let changed = true;
        while (changed) {
            changed = false;
            for (const { upper, lower } of edges) if (!supported.has(upper) && supported.has(lower)) {
                supported.add(upper); changed = true;
            }
        }
        for (const record of this.bodies) {
            record.supported = !record.lost && record.collider.enabledInHierarchy && supported.has(record.collider);
            // Help stops on actual detachment, independently of the loss grace timer.
            if (this.safety && (!record.supported || record.body.linearVelocity.y < FALL_SPEED)) this.setAssist(record, 0);
        }
    }

    private outside(record: TowerBody, boundary = this.safety!.boundary): { side: boolean; below: boolean } {
        const edge = !record.placed && record.lossBoundary ? record.lossBoundary : boundary;
        const bounds = this.nativeBounds(record);
        return { side: bounds.right < edge.left || bounds.left > edge.right, below: bounds.top < edge.bottom };
    }

    private checkLoss(record: TowerBody): void {
        if (!this.safety || record.lost || !record.collider.enabledInHierarchy ||
            record.body.type !== ERigidBody2DType.Dynamic) return;
        const outside = this.outside(record);
        if (outside.side || (outside.below && (!record.placed || (!record.supported &&
            record.detachedSeconds >= DETACH_GRACE_SECONDS && record.fallingSeconds >= FALL_SECONDS)))) this.markLost(record);
    }

    private checkLosses(): void { for (const record of this.bodies) this.checkLoss(record); }

    private mayReturnToSupport(record: TowerBody, other: Collider2D, contact: IPhysics2DContact): boolean {
        if (!record.placed || record.lost || !other.body || !other.enabledInHierarchy) return false;
        const previous = this.supportReturns.get(`${record.id}:${other.uuid}`);
        if (!previous || previous.expires < this.safetyTime) return false;
        const lower = this.bodies.find(candidate => candidate.collider === other);
        const lowerSupported = lower && (lower.supported || this.restoration?.supportedIds.has(lower.id));
        if (other !== this.platform && (!lowerSupported || lower?.lost)) return false;
        if (other === this.platform && !other.body.enabledInHierarchy) return false;
        const relative = record.body.linearVelocity.clone().subtract(other.body.linearVelocity);
        if (relative.length() >= .4 || Math.abs(record.body.angularVelocity) >= .5 || Math.abs(other.body.angularVelocity) >= .5) return false;
        const manifold = contact.getWorldManifold();
        const towardY = manifold.normal.y * (contact.colliderA === record.collider ? 1 : -1);
        return manifold.points.length > 0 && towardY < -.3;
    }

    private rejectContact(record: TowerBody, other: Collider2D, contact: IPhysics2DContact): boolean {
        // Retired bodies can still receive a deferred END/PRE_SOLVE callback during teardown.
        if (record.lost) { contact.disabled = true; return true; }
        const peer = this.bodies.find(candidate => candidate.collider === other);
        if (this.restoration?.safety) {
            // A rebuild may reopen original bearing contacts, but it must not grant an
            // already detached offscreen body a new route into the tower. Saved support
            // is only a first-step eligibility fact, never inserted into the live graph.
            const boundary = this.restoration.safety.boundary;
            const isolated = (candidate: TowerBody, counterpart: Collider2D): boolean => {
                if (candidate.lost) return true;
                const outside = this.outside(candidate, boundary);
                if (outside.side) return true;
                if (!outside.below) return false;
                return !candidate.placed || (!this.restoration!.supportedIds.has(candidate.id)
                    && !this.mayReturnToSupport(candidate, counterpart, contact));
            };
            if (contact.disabled || contact.disabledOnce || isolated(record, other) || (peer && isolated(peer, record.collider))) {
                contact.disabledOnce = true;
                this.supportContacts.delete(contact); this.filteredContacts++;
                return true;
            }
            return false;
        }
        if (this.safety) {
            // Refresh an existing edge's real normal before using it as evidence. Do not insert
            // a brand-new contact here: an external impact cannot certify its own support.
            if (this.supportContacts.has(contact)) this.recordSupport(record, other, contact);
            this.refreshSupport();
        }
        this.checkLoss(record);
        if (peer) this.checkLoss(peer);
        // An old, newly detached piece may still be in its loss grace interval. It cannot acquire
        // a fresh screen-external support or hit the lower tower while that interval is running.
        const isolated = (candidate: TowerBody, counterpart: Collider2D): boolean => {
            if (candidate.lost) return true;
            if (!this.safety || !candidate.collider.enabledInHierarchy) return false;
            const outside = this.outside(candidate);
            return outside.side || (outside.below && !candidate.supported && !this.mayReturnToSupport(candidate, counterpart, contact));
        };
        if (contact.disabled || contact.disabledOnce || isolated(record, other) || (peer && isolated(peer, record.collider))) {
            if (record.lost || peer?.lost) contact.disabled = true;
            else contact.disabledOnce = true;
            this.supportContacts.delete(contact);
            if (this.safety) this.filteredContacts++;
            return true;
        }
        return false;
    }

    private markLost(record: TowerBody): void {
        if (record.lost || this.losing.has(record.id)) return;
        this.losing.add(record.id);
        // The controller snapshots the old-tower set with the actual pre-solve transforms here.
        this.onLoss?.(record);
        record.lost = true; record.supported = false;
        this.losing.delete(record.id);
        this.setAssist(record, 0);
        this.contactAssistance.disableFor(record);
        for (const [contact, edge] of this.supportContacts) {
            if (edge.upper === record || edge.lower === record.collider) this.supportContacts.delete(contact);
        }
        for (const [key, relation] of this.supportReturns) {
            if (relation.upper === record || relation.lower === record.collider) this.supportReturns.delete(key);
        }
        for (const peer of this.bodies) peer.contacts.delete(record.collider);
        record.contacts.clear();
        record.collider.enabled = false;
    }

    private setAssist(record: TowerBody, value: number): void {
        record.assistDamping = value;
        const base = record.contacts.size && !record.lost ? record.spec.contactAngularDamping : undefined;
        const damping = (base ?? (record.spec.circle ? .1 : 1.5)) + value;
        // SetAngularDamping does not wake sleeping Box2D bodies. Never wake the deep tower for help.
        if (record.body.angularDamping !== damping) record.body.angularDamping = damping;
    }

    private updateAssistance(dt: number): void {
        if (!this.safety) return;
        const { referenceTop, assist } = this.safety;
        const physics = PhysicsSystem2D.instance;
        // Cocos may execute several fixed steps in one render frame. Smooth the
        // damping parameter within that budget; native Box2D applies it per step.
        dt = Math.min(dt, physics.fixedTimeStep * physics.maxSubSteps);
        for (const record of this.bodies) {
            if (!assist || record.lost || !record.supported || record.contactSeconds === null ||
                record.body.type !== ERigidBody2DType.Dynamic || record.body.linearVelocity.y < FALL_SPEED) {
                this.setAssist(record, 0); continue;
            }
            const distance = Math.max(0, referenceTop - this.nativeBounds(record).top - ASSIST_NEAR_DISTANCE);
            const weight = MAX_ASSIST_WEIGHT * (1 - Math.pow(2, -distance / ASSIST_HALF_DISTANCE));
            const target = ASSIST_ANGULAR_RATE * weight;
            this.setAssist(record, record.assistDamping + (target - record.assistDamping) * (1 - Math.exp(-ASSIST_RESPONSE_RATE * dt)));
        }
    }

    collapseTrend(): boolean {
        return this.bodies.filter(record => record.placed && !record.lost && !record.supported &&
            record.detachedSeconds >= DETACH_GRACE_SECONDS && record.fallingSeconds >= FALL_SECONDS).length >= 2;
    }

    remainingStable(): boolean {
        return this.bodies.every(record => record.lost || !record.collider.enabled ||
            (record.supported && record.body.linearVelocity.length() < .12 && Math.abs(record.body.angularVelocity) < .12));
    }

    safetySnapshot(): object {
        return { enabled: !!this.safety, boundary: this.safety?.boundary, referenceTop: this.safety?.referenceTop,
            // Legacy diagnostic name; it no longer means historical score height.
            confirmedTop: this.safety?.referenceTop, assistanceEnabled: this.safety?.assist,
            maxAssistDamping: ASSIST_ANGULAR_RATE * MAX_ASSIST_WEIGHT, filteredContacts: this.filteredContacts,
            nearDistance: ASSIST_NEAR_DISTANCE, halfDistance: ASSIST_HALF_DISTANCE, maxAssistWeight: MAX_ASSIST_WEIGHT,
            // Horizontal drag was rejected by the real-controller ablation: it changed
            // bearing motion enough to tip a previously viable dumbbell placement.
            horizontalRate: 0, responseRate: ASSIST_RESPONSE_RATE,
            pendingSupportReturns: this.supportReturns.size,
            detachGraceSeconds: DETACH_GRACE_SECONDS, fallSeconds: FALL_SECONDS, fallSpeed: FALL_SPEED,
            collapseTrend: this.collapseTrend(), remainingStable: this.remainingStable(),
            bodies: this.bodies.map(record => ({ id: record.id, lost: record.lost, supported: record.supported,
                detachedSeconds: record.detachedSeconds, fallingSeconds: record.fallingSeconds,
                assistDamping: record.assistDamping, angularDamping: record.body.angularDamping })) };
    }

    private afterPhysics(): void {
        this.contactAssistance.afterPhysics();
        if (this.restoration) {
            if (this.restoration.elapsed <= PhysicsSystem2D.instance.fixedTimeStep) return;
            this.safety = this.restoration.safety;
            this.restoration = null;
            this.refreshSupport();
            return;
        }
        if (this.safety) {
            this.refreshSupport();
            for (const record of this.bodies) {
                if (record.lost || !record.collider.enabled || record.body.type !== ERigidBody2DType.Dynamic) continue;
                record.detachedSeconds = record.supported ? 0 : record.detachedSeconds + this.safetyDt;
                record.fallingSeconds = record.body.linearVelocity.y < FALL_SPEED ? record.fallingSeconds + this.safetyDt : 0;
            }
            this.checkLosses();
            this.refreshSupport();
        }
        // The solver and deferred joint removal have finished. Remove lost nodes from the
        // active scene/physics now; keep their records readable until the scene is destroyed.
        for (const record of this.bodies) if (record.lost && record.node.active) record.node.active = false;
    }

    stabilizerSnapshot(): { active: object[]; brokenPairs: string[] } {
        return this.contactAssistance.stabilizerSnapshot();
    }

    release(record: TowerBody): void {
        if (record.lost) return;
        record.body.type = ERigidBody2DType.Dynamic;
        record.body.linearVelocity = new Vec2();
        record.body.angularVelocity = 0;
        record.collider.enabled = true;
        record.collider.apply();
        record.body.wakeUp();
    }

    isStable(): boolean {
        return this.bodies.every(({ body, collider, contacts, lost, supported }) => lost || !collider.enabled ||
            ((this.safety ? supported : contacts.size > 0) && body.linearVelocity.length() < .12 && Math.abs(body.angularVelocity) < .12));
    }

    /** Generous handoff gate, separate from the strict stable-score threshold. */
    hasPlacementHazard(): boolean {
        return this.bodies.some(({ body, collider, contacts, contactSeconds, lost, supported }) => {
            if (lost || !collider.enabled || contactSeconds === null) return false;
            return body.linearVelocity.y < -.75 || Math.abs(body.angularVelocity) > 1.5 ||
                ((this.safety ? !supported : contacts.size === 0) && body.linearVelocity.y < -.12);
        });
    }

    /** Include every attached surface that handoff permits, including horizontal sliding. */
    placementTop(): number {
        return Math.max(0, ...this.bodies.filter(({ body, collider, contacts, lost, supported }) =>
            !lost && collider.enabled && (this.safety ? supported : contacts.size > 0) && body.linearVelocity.y >= -.75 &&
            Math.abs(body.angularVelocity) <= 1.5).map(record => this.bounds(record).top));
    }

    /** Assistance must not disappear just because a real supported top is shaking.
     * This is independent of the stricter handoff gate and the historical score. */
    supportedTop(): number {
        return Math.max(0, ...this.bodies.filter(record => !record.lost && record.supported &&
            record.collider.enabledInHierarchy && record.body.type === ERigidBody2DType.Dynamic &&
            record.contactSeconds !== null).map(record => this.nativeBounds(record).top));
    }

    /** Read-only director inputs. Support width is a projected overlap proxy, not contact area.
     * Includes contacted pieces before score confirmation and the entire offscreen valid tower. */
    riskSignals(recentImpactSpeed = 0, placedOnly = false): TowerRiskSignals {
        const active = this.bodies.filter(record => !record.lost && record.collider.enabledInHierarchy &&
            record.body.type === ERigidBody2DType.Dynamic && record.contactSeconds !== null);
        const sampled = placedOnly ? active.filter(record => record.placed) : active;
        if (!sampled.length) return { maxTiltDegrees: 0, maxAngularSpeed: 0, minSupportRatio: 1,
            unsupportedMassRatio: 0, recentImpactSpeed: 0, mainSupportStable: true };
        const byCollider = new Map(active.map(record => [record.collider, record] as const));
        const bounds = new Map(active.map(record => [record, this.nativeBounds(record)] as const));
        const lowers = new Map<TowerBody, Set<Collider2D>>();
        const add = (upper: TowerBody, lower: Collider2D): void => {
            const peer = byCollider.get(lower);
            if (!lower.enabledInHierarchy || (lower !== this.platform && !peer?.supported)) return;
            let set = lowers.get(upper);
            if (!set) { set = new Set(); lowers.set(upper, set); }
            set.add(lower);
        };
        for (const edge of this.supportContacts.values()) if (byCollider.has(edge.upper.collider)) add(edge.upper, edge.lower);
        // A finite basketball/plank bond may carry load between contact substeps. It is still
        // connected to a grounded body, never an invented platform or a free-floating root.
        for (const [a, b] of this.contactAssistance.supportPairs()) {
            const first = byCollider.get(a), second = byCollider.get(b);
            if (a === this.platform && second) { add(second, a); continue; }
            if (b === this.platform && first) { add(first, b); continue; }
            if (!first || !second) continue;
            const ab = bounds.get(first)!, bb = bounds.get(second)!;
            if (ab.top + ab.bottom > bb.top + bb.bottom) add(first, b);
            else if (bb.top + bb.bottom > ab.top + ab.bottom) add(second, a);
        }
        let maxTiltDegrees = 0, maxAngularSpeed = 0, minSupportRatio = 1;
        let mass = 0, unsupportedMass = 0;
        // Only roots carrying the sampled tower affect its base stability. Keep a new
        // rescuer underneath old pieces, but exclude an unrelated newly landed root.
        const providers = new Set(sampled), pending = [...sampled];
        for (let i = 0; i < pending.length; i++) {
            for (const lower of lowers.get(pending[i]) ?? []) {
                const peer = byCollider.get(lower);
                if (peer && !providers.has(peer)) { providers.add(peer); pending.push(peer); }
            }
        }
        const roots = active.filter(record => providers.has(record) && lowers.get(record)?.has(this.platform));
        for (const record of sampled) {
            const bodyMass = record.body.getMass();
            mass += bodyMass;
            if (!record.supported) unsupportedMass += bodyMass;
            const axis = record.body.getWorldVector(new Vec2(1, 0), new Vec2());
            const angle = Math.atan2(axis.y, axis.x) * 180 / Math.PI;
            // A box/plank can legitimately land on another face. Orientation alone must not
            // permanently mark that resting tower Critical; spin and lost support catch tipping.
            const tilt = Math.abs(((angle % 90) + 135) % 90 - 45);
            if (!record.spec.circle) maxTiltDegrees = Math.max(maxTiltDegrees, tilt);
            maxAngularSpeed = Math.max(maxAngularSpeed, Math.abs(record.body.angularVelocity) * 180 / Math.PI);
            const own = bounds.get(record)!;
            const intervals: { left: number; right: number }[] = [];
            for (const lower of lowers.get(record) ?? []) {
                const support = lower === this.platform ? { left: -PLATFORM_WIDTH / 2, right: PLATFORM_WIDTH / 2 }
                    : bounds.get(byCollider.get(lower)!)!;
                const left = Math.max(own.left, support.left), right = Math.min(own.right, support.right);
                if (right > left) intervals.push({ left, right });
            }
            intervals.sort((a, b) => a.left - b.left);
            let covered = 0, end = -Infinity;
            for (const interval of intervals) {
                covered += Math.max(0, interval.right - Math.max(end, interval.left));
                end = Math.max(end, interval.right);
            }
            minSupportRatio = Math.min(minSupportRatio, record.supported
                ? Math.min(1, covered / Math.max(1, own.right - own.left)) : 0);
        }
        return { maxTiltDegrees, maxAngularSpeed, minSupportRatio,
            unsupportedMassRatio: mass > 0 ? unsupportedMass / mass : 0, recentImpactSpeed,
            mainSupportStable: roots.length > 0 && roots.every(record => record.supported &&
                record.body.linearVelocity.length() < .12 && Math.abs(record.body.angularVelocity) < .12) };
    }

    /** Stable highlight evidence from real upward-bearing contact points only. A local
     * bond may stabilize play, but cannot invent an edge/gap or prove a bridge by itself. */
    highlightPlacement(record: TowerBody): HighlightPlacement & { point: { x: number; y: number } | null } {
        const live = (body: TowerBody) => !body.lost && body.supported && body.collider.enabledInHierarchy;
        const peers = new Map(this.bodies.filter(live).map(body => [body.collider, body] as const));
        const groups = new Map<Collider2D, { x: number; y: number }[]>();
        const supportedBodyIds = new Set<number>();
        for (const edge of this.supportContacts.values()) {
            if (!edge.lower.enabledInHierarchy || !live(edge.upper)) continue;
            if (edge.lower === record.collider && edge.upper !== record) supportedBodyIds.add(edge.upper.id);
            if (edge.upper !== record || (edge.lower !== this.platform && !peers.has(edge.lower))) continue;
            const points = groups.get(edge.lower) ?? [];
            points.push(...edge.points.filter(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
            groups.set(edge.lower, points);
        }
        const own = this.nativeBounds(record), width = Math.max(1, own.right - own.left);
        const centerX = record.body.getWorldCenter(new Vec2()).x;
        const bearings = Array.from(groups.values()).filter(points => points.length > 0).map(points => ({
            left: Math.min(...points.map(point => point.x)), right: Math.max(...points.map(point => point.x)),
        })).sort((a, b) => a.left - b.left);
        // Union native-fixture spans so concave shapes and repeated contacts do not duplicate credit.
        let covered = 0, end = -Infinity, bridgeGap = 0;
        for (const bearing of bearings) {
            if (end < centerX && bearing.left > centerX && Number.isFinite(end))
                bridgeGap = Math.max(bridgeGap, bearing.left - end);
            covered += Math.max(0, Math.min(own.right, bearing.right) - Math.max(own.left, end, bearing.left));
            end = Math.max(end, bearing.right);
        }
        const single = bearings.length === 1 ? bearings[0] : null;
        const half = single ? (single.right - single.left) / 2 : 0;
        const points = Array.from(groups.values()).reduce((all, next) => all.concat(next), [] as { x: number; y: number }[]);
        const accent = points.reduce<{ x: number; y: number } | null>((nearest, point) =>
            !nearest || Math.abs(point.x - centerX) < Math.abs(nearest.x - centerX) ? point : nearest, null);
        return { id: record.id, supported: live(record), bearingCount: bearings.length,
            supportRatio: Math.min(1, covered / width),
            centerOffsetRatio: single && half > .001 ? Math.abs(centerX - (single.left + single.right) / 2) / half : 0,
            bridgeGapRatio: bridgeGap / width, supportedBodyIds: Array.from(supportedBodyIds),
            point: accent ? { ...accent } : null };
    }

    bounds(record: TowerBody): { left: number; right: number; bottom: number; top: number } {
        const bounds = localBounds(record.spec, planarAngle(record.node.rotation)), p = record.node.position;
        return { left: p.x + bounds.left, right: p.x + bounds.right, bottom: p.y + bounds.bottom, top: p.y + bounds.top };
    }

    confirmedTop(): number {
        return Math.max(0, ...this.bodies.filter(r => r.placed && !r.lost).map(r => this.bounds(r).top));
    }

    get restoring(): boolean { return this.restoration !== null; }

    canSaveCheckpoint(): boolean {
        if (this.restoring || !this.safety || !this.isStable() || this.hasPlacementHazard()) return false;
        return this.bodies.every(record => {
            if (record.lost || !record.collider.enabled) return true;
            const outside = this.outside(record);
            // A supported, confirmed tower base remains valid below the moving camera.
            return !outside.side && (!outside.below || (record.placed && record.supported));
        });
    }

    exportState(): TowerWorldState {
        if (this.restoring) throw new Error('Cannot save while restoring tower contacts');
        const live = new Map(this.bodies.filter(record => !record.lost && record.collider.enabledInHierarchy)
            .map(record => [record.collider, record] as const));
        const supportReturns: TowerWorldState['supportReturns'] = [];
        for (const relation of this.supportReturns.values()) {
            const lower = live.get(relation.lower);
            if (relation.expires < this.safetyTime || !live.has(relation.upper.collider)
                || !relation.upper.placed || !relation.lower.enabledInHierarchy
                || (relation.lower !== this.platform && !lower)) continue;
            supportReturns.push({ upperId: relation.upper.id, lowerId: lower?.id ?? 0,
                // Subtraction can add a tiny floating-point error to the original .12 s.
                remainingSeconds: Math.min(DETACH_GRACE_SECONDS, Math.max(0, relation.expires - this.safetyTime)) });
        }
        return { nextId: this.nextId, safety: this.safety ? { ...this.safety, boundary: { ...this.safety.boundary } } : null,
            bodies: this.bodies.filter(record => !record.lost).map(record => {
                const { body, collider } = record;
                // A touch can move/rotate a held kinematic node and release in the same
                // frame, before syncSceneToPhysics. Its node owns that uncommitted pose.
                const held = body.type === ERigidBody2DType.Kinematic && !collider.enabled;
                const position = held ? record.node.position : body.getWorldPoint(new Vec2(), new Vec2());
                const native = body.impl!.impl as { GetAngle(): number };
                return { id: record.id, spec: cloneSpec(record.spec), position: { x: position.x, y: position.y },
                    angle: held ? planarAngle(record.node.rotation) : native.GetAngle() * 180 / Math.PI,
                    scale: { x: record.node.scale.x, y: record.node.scale.y, z: record.node.scale.z },
                    placed: record.placed, supported: record.supported, contactSeconds: record.contactSeconds,
                    ...(record.lossBoundary ? { lossBoundary: { ...record.lossBoundary } } : {}),
                    assistDamping: record.assistDamping,
                    body: { type: body.type, allowSleep: body.allowSleep, bullet: body.bullet, fixedRotation: body.fixedRotation,
                        gravityScale: body.gravityScale, linearDamping: body.linearDamping,
                        angularDamping: body.angularDamping, group: body.group },
                    collider: { enabled: collider.enabled, density: collider.density, friction: collider.friction,
                        restitution: collider.restitution, sensor: collider.sensor } };
            }), assistance: this.contactAssistance.exportState(this.platform), supportReturns };
    }

    /** Validate everything before touching the live world. This is an in-memory run checkpoint,
     * not a loader for arbitrary editor scenes or cross-version persisted saves. */
    static validateState(state: TowerWorldState): void {
        const fail = (): never => { throw new Error('Invalid tower checkpoint'); };
        const positive = (value: number): boolean => Number.isFinite(value) && value > 0;
        const nonnegative = (value: number): boolean => Number.isFinite(value) && value >= 0;
        const boundary = (value: SafetyBoundary): boolean => !!value &&
            [value.left, value.right, value.bottom, value.top].every(Number.isFinite)
            && value.left < value.right && value.bottom < value.top;
        if (!state || !Array.isArray(state.bodies) || !Array.isArray(state.supportReturns)
            || !Number.isSafeInteger(state.nextId) || state.nextId < 1) fail();
        if (state.safety !== null && (!state.safety || !boundary(state.safety.boundary)
            || !nonnegative(state.safety.referenceTop) || typeof state.safety.assist !== 'boolean')) fail();
        const specs = new Map<number, ObjectSpec>();
        for (const saved of state.bodies) {
            if (!saved || !Number.isSafeInteger(saved.id) || saved.id < 1 || saved.id >= state.nextId || specs.has(saved.id)) fail();
            const spec = saved.spec, body = saved.body, collider = saved.collider;
            if (!spec || !Object.prototype.hasOwnProperty.call(OBJECTS, spec.kind)
                || ![spec.width, spec.height, spec.spriteWidth, spec.spriteHeight, spec.density].every(positive)
                || ![spec.friction, spec.restitution].every(nonnegative) || typeof spec.circle !== 'boolean') fail();
            const point = (value: readonly number[]): boolean => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);
            if (spec.spriteOffset !== undefined && !point(spec.spriteOffset)) fail();
            if (spec.outline !== undefined && (!Array.isArray(spec.outline) || spec.outline.length < 3 || !spec.outline.every(point))) fail();
            if (spec.contactAngularDamping !== undefined && !nonnegative(spec.contactAngularDamping)) fail();
            if (spec.contactImpactSpeed !== undefined && !nonnegative(spec.contactImpactSpeed)) fail();
            for (const tuning of [spec.adhesion, spec.stabilizer]) if (tuning !== undefined && (!tuning
                || ![tuning.maxForce, tuning.maxTorque, tuning.maxImpactSpeed].every(nonnegative))) fail();
            if (spec.stabilizer && !nonnegative(spec.stabilizer.maxAngleError)) fail();
            if (!saved.position || !saved.scale || ![saved.position.x, saved.position.y, saved.angle].every(Number.isFinite)
                || ![saved.scale.x, saved.scale.y, saved.scale.z].every(positive)
                || typeof saved.placed !== 'boolean' || typeof saved.supported !== 'boolean' || !nonnegative(saved.assistDamping)
                || (saved.contactSeconds !== null && !nonnegative(saved.contactSeconds))) fail();
            if (saved.lossBoundary && (![saved.lossBoundary.left, saved.lossBoundary.right, saved.lossBoundary.bottom].every(Number.isFinite)
                || saved.lossBoundary.left >= saved.lossBoundary.right)) fail();
            if (!body || (body.type !== ERigidBody2DType.Dynamic && body.type !== ERigidBody2DType.Kinematic)
                || ![body.allowSleep, body.bullet, body.fixedRotation].every(value => typeof value === 'boolean')
                || !Number.isFinite(body.gravityScale) || ![body.linearDamping, body.angularDamping].every(nonnegative)
                || !Number.isInteger(body.group) || body.group <= 0) fail();
            if (!collider || ![collider.enabled, collider.sensor].every(value => typeof value === 'boolean')
                || !positive(collider.density) || ![collider.friction, collider.restitution].every(nonnegative)) fail();
            if (collider.enabled !== (body.type === ERigidBody2DType.Dynamic)
                || ((saved.placed || saved.supported) && !collider.enabled)) fail();
            specs.set(saved.id, spec);
        }
        ContactAssistance.validateState(state.assistance, specs);
        const enabled = new Set(state.bodies.filter(body => body.collider.enabled).map(body => body.id));
        if (state.assistance.adhesion.some(bond => !enabled.has(bond.ballId) || (bond.otherId !== 0 && !enabled.has(bond.otherId)))
            || state.assistance.stabilizers.some(bond => !enabled.has(bond.plankId) || !enabled.has(bond.supportId))) fail();
        const returns = new Set<string>();
        for (const relation of state.supportReturns) {
            if (!relation || !enabled.has(relation.upperId) || !state.bodies.find(body => body.id === relation.upperId)?.placed
                || (relation.lowerId !== 0 && !enabled.has(relation.lowerId)) || relation.upperId === relation.lowerId
                || !nonnegative(relation.remainingSeconds) || relation.remainingSeconds > DETACH_GRACE_SECONDS) fail();
            const key = `${relation.upperId}:${relation.lowerId}`;
            if (returns.has(key)) fail();
            returns.add(key);
        }
    }

    restoreState(state: TowerWorldState): void {
        TowerWorld.validateState(state);
        // Remove motors while their native endpoints still exist. Retire records before
        // disabling bodies so any deferred callbacks cannot leak into the restored run.
        this.contactAssistance.dispose();
        this.safety = null;
        this.restoration = { safety: state.safety ? { ...state.safety, boundary: { ...state.safety.boundary } } : null,
            elapsed: 0, supportedIds: new Set(state.bodies.filter(body => body.supported).map(body => body.id)) };
        for (const record of this.bodies) {
            record.lost = true; record.supported = false;
            record.collider.enabled = false; record.body.enabled = false; record.node.active = false;
            record.node.destroy();
        }
        this.bodies.length = 0;
        this.supportContacts.clear(); this.supportReturns.clear(); this.losing.clear();
        this.safetyTime = 0; this.safetyDt = 0; this.filteredContacts = 0;
        for (const saved of state.bodies) {
            this.nextId = saved.id;
            this.create(cloneSpec(saved.spec), saved.position.x, saved.position.y, saved);
        }
        this.nextId = state.nextId;
        this.contactAssistance.restoreState(state.assistance, this.platform);
        const byId = new Map(this.bodies.map(record => [record.id, record] as const));
        for (const saved of state.supportReturns) {
            const upper = byId.get(saved.upperId)!;
            const lower = saved.lowerId === 0 ? this.platform : byId.get(saved.lowerId)!.collider;
            this.supportReturns.set(`${upper.id}:${lower.uuid}`, { upper, lower, expires: saved.remainingSeconds });
        }
    }

    dispose(): void {
        director.off(Director.EVENT_BEFORE_PHYSICS, this.beforePhysics, this);
        director.off(Director.EVENT_AFTER_PHYSICS, this.afterPhysics, this);
        this.supportContacts.clear(); this.supportReturns.clear(); this.losing.clear();
        this.restoration = null;
        this.contactAssistance.dispose();
        if (isValid(this.root, true)) this.root.destroy();
    }
}
