import { Color, Graphics, isValid, Label, Node, Sprite, SpriteFrame, UIOpacity, UITransform } from 'cc';
import type { TowerRisk } from './tower-director';
import type { HighlightKind } from './run-highlights';

const HIGHLIGHT_SECONDS = .9;
const HIGHLIGHT_COOLDOWN = 1.2;
const CAPTIONS: Record<HighlightKind, string> = {
    narrow_escape: '惊险稳住', edge_balance: '极限边缘', bridge: '桥接成功', large_rescue: '大物体救场',
};

/** Screen edges and one contact accent only; no input listeners, timers or physics writes. */
export class PlayFeedback {
    private readonly edges: Node;
    private readonly edgeOpacity: UIOpacity;
    private readonly gradient: Graphics;
    private readonly accent: Node;
    private readonly ring: Node;
    private readonly caption: Label;
    private target = 0;
    private strength = 0;
    private clock = 0;
    private enabled = true;
    private age = HIGHLIGHT_SECONDS;
    private sinceHighlight = HIGHLIGHT_COOLDOWN;
    private kind: HighlightKind | null = null;
    private point: { x: number; y: number } | null = null;
    private width = 0;
    private height = 0;
    private captionTop = 0;

    constructor(safe: Node, private readonly world: Node, frames: Map<string, SpriteFrame>) {
        this.edges = this.node('DangerEdges', safe);
        // PlayWorld is first; every input target and HUD element remains above the darkening.
        this.edges.setSiblingIndex(1);
        this.gradient = this.edges.addComponent(Graphics);
        this.edgeOpacity = this.edges.addComponent(UIOpacity);
        this.edgeOpacity.opacity = 0; this.edges.active = false;
        this.accent = this.node('ContactHighlight', world);
        this.accent.addComponent(UIOpacity);
        this.accent.active = false;
        this.ring = this.node('HighlightRing', this.accent);
        const sprite = this.ring.addComponent(Sprite);
        sprite.spriteFrame = frames.get('fx_landing_ring_r1')!;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.trim = false;
        this.ring.addComponent(UIOpacity);
        const label = this.node('HighlightCaption', this.accent);
        label.getComponent(UITransform)!.setContentSize(230, 36);
        this.caption = label.addComponent(Label);
        this.caption.fontSize = 21; this.caption.lineHeight = 28;
        this.caption.isBold = true; this.caption.color = new Color(255, 245, 199);
        this.caption.enableOutline = true; this.caption.outlineWidth = 2;
        this.caption.outlineColor = new Color(23, 73, 144);
    }

    private node(name: string, parent: Node): Node {
        const node = new Node(name); node.layer = parent.layer;
        parent.addChild(node); node.addComponent(UITransform); return node;
    }

    fit(width: number, height: number, captionTop: number): void {
        this.width = width; this.height = height; this.captionTop = captionTop;
        this.edges.getComponent(UITransform)!.setContentSize(width, height);
        this.gradient.clear();
        // Non-overlapping rectangular bands: the centre stays transparent and corners never
        // add alpha twice. The darkest pixel is only 22/255 before the breathing envelope.
        const bands = 18, depth = Math.min(64, width * .09, height * .06), step = depth / bands;
        for (let i = 0; i < bands; i++) {
            const x = -width / 2 + i * step, y = -height / 2 + i * step;
            const w = width - 2 * i * step, h = height - 2 * i * step;
            this.gradient.fillColor = new Color(0, 0, 0, Math.round(22 * (1 - i / bands) ** 2));
            this.gradient.rect(x, y, w, step);
            this.gradient.rect(x, y + h - step, w, step);
            this.gradient.rect(x, y + step, step, h - 2 * step);
            this.gradient.rect(x + w - step, y + step, step, h - 2 * step);
            this.gradient.fill();
        }
    }

    setRisk(risk: TowerRisk, active = true): void {
        if (!active) { this.clear(); return; }
        this.enabled = true;
        this.target = risk === 'Critical' ? 1 : risk === 'Dangerous' ? .65 : 0;
    }

    showHighlight(kind: HighlightKind, point?: { x: number; y: number }): boolean {
        if (!this.enabled || this.sinceHighlight < HIGHLIGHT_COOLDOWN) return false;
        this.point = point && Number.isFinite(point.x) && Number.isFinite(point.y) ? { ...point } : null;
        this.kind = kind; this.age = 0; this.sinceHighlight = 0;
        this.caption.string = CAPTIONS[kind];
        this.accent.getComponent(UIOpacity)!.opacity = 0;
        this.accent.active = true;
        return true;
    }

    update(dt: number, scale: number, screenY: (y: number) => number): void {
        if (!this.enabled) return;
        this.clock = (this.clock + dt) % 3.2;
        this.strength += (this.target - this.strength) * (1 - Math.exp(-(this.target ? 5 : 9) * dt));
        if (this.target === 0 && this.strength < .003) this.strength = 0;
        const breath = .75 + .25 * Math.sin(this.clock / 3.2 * Math.PI * 2);
        this.edgeOpacity.opacity = Math.round(255 * this.strength * breath);
        this.edges.active = this.strength > 0;
        this.sinceHighlight = Math.min(HIGHLIGHT_COOLDOWN, this.sinceHighlight + dt);
        if (!this.accent.active) return;
        this.age += dt;
        if (this.age >= HIGHLIGHT_SECONDS) { this.accent.active = false; this.kind = null; return; }
        const fade = Math.min(1, this.age / .09, (HIGHLIGHT_SECONDS - this.age) / .28);
        this.accent.getComponent(UIOpacity)!.opacity = Math.round(255 * fade);
        const x = this.point ? this.point.x * scale : 0;
        const y = this.point ? screenY(this.point.y) : -this.height / 2 + 112;
        const visible = !!this.point && Math.abs(x) < this.width / 2 && Math.abs(y) < this.height / 2;
        this.ring.active = visible && this.age < .4;
        this.ring.setPosition(x, y, 0);
        const size = (42 + 36 * Math.min(1, this.age / .4)) * scale;
        const frame = this.ring.getComponent(Sprite)!.spriteFrame!;
        this.ring.getComponent(UITransform)!.setContentSize(size, size * frame.originalSize.height / frame.originalSize.width);
        this.ring.getComponent(UIOpacity)!.opacity = Math.round(230 * Math.max(0, 1 - this.age / .4));
        this.caption.node.setPosition(Math.max(-this.width / 2 + 120, Math.min(this.width / 2 - 120, visible ? x : 0)),
            Math.min(this.captionTop, Math.max(-this.height / 2 + 80, visible ? y + 34 : -this.height / 2 + 112)), 0);
        this.accent.setSiblingIndex(this.world.children.length - 1);
    }

    clear(): void {
        this.enabled = false; this.target = this.strength = this.clock = 0;
        this.edgeOpacity.opacity = 0; this.edges.active = false;
        this.age = HIGHLIGHT_SECONDS; this.sinceHighlight = HIGHLIGHT_COOLDOWN;
        this.accent.active = false; this.kind = null; this.point = null;
    }

    snapshot(): object {
        return { enabled: this.enabled, target: this.target, strength: this.strength,
            edgeOpacity: this.edgeOpacity.opacity, highlight: this.kind, highlightAge: this.age };
    }

    dispose(): void {
        this.clear();
        for (const node of [this.edges, this.accent]) if (isValid(node, true)) node.destroy();
    }
}
