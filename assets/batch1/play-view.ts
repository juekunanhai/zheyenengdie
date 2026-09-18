import { Color, isValid, Label, Layers, Node, Sprite, SpriteFrame, UITransform, Vec2, Vec3, Widget } from 'cc';
import { HeightBackdrop } from '../batch0/presentation/HeightBackdrop';
import { localBounds, ObjectKind, OBJECTS, planarAngle, PLATFORM_WIDTH, UNITS_PER_METRE } from './object-data';
import { LandingContact, TowerBody } from './tower-world';
import { LandingFeedback } from './landing-feedback';
import { WorldBoundary } from './incident-state';
import { PlayFeedback } from './play-feedback';
import type { TowerRisk } from './tower-director';
import type { HighlightKind } from './run-highlights';

/** Ordinary camera state only. Viewport metrics and transient incident effects are rebuilt. */
export interface PlayViewState {
    readonly cameraY: number;
    readonly targetCameraY: number;
    readonly heldTop: number;
}

/** R6 artwork, with screen-space views of independent unscaled physics bodies. */
export class PlayView {
    readonly safe: Node;
    readonly input: Node;
    readonly rotate: Node;
    readonly pause: Node;
    readonly root: Node;
    private readonly platform: Node;
    private readonly claw: Node;
    private readonly cable: Node;
    private readonly hint: Label;
    private readonly height: Label;
    private readonly next: Sprite;
    private readonly views = new Map<number, Node>();
    private readonly landing: LandingFeedback;
    private readonly feedback: PlayFeedback;
    private scale = 1.75;
    private fitScale = 1;
    private originY = 0;
    private cameraY = 0;
    private targetCameraY = 0;
    private width = 0;
    private heightPixels = 0;
    private heldTop = 0;
    private zoom = 1;
    private zoomFrom = 1;
    private zoomTarget = 1;
    private zoomTime = 0;
    private zoomDuration = .35;
    private incidentCamera = false;
    private readonly backdrop: HeightBackdrop;

    constructor(private readonly canvas: Node, private readonly frames: Map<string, SpriteFrame>) {
        this.safe = canvas.getChildByName('SafeArea')!;
        this.safe.getChildByName('World_1x')!.active = false;
        this.root = this.makeNode('PlayWorld', this.safe);
        this.root.setSiblingIndex(0);
        this.landing = new LandingFeedback(this.root, frames);
        this.input = this.makeNode('PlayInput', this.safe);
        this.input.setSiblingIndex(1);
        this.platform = this.image('platform_city_base', this.root);
        this.cable = this.image('claw_cable_straight', this.root);
        this.claw = this.image('claw_open_narrow', this.root);
        this.rotate = this.safe.getChildByName('hud_rotate_90')!;
        this.pause = this.safe.getChildByName('hud_pause')!;
        this.height = this.safe.getChildByName('Text:0.0')!.getComponent(Label)!;
        this.next = this.safe.getChildByName('next_basketball')!.getComponent(Sprite)!;
        this.next.node.getComponent(Widget)!.enabled = false;
        const hintNode = this.makeNode('PlanningHint', this.safe);
        hintNode.getComponent(UITransform)!.setContentSize(440, 55);
        this.hint = hintNode.addComponent(Label);
        this.hint.string = '';
        this.hint.fontSize = 25; this.hint.lineHeight = 32;
        this.hint.color = Color.WHITE; this.hint.isBold = true;
        this.hint.enableOutline = true; this.hint.outlineWidth = 3;
        this.hint.outlineColor = new Color(23, 73, 144);
        this.feedback = new PlayFeedback(this.safe, this.root, frames);
        this.backdrop = canvas.getComponent(HeightBackdrop)!;
        this.fit();
    }

    private makeNode(name: string, parent: Node): Node {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        parent.addChild(node); node.addComponent(UITransform);
        return node;
    }
    private image(name: string, parent: Node): Node {
        const node = this.makeNode(name, parent);
        const sprite = node.addComponent(Sprite);
        sprite.spriteFrame = this.frames.get(name)!;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.trim = false;
        return node;
    }

