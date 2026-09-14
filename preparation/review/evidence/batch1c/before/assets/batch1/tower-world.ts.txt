import { BoxCollider2D, CircleCollider2D, Collider2D, Contact2DType, director, Director, ERigidBody2DType, game,
    IPhysics2DContact, isValid, Node, PolygonCollider2D, RelativeJoint2D, RigidBody2D, Size, Vec2 } from 'cc';
import { localBounds, ObjectSpec, planarAngle, PLATFORM_WIDTH } from './object-data';

// Creator 3.8.8 point-velocity uses world units; linearVelocity uses Box2D metres.
const COCOS_PTM_RATIO = 32;
// Small contact gaps do not turn an old supported tower into a loss. These are 1B tuning candidates.
const DETACH_GRACE_SECONDS = .12;
const FALL_SPEED = -.75;
const FALL_SECONDS = .12;
const MAX_DEEP_ASSIST = 8;

interface SafetyBoundary { top: number; bottom: number; left: number; right: number }

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

interface AdhesionContact { ball: TowerBody; other: Collider2D; side: number }
interface AdhesionBond extends AdhesionContact {
    joint: RelativeJoint2D;
    base: RigidBody2D;
    attached: RigidBody2D;
    offset: Vec2;
}
interface StabilizerContact { plank: TowerBody; support: TowerBody; contact: IPhysics2DContact }
interface StabilizerBond {
    plank: TowerBody;
    support: TowerBody;
    joint: RelativeJoint2D;
    offset: Vec2;
    angle: number;
}

/** Compare physical angles across the -180/180 degree representation boundary. */
function wrapAngle(angle: number): number { return ((angle + 180) % 360 + 360) % 360 - 180; }

/** Creator 3.8.8 Box2D WASM exposes GetAngle() in radians with complete turns.
 * MotorJoint needs that original difference; quaternion angles could introduce
 * a spurious full-turn correction at attachment. Only error checks should wrap. */
function relativeBodyAngle(base: RigidBody2D, attached: RigidBody2D): number {
    const baseNative = base.impl!.impl as { GetAngle(): number };
    const attachedNative = attached.impl!.impl as { GetAngle(): number };
    return (attachedNative.GetAngle() - baseNative.GetAngle()) * 180 / Math.PI;
}

/** Initial overlaps must not become a motor's permanent target against contact resolution.
 * Creator's bundled Box2D linearSlop is .005 m. Preserve that solver tolerance,
 * correcting the target only along the actual support normal; never move either body. */
function contactOffset(base: RigidBody2D, attached: RigidBody2D, baseCollider: Collider2D, contact: IPhysics2DContact): Vec2 {
    const offset = base.getLocalPoint(attached.getWorldPoint(new Vec2(), new Vec2()), new Vec2());
    const manifold = contact.getWorldManifold();
    const correction = Math.max(0, -Math.min(...manifold.separations) - .005 * COCOS_PTM_RATIO);
    if (correction > 0) {
        const sign = contact.colliderA === baseCollider ? 1 : -1;
        const normal = new Vec2(manifold.normal.x * sign * correction, manifold.normal.y * sign * correction);
        offset.add(base.getLocalVector(normal, new Vec2()));
    }
    return offset;
}

/** Physics nodes never inherit a screen, Canvas or presentation scale. */
export class TowerWorld {
    readonly root: Node;
    readonly bodies: TowerBody[] = [];
    readonly platform: BoxCollider2D;
    private nextId = 1;
    private readonly pendingAdhesion = new Map<string, AdhesionContact & { contact: IPhysics2DContact }>();
    private readonly bonds = new Map<string, AdhesionBond>();
    private readonly cushionedBodies = new Set<number>();
    private readonly pendingStabilizers = new Map<string, StabilizerContact>();
    private readonly stabilizerBonds = new Map<string, StabilizerBond>();
    // A torn connection cannot continually reconnect and consume more fall energy.
    private readonly brokenStabilizers = new Set<string>();
    private safety: { boundary: SafetyBoundary; confirmedTop: number; assist: boolean } | null = null;
    // Keep copied support directions, never query a pooled Cocos contact after END_CONTACT.
    private readonly supportContacts = new Map<IPhysics2DContact, { upper: TowerBody; lower: Collider2D }>();
    // A brief contact gap may reconnect only to its original, still grounded bearing surface.
    private readonly supportReturns = new Map<string, { upper: TowerBody; lower: Collider2D; expires: number }>();
    private readonly losing = new Set<number>();
    private safetyTime = 0;
    private safetyDt = 0;
    private filteredContacts = 0;

