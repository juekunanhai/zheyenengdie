import { isValid, Node, Sprite, SpriteFrame, UIOpacity, UITransform } from 'cc';
import type { LandingContact, TowerBody } from './tower-world';

const REACTION_SECONDS = .32;
const REPEAT_SECONDS = .48;
const MAX_BURSTS = 4;

interface Reaction { contact: LandingContact; age: number; amount: number; compressX: boolean }
interface Burst { contact: LandingContact; age: number; strength: number; nodes: Node[] }

/** Transient presentation only. This class never writes to a rigid body or collider. */
export class LandingFeedback {
    private readonly reactions = new Map<number, Reaction>();
    private readonly bursts: Burst[] = [];
    private sinceBurst = 1;

    constructor(private readonly root: Node, private readonly frames: Map<string, SpriteFrame>) {}

    land(contact: LandingContact): void {
        const record = contact.record;
        if (record.lost || record.placed || this.reactions.has(record.id)) return;
        const strength = Math.min(1, Math.max(0, (contact.speed - .8) / 9));
        const soft = record.spec.kind === 'basketball' ? .13 :
            ['cardboard_box', 'slipper', 'burger'].indexOf(record.spec.kind) >= 0 ? .095 : .045;
        this.reactions.set(record.id, { contact, age: 0, amount: soft * (.55 + .45 * strength),
            compressX: Math.abs(contact.localNormal.x) > Math.abs(contact.localNormal.y) });
        // An incident can contain many contacts in one step. Four bursts = at most 12 sprites.
        if (this.sinceBurst < .09 || this.bursts.length >= MAX_BURSTS) return;
        this.sinceBurst = 0;
        const names = ['fx_landing_dust_r1', 'fx_landing_dust_r1'];
        if (strength > .45 && soft <= .045) names.push('fx_landing_ring_r1');
        const nodes = names.map(name => this.particle(name));
        this.bursts.push({ contact, age: 0, strength, nodes });
    }

    private particle(name: string): Node {
        const node = new Node(name);
        node.layer = this.root.layer; this.root.addChild(node);
        node.addComponent(UITransform);
        const sprite = node.addComponent(Sprite);
        sprite.spriteFrame = this.frames.get(name)!;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.trim = false;
        node.addComponent(UIOpacity);
        return node;
    }

    update(dt: number, scale: number, screenY: (y: number) => number): void {
        this.sinceBurst += dt;
        for (const [id, reaction] of this.reactions) {
            reaction.age += dt;
            if (reaction.age >= REPEAT_SECONDS || reaction.contact.record.lost) this.reactions.delete(id);
        }
        for (let i = this.bursts.length - 1; i >= 0; i--) {
            const burst = this.bursts[i];
            const invalid = !burst.contact.record.collider.enabledInHierarchy || !burst.contact.support.enabledInHierarchy;
            burst.age += dt;
            if (burst.age >= .38 || burst.contact.record.lost || invalid) {
                for (const node of burst.nodes) node.destroy();
                this.bursts.splice(i, 1); continue;
            }
            this.paintBurst(burst, scale, screenY);
        }
    }

    private paintBurst(burst: Burst, scale: number, screenY: (y: number) => number): void {
        const t = burst.age / .38, spread = 1 - (1 - t) ** 2;
        const { point, normal } = burst.contact;
        burst.nodes.forEach((node, index) => {
            const ring = index === 2, side = index === 0 ? -1 : 1;
            const along = ring ? 0 : side * (8 + (18 + 12 * burst.strength) * spread);
            const above = ring ? 1 : 4 + 12 * spread;
            node.setPosition((point.x + normal.y * along + normal.x * above) * scale,
                screenY(point.y - normal.x * along + normal.y * above), 0);
            const width = ring ? (35 + 65 * spread) : (13 + 16 * burst.strength) * (.7 + .5 * spread);
            const frame = node.getComponent(Sprite)!.spriteFrame!;
            node.getComponent(UITransform)!.setContentSize(width * scale,
                width * scale * frame.originalSize.height / frame.originalSize.width);
            node.angle = Math.atan2(normal.y, normal.x) * 180 / Math.PI - 90;
            node.getComponent(UIOpacity)!.opacity = Math.round(220 * (1 - t) ** (ring ? 2 : 1.3));
            node.setSiblingIndex(this.root.children.length - 1);
        });
    }

    deformation(record: TowerBody): { x: number; y: number; anchorX: number; anchorY: number } {
        const r = this.reactions.get(record.id);
        if (!r || r.age >= REACTION_SECONDS || record.lost || !record.contacts.has(r.contact.support) ||
            !record.collider.enabledInHierarchy || !r.contact.support.enabledInHierarchy)
            return { x: 1, y: 1, anchorX: 0, anchorY: 0 };
        // One compression and one diminishing rebound. The final taper reaches identity.
        const taper = Math.min(1, (REACTION_SECONDS - r.age) / .06);
        const squeeze = r.amount * Math.sin(r.age * Math.PI * 2 / .24) * Math.exp(-r.age * 10) * taper;
        return { x: 1 + squeeze * (r.compressX ? -1 : .55),
            y: 1 + squeeze * (r.compressX ? .55 : -1),
            anchorX: r.contact.localPoint.x, anchorY: r.contact.localPoint.y };
    }

    snapshot(): object {
        return { bursts: this.bursts.length, particles: this.bursts.reduce((sum, b) => sum + b.nodes.length, 0),
            reactions: Array.from(this.reactions.values()).map(r => ({ id: r.contact.record.id, age: r.age,
                speed: r.contact.speed, point: r.contact.point, localPoint: r.contact.localPoint,
                deformation: this.deformation(r.contact.record) })) };
    }

    clear(): void {
        for (const burst of this.bursts) for (const node of burst.nodes) if (isValid(node, true)) {
            // Node.destroy is deferred to the end of the frame; hide stale checkpoint dust now.
            node.active = false; node.destroy();
        }
        this.bursts.length = 0; this.reactions.clear();
        this.sinceBurst = 1;
    }

    dispose(): void { this.clear(); }
}