    fit(): boolean {
        const size = this.safe.getComponent(UITransform)!.contentSize;
        if (size.width === this.width && size.height === this.heightPixels) return false;
        this.width = size.width; this.heightPixels = size.height;
        this.fitScale = Math.min(1, Math.max(.6, (size.height - 240) / 1094));
        this.scale = 1.75 * this.fitScale;
        // Contact plane passes through the wooden top, not its decorative back rim.
        this.originY = -size.height / 2 + 196 + 132 * this.fitScale;
        this.input.getComponent(UITransform)!.setContentSize(size.width, size.height);
        this.root.getComponent(UITransform)!.setContentSize(size.width, size.height);
        this.hint.node.setPosition(0, size.height / 2 - 370 * this.fitScale, 0);
        this.feedback.fit(size.width, size.height, size.height / 2 - 430 * this.fitScale);
        this.next.node.setPosition(297, size.height / 2 - 268, 0);
        for (const child of this.safe.children) child.getComponent(Widget)?.updateAlignment();
        return true;
    }

    beginPlacement(towerTop = 0, maxObjectHeight = 0): { top: number; left: number; right: number; bottom: number } {
        this.fit();
        const localHeldTop = (this.heightPixels / 2 - 156.5 * this.fitScale - this.originY) / this.scale;
        if (towerTop > 0) {
            this.follow(towerTop);
            // Reserve space even when prior pieces are still gently moving and not scored.
            // Use the next piece's largest quarter-turn height so rotating cannot overlap the tower.
            this.targetCameraY = Math.max(this.targetCameraY, towerTop + maxObjectHeight + 24 - localHeldTop);
        }
        // Matches the approved cardboard position; rotation preserves this attachment height.
        this.heldTop = this.targetCameraY + localHeldTop;
        return { top: this.heldTop, left: -this.width / (2 * this.scale),
            right: this.width / (2 * this.scale), bottom: this.targetCameraY + (-this.heightPixels / 2 - this.originY) / this.scale };
    }

