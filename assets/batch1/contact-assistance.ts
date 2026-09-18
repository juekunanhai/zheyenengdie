import { Collider2D, ERigidBody2DType, IPhysics2DContact, isValid, RelativeJoint2D, RigidBody2D, Vec2 } from 'cc';
import { ObjectSpec, planarAngle } from './object-data';
import type { TowerBody } from './tower-world';

// Creator 3.8.8 point-velocity uses world units; linearVelocity uses Box2D metres.
const COCOS_PTM_RATIO = 32;

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

interface SavedMotor {
    offset: { x: number; y: number };
    angle: number;
    maxForce: number;
    maxTorque: number;
    correctionFactor: number;
    collideConnected: boolean;
}
export interface ContactAssistanceState {
    adhesion: (SavedMotor & { ballId: number; otherId: number; side: number })[];
    stabilizers: (SavedMotor & { plankId: number; supportId: number })[];
    cushionedIds: number[];
    brokenPairs: string[];
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

/** Finite contact cushioning and local bonds; never supplies a new world support. */
export class ContactAssistance {
    private readonly pendingAdhesion = new Map<string, AdhesionContact & { contact: IPhysics2DContact }>();
    private readonly bonds = new Map<string, AdhesionBond>();
    private readonly cushionedBodies = new Set<number>();
    private readonly pendingStabilizers = new Map<string, StabilizerContact>();
    private readonly stabilizerBonds = new Map<string, StabilizerBond>();
    // A torn connection cannot continually reconnect and consume more fall energy.
    private readonly brokenStabilizers = new Set<string>();

    constructor(private readonly bodies: readonly TowerBody[]) {}

    exportState(platform: Collider2D): ContactAssistanceState {
        if (this.pendingAdhesion.size || this.pendingStabilizers.size)
            throw new Error('Cannot save contact assistance during a physics step');
        const live = new Map(this.bodies.filter(body => !body.lost).map(body => [body.id, body] as const));
        const idOf = (collider: Collider2D): number => collider === platform ? 0
            : this.bodies.find(body => !body.lost && body.collider === collider)?.id ?? -1;
        const motor = (joint: RelativeJoint2D, offset: Vec2): SavedMotor => ({
            offset: { x: offset.x, y: offset.y }, angle: joint.angularOffset,
            maxForce: joint.maxForce, maxTorque: joint.maxTorque,
            correctionFactor: joint.correctionFactor, collideConnected: joint.collideConnected,
        });
        return {
            adhesion: Array.from(this.bonds.values()).filter(bond => this.bondIntact(bond) && idOf(bond.other) >= 0)
                .map(bond => ({ ballId: bond.ball.id, otherId: idOf(bond.other), side: bond.side,
                    ...motor(bond.joint, bond.offset) })),
            stabilizers: Array.from(this.stabilizerBonds.values()).filter(bond => live.has(bond.plank.id) && live.has(bond.support.id))
                .map(bond => ({ plankId: bond.plank.id, supportId: bond.support.id, ...motor(bond.joint, bond.offset) })),
            cushionedIds: Array.from(this.cushionedBodies).filter(id => live.has(id)),
            brokenPairs: Array.from(this.brokenStabilizers).filter(key => key.split(':').every(id => live.has(Number(id)))),
        };
    }

    static validateState(state: ContactAssistanceState, specs: ReadonlyMap<number, ObjectSpec>): void {
        const fail = (): never => { throw new Error('Invalid contact assistance checkpoint'); };
        if (!state || !Array.isArray(state.adhesion) || !Array.isArray(state.stabilizers)
            || !Array.isArray(state.cushionedIds) || !Array.isArray(state.brokenPairs)) fail();
        const motor = (saved: SavedMotor): boolean => !!saved && !!saved.offset
            && [saved.offset.x, saved.offset.y, saved.angle, saved.maxForce, saved.maxTorque, saved.correctionFactor].every(Number.isFinite)
            && saved.maxForce >= 0 && saved.maxTorque >= 0 && saved.correctionFactor >= 0 && saved.correctionFactor <= 1
            && typeof saved.collideConnected === 'boolean';
        const keys = new Set<string>(), counts = new Map<number, number>();
        for (const saved of state.adhesion) {
            const key = `${saved?.ballId}:${saved?.side}`;
            if (!motor(saved) || !specs.get(saved.ballId)?.adhesion || (saved.otherId !== 0 && !specs.has(saved.otherId))
                || saved.ballId === saved.otherId || (saved.side !== -1 && saved.side !== 1) || keys.has(key)) fail();
            keys.add(key);
        }
        keys.clear();
        for (const saved of state.stabilizers) {
            const key = `${saved?.plankId}:${saved?.supportId}`;
            const count = (counts.get(saved?.plankId) ?? 0) + 1;
            if (!motor(saved) || !specs.get(saved.plankId)?.stabilizer || !specs.has(saved.supportId)
                || saved.supportId >= saved.plankId || keys.has(key) || count > 2) fail();
            keys.add(key); counts.set(saved.plankId, count);
        }
        const broken = new Set<string>();
        for (const key of state.brokenPairs) {
            if (typeof key !== 'string' || !/^[1-9]\d*:[1-9]\d*$/.test(key) || keys.has(key) || broken.has(key)) fail();
            const [plank, support] = key.split(':').map(Number);
            if (!specs.get(plank)?.stabilizer || !specs.has(support) || support >= plank) fail();
            broken.add(key);
        }
        if (new Set(state.cushionedIds).size !== state.cushionedIds.length
            || state.cushionedIds.some(id => !specs.has(id))) fail();
    }