    constructor(scene: Node, private readonly impact?: (record: TowerBody, pair: string, speed: number) => void,
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

    create(spec: ObjectSpec, x: number, y: number): TowerBody {
        const node = new Node(`Body:${this.nextId}:${spec.kind}`);
        // Configure off-scene: Creator reads the plain `bullet` field only when creating the
        // native body. Adding an active node first silently left native IsBullet() false.
        node.setPosition(x, y, 0);
        const body = node.addComponent(RigidBody2D);
        body.type = ERigidBody2DType.Kinematic;
        body.allowSleep = true;
        body.enabledContactListener = true;
        body.linearDamping = .05;
        // Modest rotational drag damps impact chatter; unsupported bodies still tip and fall.
        const freeAngularDamping = spec.circle ? .1 : 1.5;
        body.angularDamping = freeAngularDamping;
        body.bullet = true;
        const collider = spec.circle ? node.addComponent(CircleCollider2D) :
            spec.outline ? node.addComponent(PolygonCollider2D) : node.addComponent(BoxCollider2D);
        collider.enabled = false;
        if (collider instanceof CircleCollider2D) collider.radius = spec.width / 2;
        else if (collider instanceof PolygonCollider2D) collider.points = spec.outline!.map(([x, y]) => new Vec2(x, y));
        else collider.size = new Size(spec.width, spec.height);
        collider.density = spec.density;
        collider.friction = spec.friction;
        collider.restitution = spec.restitution;
        const record: TowerBody = { id: this.nextId++, spec, node, body, collider, contacts: new Set(),
            placed: false, lost: false, supported: false, detachedSeconds: 0, fallingSeconds: 0,
            assistDamping: 0, contactSeconds: null };
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
            if (active.size > 1) return;
            record.contacts.add(other);
            if (spec.contactAngularDamping !== undefined) body.angularDamping = spec.contactAngularDamping + record.assistDamping;
            const peer = this.bodies.find(r => r.collider === other);
            if (peer && peer.id > record.id) return;
            const velocity = body.linearVelocity.clone();
            if (other.body) velocity.subtract(other.body.linearVelocity);
            this.impact?.(record, `${record.id}:${peer?.id ?? 0}`, velocity.length());
        });
        collider.on(Contact2DType.END_CONTACT, (_self: Collider2D, other: Collider2D, contact: IPhysics2DContact) => {
            const previous = this.supportContacts.get(contact);
            if (this.safety && previous?.upper.placed && previous.upper.supported && !previous.upper.lost) {
                this.supportReturns.set(`${previous.upper.id}:${previous.lower.uuid}`,
                    { ...previous, expires: this.safetyTime + DETACH_GRACE_SECONDS });
            }
            this.supportContacts.delete(contact);
            if (this.safety) this.refreshSupport();
            const active = fixtureContacts.get(other);
            if (!active?.delete(contact)) return;
            // A side graze on the same object must not keep an ended support contact eligible
            // for glue. Cocos recycles the contact object immediately after this END callback.
            for (const [key, pending] of this.pendingAdhesion) {
                if (pending.ball === record && pending.contact === contact) this.pendingAdhesion.delete(key);
            }
            for (const [key, pending] of this.pendingStabilizers) {
                if (pending.plank === record && pending.contact === contact) this.pendingStabilizers.delete(key);
            }
            if (active.size > 0) return;
            fixtureContacts.delete(other);
            record.contacts.delete(other);
            if (record.contacts.size === 0) body.angularDamping = freeAngularDamping + record.assistDamping;
        });
        collider.on(Contact2DType.PRE_SOLVE,
            (_self: Collider2D, other: Collider2D, contact: IPhysics2DContact) => {
                if (this.rejectContact(record, other, contact)) return;
                this.recordSupport(record, other, contact);
                this.prepareCushion(record, other, contact);
                if (spec.adhesion) this.prepareAdhesion(record, other, contact);
                if (spec.stabilizer) this.prepareStabilizer(record, other, contact);
        });
        this.bodies.push(record);
        this.root.addChild(node);
        return record;
    }

    /** The controller freezes this normal-view boundary during an incident. Visual zoom never enters physics. */
    configureSafety(boundary: SafetyBoundary, confirmedTop: number, assist = true): void {
        this.safety = { boundary: { ...boundary }, confirmedTop, assist };
        this.refreshSupport();
    }

    private beforePhysics(): void {
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
        if (towardY < -.3) this.supportContacts.set(contact, { upper: record, lower: other });
        else if (towardY > .3 && peer) this.supportContacts.set(contact, { upper: peer, lower: record.collider });
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
        for (const bond of this.bonds.values()) {
            if (this.bondIntact(bond)) connect(bond.ball.collider, bond.other);
        }
        for (const bond of this.stabilizerBonds.values()) {
            const error = this.stabilizerError(bond);
            if (error.distance <= Math.max(8, bond.plank.spec.height * .5) &&
                error.angle <= bond.plank.spec.stabilizer!.maxAngleError) connect(bond.plank.collider, bond.support.collider);
        }
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

    private outside(record: TowerBody): { side: boolean; below: boolean } {
        const edge = !record.placed && record.lossBoundary ? record.lossBoundary : this.safety!.boundary;
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
        if (other !== this.platform && (!lower?.supported || lower.lost)) return false;
        if (other === this.platform && !other.body.enabledInHierarchy) return false;
        const relative = record.body.linearVelocity.clone().subtract(other.body.linearVelocity);
        if (relative.length() >= .4 || Math.abs(record.body.angularVelocity) >= .5 || Math.abs(other.body.angularVelocity) >= .5) return false;
        const manifold = contact.getWorldManifold();
        const towardY = manifold.normal.y * (contact.colliderA === record.collider ? 1 : -1);
        return manifold.points.length > 0 && towardY < -.3;
    }

    private rejectContact(record: TowerBody, other: Collider2D, contact: IPhysics2DContact): boolean {
        const peer = this.bodies.find(candidate => candidate.collider === other);
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
        // Disabling a collider or joint in PRE_SOLVE is deferred by Creator. Zero the existing
        // motors immediately as well; contact.disabled is the immediate collision barrier.
        for (const [key, bond] of this.bonds) if (bond.ball === record || bond.other === record.collider) {
            bond.joint.maxForce = 0; bond.joint.maxTorque = 0;
            this.removeBond(bond); this.bonds.delete(key);
        }
        for (const [key, bond] of this.stabilizerBonds) if (bond.plank === record || bond.support === record) {
            bond.joint.maxForce = 0; bond.joint.maxTorque = 0;
            this.removeBond(bond); this.stabilizerBonds.delete(key); this.brokenStabilizers.add(key);
        }
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
        const { boundary, confirmedTop, assist } = this.safety;
        const height = Math.max(1, boundary.top - boundary.bottom);
        for (const record of this.bodies) {
            if (!assist || record.lost || !record.placed || !record.supported || record.body.linearVelocity.y < FALL_SPEED) {
                this.setAssist(record, 0); continue;
            }
            const bounds = this.nativeBounds(record);
            const depth = Math.max(0, confirmedTop - bounds.top);
            const t = Math.max(0, Math.min(1, (depth - height) / (2 * height)));
            const target = bounds.top < boundary.bottom ? MAX_DEEP_ASSIST * t * t * (3 - 2 * t) : 0;
            this.setAssist(record, record.assistDamping + (target - record.assistDamping) * (1 - Math.exp(-8 * dt)));
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
        return { enabled: !!this.safety, boundary: this.safety?.boundary, confirmedTop: this.safety?.confirmedTop,
            assistanceEnabled: this.safety?.assist, maxAssistDamping: MAX_DEEP_ASSIST, filteredContacts: this.filteredContacts,
            pendingSupportReturns: this.supportReturns.size,
            detachGraceSeconds: DETACH_GRACE_SECONDS, fallSeconds: FALL_SECONDS, fallSpeed: FALL_SPEED,
            collapseTrend: this.collapseTrend(), remainingStable: this.remainingStable(),
            bodies: this.bodies.map(record => ({ id: record.id, lost: record.lost, supported: record.supported,
                detachedSeconds: record.detachedSeconds, fallingSeconds: record.fallingSeconds,
                assistDamping: record.assistDamping, angularDamping: record.body.angularDamping })) };
    }

    private horizontal(record: TowerBody): boolean {
        return Math.abs(Math.sin(planarAngle(record.node.rotation) * Math.PI / 180)) <= Math.sin(Math.PI / 12);
    }

    private prepareCushion(record: TowerBody, other: Collider2D, contact: IPhysics2DContact): void {
        if (!other.body || other.sensor) return;
        const manifold = contact.getWorldManifold();
        const normal = new Vec2(manifold.normal.x, manifold.normal.y);
        normal.multiplyScalar(contact.colliderA === record.collider ? 1 : -1);
        if (Math.abs(normal.y) < .7 || !manifold.points.length) return;
        const peer = this.bodies.find(candidate => candidate.collider === other);
        const incoming = normal.y < 0 ? record : peer;
        const support = incoming === record ? peer : record;
        if (!incoming || incoming.placed || incoming.body.type !== ERigidBody2DType.Dynamic ||
            this.cushionedBodies.has(incoming.id) || (support && support.id > incoming.id)) return;
        const supportBody = incoming === record ? other.body : record.body;
        const boardLimit = support?.spec.stabilizer && this.horizontal(support) ? support.spec.stabilizer.maxImpactSpeed : undefined;
        const limit = Math.min(incoming.spec.contactImpactSpeed ?? Infinity, boardLimit ?? Infinity);
        if (!Number.isFinite(limit)) return;
        if (incoming !== record) normal.multiplyScalar(-1);
        // Consume this one-time help only on a real lower support, never a side graze.
        this.cushionedBodies.add(incoming.id);
        this.cushionImpact(incoming.body, supportBody, manifold.points[0], normal, limit);
    }

    private prepareStabilizer(plank: TowerBody, other: Collider2D, contact: IPhysics2DContact): void {
        const support = this.bodies.find(record => record.collider === other);
        if (!support) return; // Never attach the plank to the static ground.
        const key = `${plank.id}:${support.id}`;
        if (this.brokenStabilizers.has(key) || this.stabilizerBonds.has(key) || this.pendingStabilizers.has(key)) return;
        const pending = { plank, support, contact };
        if (this.validStabilizerContact(pending)) this.pendingStabilizers.set(key, pending);
    }

    private validStabilizerContact({ plank, support, contact }: StabilizerContact): boolean {
        if (!plank.collider.enabledInHierarchy || !support.collider.enabledInHierarchy || support.collider.sensor ||
            plank.body.type !== ERigidBody2DType.Dynamic || support.body.type !== ERigidBody2DType.Dynamic ||
            support.id >= plank.id || !plank.contacts.has(support.collider) || !this.horizontal(plank)) return false;
        const manifold = contact.getWorldManifold();
        const towardY = manifold.normal.y * (contact.colliderA === plank.collider ? 1 : -1);
        return towardY < -.7 && manifold.points.some(point => point.y <= plank.node.worldPosition.y);
    }

    private prepareAdhesion(ball: TowerBody, other: Collider2D, contact: IPhysics2DContact): void {
        if (!other.body || other.sensor) return;
        const manifold = contact.getWorldManifold();
        const normal = new Vec2(manifold.normal.x, manifold.normal.y);
        normal.multiplyScalar(contact.colliderA === ball.collider ? 1 : -1);
        if (Math.abs(normal.y) < .7 || !manifold.points.length) return;
        const side = Math.sign(normal.y), key = `${ball.id}:${side}`;
        if (this.bonds.has(key) || this.pendingAdhesion.has(key)) return;
        const peer = this.bodies.find(record => record.collider === other);
        // A settled object brushing the top of a loose ball is not a new placement.
        if (side > 0 && (!peer || peer.placed || peer.id < ball.id)) return;
        this.pendingAdhesion.set(key, { ball, other, side, contact });
        const incoming = peer && peer.id > ball.id ? peer : ball;
        if (incoming.placed) return;
        const support = incoming === ball ? other.body : ball.body;
        if (incoming !== ball) normal.multiplyScalar(-1);
        this.cushionImpact(incoming.body, support, manifold.points[0], normal, ball.spec.adhesion!.maxImpactSpeed);
    }

    private cushionImpact(body: RigidBody2D, support: RigidBody2D, point: Vec2, toward: Vec2, limit: number): void {
        const relative = body.getLinearVelocityFromWorldPoint(point, new Vec2());
        relative.subtract(support.getLinearVelocityFromWorldPoint(point, new Vec2()));
        const closing = body.linearVelocity.clone().subtract(support.linearVelocity).dot(toward);
        // Angular motion at an off-center contact must not reverse the body's translation.
        const excess = Math.min(relative.dot(toward) / COCOS_PTM_RATIO - limit, Math.max(0, closing));
        if (excess <= 0) return;
        // Local glue cushioning removes closing energy only at a real new contact.
        // Gravity, tangential motion, older bodies and free flight remain simulated.
        body.linearVelocity = body.linearVelocity.clone().subtract(toward.multiplyScalar(excess));
    }

    private afterPhysics(): void {
        for (const [key, bond] of this.bonds) {
            if (!this.bondIntact(bond)) { this.removeBond(bond); this.bonds.delete(key); }
        }
        for (const [key, pending] of this.pendingAdhesion) {
            if (pending.ball.contacts.has(pending.other) && pending.other.enabledInHierarchy) {
                this.bonds.set(key, this.attach(pending));
            }
        }
        this.pendingAdhesion.clear();
        for (const [key, bond] of this.stabilizerBonds) {
            const error = this.stabilizerError(bond);
            if (!bond.plank.collider.enabledInHierarchy || !bond.support.collider.enabledInHierarchy ||
                error.distance > Math.max(8, bond.plank.spec.height * .5) ||
                error.angle > bond.plank.spec.stabilizer!.maxAngleError) {
                this.removeBond(bond); this.stabilizerBonds.delete(key); this.brokenStabilizers.add(key);
            }
        }
        for (const [key, pending] of this.pendingStabilizers) {
            const count = Array.from(this.stabilizerBonds.values()).filter(bond => bond.plank === pending.plank).length;
            if (count < 2 && !this.brokenStabilizers.has(key) && this.validStabilizerContact(pending)) {
                this.stabilizerBonds.set(key, this.attachStabilizer(pending));
            }
        }
        this.pendingStabilizers.clear();
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

    private attachStabilizer({ plank, support, contact }: StabilizerContact): StabilizerBond {
        const spec = plank.spec.stabilizer!;
        const offset = contactOffset(support.body, plank.body, support.collider, contact);
        const angle = relativeBodyAngle(support.body, plank.body);
        const joint = support.node.addComponent(RelativeJoint2D);
        joint.connectedBody = plank.body; joint.autoCalcOffset = false;
        joint.linearOffset = offset; joint.angularOffset = angle;
        // Fixed half-budget per support: adding a second support never exceeds the board's budget.
        // Resist relative speed within that budget. Position feedback fought contact resolution
        // under later loads; zero feedback neither pulls back a pose nor levels the board.
        joint.maxForce = spec.maxForce / 2; joint.maxTorque = spec.maxTorque / 2;
        joint.correctionFactor = 0; joint.collideConnected = true; joint.apply();
        return { plank, support, joint, offset, angle };
    }

    private stabilizerError(bond: StabilizerBond): { distance: number; angle: number } {
        const offset = bond.support.body.getLocalPoint(bond.plank.body.getWorldPoint(new Vec2(), new Vec2()), new Vec2());
        const relative = planarAngle(bond.plank.node.rotation) - planarAngle(bond.support.node.rotation);
        return { distance: Vec2.distance(offset, bond.offset), angle: Math.abs(wrapAngle(relative - bond.angle)) };
    }

    stabilizerSnapshot(): { active: object[]; brokenPairs: string[] } {
        return { active: Array.from(this.stabilizerBonds.values()).map(bond => ({
            plankId: bond.plank.id, supportId: bond.support.id, ...this.stabilizerError(bond),
            maxForce: bond.joint.maxForce, maxTorque: bond.joint.maxTorque,
        })), brokenPairs: Array.from(this.brokenStabilizers) };
    }

    private attach(contact: AdhesionContact & { contact: IPhysics2DContact }): AdhesionBond {
        const { ball, other, side } = contact;
        const base = side < 0 ? other.body! : ball.body;
        const attached = side < 0 ? ball.body : other.body!;
        const offset = contactOffset(base, attached, side < 0 ? other : ball.collider, contact.contact);
        const joint = base.node.addComponent(RelativeJoint2D);
        joint.connectedBody = attached; joint.autoCalcOffset = false;
        // Cocos auto offsets use world deltas. Explicit local offsets preserve rotated supports.
        joint.linearOffset = offset;
        joint.angularOffset = relativeBodyAngle(base, attached);
        joint.maxForce = ball.spec.adhesion!.maxForce; joint.maxTorque = ball.spec.adhesion!.maxTorque;
        // Finite resistance to relative motion, without positional feedback oscillation.
        joint.correctionFactor = 0; joint.collideConnected = true; joint.apply();
        return { ball, other, side, base, attached, offset, joint };
    }

    private bondIntact(bond: AdhesionBond): boolean {
        if (!isValid(bond.other, true) || !isValid(bond.ball.collider, true)) return false;
        if (!bond.other.enabledInHierarchy || !bond.ball.collider.enabledInHierarchy) return false;
        const offset = bond.base.getLocalPoint(bond.attached.getWorldPoint(new Vec2(), new Vec2()), new Vec2());
        return Vec2.distance(offset, bond.offset) <= bond.ball.spec.width * .12;
    }

    private removeBond(bond: { joint: RelativeJoint2D }): void {
        if (!isValid(bond.joint, true)) return;
        // Disable while bodies still exist so Box2D removes the native joint before body teardown.
        bond.joint.enabled = false; bond.joint.destroy();
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

    bounds(record: TowerBody): { left: number; right: number; bottom: number; top: number } {
        const bounds = localBounds(record.spec, planarAngle(record.node.rotation)), p = record.node.position;
        return { left: p.x + bounds.left, right: p.x + bounds.right, bottom: p.y + bounds.bottom, top: p.y + bounds.top };
    }

    confirmedTop(): number {
        return Math.max(0, ...this.bodies.filter(r => r.placed && !r.lost).map(r => this.bounds(r).top));
    }

    dispose(): void {
        director.off(Director.EVENT_BEFORE_PHYSICS, this.beforePhysics, this);
        director.off(Director.EVENT_AFTER_PHYSICS, this.afterPhysics, this);
        this.supportContacts.clear(); this.supportReturns.clear(); this.losing.clear();
        this.pendingAdhesion.clear();
        for (const bond of this.bonds.values()) this.removeBond(bond);
        this.bonds.clear();
        this.pendingStabilizers.clear();
        for (const bond of this.stabilizerBonds.values()) this.removeBond(bond);
        this.stabilizerBonds.clear(); this.brokenStabilizers.clear(); this.cushionedBodies.clear();
        if (isValid(this.root, true)) this.root.destroy();
    }
}