    pointerX(point: Vec2): number {
        const local = this.safe.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(point.x, point.y, 0));
        return local.x / this.scale;
    }

    /** Normal full viewport, separate from the claw attachment and presentation zoom. */
    logicalBounds(): WorldBoundary {
        return { top: this.targetCameraY + (this.heightPixels / 2 - this.originY) / this.scale,
            bottom: this.targetCameraY + (-this.heightPixels / 2 - this.originY) / this.scale,
            left: -this.width / (2 * this.scale), right: this.width / (2 * this.scale) };
    }

    beginIncident(zoom: number): void {
        this.incidentCamera = true;
        this.zoomFrom = this.zoom; this.zoomTarget = zoom; this.zoomTime = 0; this.zoomDuration = .35;
    }
    endIncident(): void {
        this.incidentCamera = false;
        this.zoomFrom = this.zoom; this.zoomTarget = 1; this.zoomTime = 0; this.zoomDuration = .45;
    }
    holdIncident(): void {
        // A renewed fall during recovery belongs to the same chain; stop the lens in place.
        this.incidentCamera = true;
        this.zoomFrom = this.zoomTarget = this.zoom; this.zoomTime = this.zoomDuration;
    }
    cameraRecovered(): boolean { return !this.incidentCamera && this.zoom === 1; }
    setStars(count: number): void {
        this.safe.children.filter(node => node.name === 'hud_star_full').forEach((node, index) => {
            node.getComponent(Sprite)!.spriteFrame = this.frames.get(index < count ? 'hud_star_full' : 'hud_star_empty')!;
        });
    }

    setNext(kind: ObjectKind): void {
        const frame = this.frames.get(`next_${kind}`)!;
        this.next.spriteFrame = frame;
        this.next.sizeMode = Sprite.SizeMode.CUSTOM;
        // A shared world-to-preview scale preserves relative object sizes.
        // The image remains proportional; transparent padding is handled by the asset export.
        const size = frame.originalSize, spec = OBJECTS[kind];
        const previewScale = 62 / Math.max(...(Object.keys(OBJECTS) as ObjectKind[]).map(key => Math.max(OBJECTS[key].width, OBJECTS[key].height)));
        const ratio = Math.max(spec.width, spec.height) * previewScale / Math.max(size.width, size.height);
        this.next.node.getComponent(UITransform)!.setContentSize(size.width * ratio, size.height * ratio);
    }
    setHint(text: string): void { this.hint.string = text; }
    setRisk(risk: TowerRisk, active = true): void { this.feedback.setRisk(risk, active); }
    showHighlight(kind: HighlightKind, worldPoint?: { x: number; y: number }): boolean {
        return this.feedback.showHighlight(kind, worldPoint);
    }
    clearFeedback(): void { this.feedback.clear(); }
    land(contact: LandingContact): void { this.landing.land(contact); }
    exportState(): PlayViewState {
        return { cameraY: this.cameraY, targetCameraY: this.targetCameraY, heldTop: this.heldTop };
    }
    restoreState(state: PlayViewState): void {
        // Validate before destroying any view so a bad checkpoint cannot partly restore.
        if (!state || ![state.cameraY, state.targetCameraY, state.heldTop].every(Number.isFinite)
            || state.cameraY < 0 || state.targetCameraY < state.cameraY)
            throw new RangeError('Invalid ordinary camera state');
        for (const node of this.views.values()) {
            if (!isValid(node, true)) continue;
            node.active = false; node.destroy();
        }
        this.views.clear();
        this.landing.clear();
        this.feedback.clear();
        this.hint.string = '';
        this.cameraY = state.cameraY; this.targetCameraY = state.targetCameraY; this.heldTop = state.heldTop;
        this.incidentCamera = false;
        this.zoom = this.zoomFrom = this.zoomTarget = 1;
        this.zoomTime = 0; this.zoomDuration = .35;
        // Always derive dimensions from the live SafeArea. The controller compares normal
        // boundaries and refits a restored held body only when the viewport actually changed.
        this.width = this.heightPixels = -1;
        this.fit();
        // Clear the previous camera/zoom immediately. Restored body views are recreated by
        // the next controller draw, even when their numeric IDs match destroyed bodies.
        this.update(0, [], null, 1);
    }
    getViewHeight(): number { return this.cameraY / UNITS_PER_METRE; }
    setHeight(value: number): void { this.height.string = (value / UNITS_PER_METRE).toFixed(1); }
    follow(top: number): void {
        const threshold = (this.heightPixels * .05 - this.originY) / this.scale;
        this.targetCameraY = Math.max(this.targetCameraY, top - threshold);
    }

    update(dt: number, records: readonly TowerBody[], held: TowerBody | null, retract: number, entering = false): void {
        this.fit();
        this.cameraY += (this.targetCameraY - this.cameraY) * (1 - Math.exp(-7 * dt));
        this.zoomTime = Math.min(this.zoomDuration, this.zoomTime + dt);
        const t = this.zoomTime / this.zoomDuration;
        const eased = t * t * (3 - 2 * t);
        // Interpolate viewing distance: scenery at different depths shares one dolly move.
        const distance = 1 / this.zoomFrom + (1 / this.zoomTarget - 1 / this.zoomFrom) * eased;
        this.zoom = t === 1 ? this.zoomTarget : 1 / distance;
        // Keep the optical centre at SafeArea origin, matching the frozen incident observation.
        // Physics coordinates, the normal logical boundary and HUD remain unchanged.
        this.root.setScale(this.zoom, this.zoom, 1);
        const focus = this.canvas.getComponent(UITransform)!.convertToNodeSpaceAR(this.safe.worldPosition);
        // cameraY is already smoothed: scenery must use this same value in the same frame.
        this.backdrop.setViewHeight(this.cameraY / UNITS_PER_METRE, true, UNITS_PER_METRE * this.scale, this.zoom, focus);
        const platformFrame = this.frames.get('platform_city_base')!.originalSize;
        const width = PLATFORM_WIDTH * this.scale, h = width * platformFrame.height / platformFrame.width;
        this.platform.getComponent(UITransform)!.setContentSize(width, h);
        // Adopted PNG: the wooden face center is row 82. Pixels only align the artwork;
        // PLATFORM_WIDTH and the physical support plane remain in world units.
        this.platform.setPosition(0, this.screenY(0) - h / 2 + width * 82 / platformFrame.width, 0);
        this.landing.update(dt, this.scale, y => this.screenY(y));
        for (const record of records) this.paintBody(record);
        this.feedback.update(dt, this.scale, y => this.screenY(y));
        this.paintClaw(held, retract, entering);
    }

    private screenY(y: number): number { return this.originY + (y - this.cameraY) * this.scale; }
    private paintBody(record: TowerBody): void {
        let node = this.views.get(record.id);
        if (!node) {
            node = this.image(`object_${record.spec.kind}`, this.root);
            this.views.set(record.id, node);
        }
        node.active = !record.lost && record.node.active;
        if (!node.active) return;
        const p = record.node.position;
        const [offsetX, offsetY] = record.spec.spriteOffset ?? [0, 0];
        const deform = this.landing.deformation(record);
        // Scale only the sprite about the real contact, so the bearing point never lifts.
        const visualX = deform.anchorX + (offsetX - deform.anchorX) * deform.x;
        const visualY = deform.anchorY + (offsetY - deform.anchorY) * deform.y;
        const a = planarAngle(record.node.rotation) * Math.PI / 180;
        const x = p.x + visualX * Math.cos(a) - visualY * Math.sin(a);
        const y = p.y + visualX * Math.sin(a) + visualY * Math.cos(a);
        node.setPosition(x * this.scale, this.screenY(y), 0);
        node.setScale(deform.x, deform.y, 1);
        // Copy the planar quaternion; Euler readback at 180 degrees can choose a different branch.
        node.setRotation(record.node.rotation);
        node.getComponent(UITransform)!.setContentSize(record.spec.spriteWidth * this.scale, record.spec.spriteHeight * this.scale);
    }
    private paintClaw(held: TowerBody | null, retract: number, entering: boolean): void {
        this.claw.active = this.cable.active = held !== null || retract < 1;
        if (!this.claw.active) return;
        const name = held ? (entering ? 'claw_open_mid' : 'claw_open_narrow') : (retract < .35 ? 'claw_open_mid' : 'claw_open_wide');
        const frame = this.frames.get(name)!;
        this.claw.getComponent(Sprite)!.spriteFrame = frame;
        const height = 149 * this.fitScale, width = height * frame.originalSize.width / frame.originalSize.height;
        const x = held ? held.node.position.x * this.scale : this.claw.position.x;
        const attachment = held ? held.node.position.y + localBounds(held.spec, planarAngle(held.node.rotation)).top : this.heldTop;
        const top = this.screenY(attachment) + 113 * this.fitScale + (held ? 0 : retract * 220);
        this.claw.setPosition(x, top - height / 2, 0);
        this.claw.getComponent(UITransform)!.setContentSize(width, height);
        const cableHeight = Math.max(0, this.heightPixels / 2 - top + 18 * this.fitScale);
        this.cable.setPosition(x, this.heightPixels / 2 - cableHeight / 2, 0);
        this.cable.getComponent(UITransform)!.setContentSize(12 * this.fitScale, cableHeight);
        this.claw.setSiblingIndex(this.root.children.length - 1);
    }

    snapshot(): object { return { scale: this.scale, originY: this.originY, cameraY: this.cameraY, targetCameraY: this.targetCameraY,
        width: this.width, height: this.heightPixels, heldTop: this.heldTop, zoom: this.zoom,
        zoomTarget: this.zoomTarget, incidentCamera: this.incidentCamera, landing: this.landing.snapshot(),
        feedback: this.feedback.snapshot() }; }
    dispose(): void {
        this.landing.dispose();
        this.feedback.dispose();
        for (const node of [this.root, this.input, this.hint.node]) if (isValid(node, true)) node.destroy();
    }
}