    /** The caller validates the entire world before replacing any live object. */
    restoreState(state: ContactAssistanceState, platform: Collider2D): void {
        this.dispose();
        const byId = new Map(this.bodies.map(body => [body.id, body] as const));
        const attach = (base: RigidBody2D, attached: RigidBody2D, saved: SavedMotor): RelativeJoint2D => {
            const joint = base.node.addComponent(RelativeJoint2D);
            joint.connectedBody = attached; joint.autoCalcOffset = false;
            joint.linearOffset = new Vec2(saved.offset.x, saved.offset.y); joint.angularOffset = saved.angle;
            joint.maxForce = saved.maxForce; joint.maxTorque = saved.maxTorque;
            joint.correctionFactor = saved.correctionFactor; joint.collideConnected = saved.collideConnected; joint.apply();
            return joint;
        };
        for (const saved of state.adhesion) {
            const ball = byId.get(saved.ballId)!, other = saved.otherId === 0 ? platform : byId.get(saved.otherId)!.collider;
            const base = saved.side < 0 ? other.body! : ball.body;
            const attached = saved.side < 0 ? ball.body : other.body!;
            this.bonds.set(`${saved.ballId}:${saved.side}`, { ball, other, side: saved.side, base, attached,
                offset: new Vec2(saved.offset.x, saved.offset.y), joint: attach(base, attached, saved) });
        }
        for (const saved of state.stabilizers) {
            const plank = byId.get(saved.plankId)!, support = byId.get(saved.supportId)!;
            this.stabilizerBonds.set(`${saved.plankId}:${saved.supportId}`, { plank, support,
                offset: new Vec2(saved.offset.x, saved.offset.y), angle: saved.angle,
                joint: attach(support.body, plank.body, saved) });
        }
        for (const id of state.cushionedIds) this.cushionedBodies.add(id);
        for (const key of state.brokenPairs) this.brokenStabilizers.add(key);
    }

    preSolve(record: TowerBody, other: Collider2D, contact: IPhysics2DContact, spec: ObjectSpec): void {
        this.prepareCushion(record, other, contact);
        if (spec.adhesion) this.prepareAdhesion(record, other, contact);
        if (spec.stabilizer) this.prepareStabilizer(record, other, contact);
    }

    endContact(record: TowerBody, contact: IPhysics2DContact): void {
        // A side graze on the same object must not keep an ended support contact eligible
        // for glue. Cocos recycles the contact object immediately after this END callback.
        for (const [key, pending] of this.pendingAdhesion) {
            if (pending.ball === record && pending.contact === contact) this.pendingAdhesion.delete(key);
        }
        for (const [key, pending] of this.pendingStabilizers) {
            if (pending.plank === record && pending.contact === contact) this.pendingStabilizers.delete(key);
        }
    }

    supportPairs(): [Collider2D, Collider2D][] {
        const pairs: [Collider2D, Collider2D][] = [];
        for (const bond of this.bonds.values()) {
            if (this.bondIntact(bond)) pairs.push([bond.ball.collider, bond.other]);
        }
        for (const bond of this.stabilizerBonds.values()) {
            const error = this.stabilizerError(bond);
            if (error.distance <= Math.max(8, bond.plank.spec.height * .5) &&
                error.angle <= bond.plank.spec.stabilizer!.maxAngleError) pairs.push([bond.plank.collider, bond.support.collider]);
        }
        return pairs;
    }

    disableFor(record: TowerBody): void {
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

    afterPhysics(): void {
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

    dispose(): void {
        this.pendingAdhesion.clear();
        for (const bond of this.bonds.values()) this.removeBond(bond);
        this.bonds.clear();
        this.pendingStabilizers.clear();
        for (const bond of this.stabilizerBonds.values()) this.removeBond(bond);
        this.stabilizerBonds.clear(); this.brokenStabilizers.clear(); this.cushionedBodies.clear();
    }
}
