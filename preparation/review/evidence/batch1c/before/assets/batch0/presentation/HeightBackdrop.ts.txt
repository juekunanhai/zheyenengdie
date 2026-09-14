import { _decorator, Component, game, Game, Node, Rect, Size, Sprite, SpriteFrame, UIOpacity, UITransform, Vec2 } from 'cc';

const { ccclass, property } = _decorator;

/** Visual tuning only. Input is camera/view height above the ground, never score. */
export const BACKDROP_TRANSITIONS = [[3, 12], [40, 70], [130, 190]] as const;

export function backdropOpacity(height: number, start: number, end: number): number {
    const t = Math.min(1, Math.max(0, (height - start) / (end - start)));
    return t * t * (3 - 2 * t);
}

/** Batch 0 presentation component; no input, physics, score or tower state. */
@ccclass('HeightBackdrop')
export class HeightBackdrop extends Component {
    @property(SpriteFrame) cloudFrame: SpriteFrame | null = null;
    @property(SpriteFrame) groundForegroundFrame: SpriteFrame | null = null;
    private targetHeight = 0;
    private shownHeight = 0;
    private layers: Node[] = [];
    private skyEdges: Node[] = [];
    private edgeFrames: SpriteFrame[] = [];
    private pixelsPerMetre = 175;
    private worldZoom = 1;
    private lastWidth = 0;
    private lastHeight = 0;
    private clouds: Node[] = [];
    private groundForeground: Node | null = null;
    private elapsed = 0;
    private hidden = false;
    private readonly hide = () => { this.hidden = true; };
    private readonly show = () => { this.hidden = false; };

    onLoad(): void {
        this.layers = ['bg_ground_city', 'bg_city_altitude', 'bg_cloud_altitude', 'bg_space_altitude']
            .map(name => this.node.getChildByName(name)!);
        // One distant skyline avoids double buildings while the ground moves with the tower.
        if (this.groundForegroundFrame) this.layers[0].getComponent(Sprite)!.spriteFrame = this.layers[1].getComponent(Sprite)!.spriteFrame;
        this.skyEdges = this.layers.map(layer => this.createSkyEdge(layer));
        this.createGroundForeground();
        this.createClouds();
        this.fit();
        this.paint();
    }

    /** Call from the camera presenter in Batch 1; QA supplies an explicit sample now. */
    setViewHeight(heightM: number, immediate = false, pixelsPerMetre = 175, worldZoom = 1): void {
        this.pixelsPerMetre = pixelsPerMetre;
        this.worldZoom = worldZoom;
        this.targetHeight = Number.isFinite(heightM) ? Math.max(0, heightM) : 0;
        if (immediate) { this.shownHeight = this.targetHeight; this.paint(); }
    }

    getViewHeight(): number { return this.shownHeight; }

    /** The new environment art reserves a clear sky edge, without clouds to stretch. */
    private createSkyEdge(layer: Node): Node {
        const source = layer.getComponent(Sprite)!.spriteFrame!;
        const frame = source.clone();
        const stripHeight = Math.min(24, source.rect.height);
        frame.rect = new Rect(source.rect.x, source.rect.y, source.rect.width, stripHeight);
        frame.originalSize = new Size(source.rect.width, stripHeight);
        frame.offset = new Vec2();
        frame.flipUVY = true; frame.packable = false;
        this.edgeFrames.push(frame);
        const edge = new Node(`${layer.name}:sky`);
        edge.layer = layer.layer; this.node.addChild(edge);
        edge.setSiblingIndex(layer.getSiblingIndex() + 1);
        edge.addComponent(UITransform);
        const sprite = edge.addComponent(Sprite);
        sprite.spriteFrame = frame; sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.trim = false;
        edge.addComponent(UIOpacity);
        return edge;
    }

    onEnable(): void { game.on(Game.EVENT_HIDE, this.hide); game.on(Game.EVENT_SHOW, this.show); }
    onDisable(): void { game.off(Game.EVENT_HIDE, this.hide); game.off(Game.EVENT_SHOW, this.show); }
    onDestroy(): void { for (const frame of this.edgeFrames) frame.destroy(); }

    private createGroundForeground(): void {
        if (!this.groundForegroundFrame) return;
        const ground = this.groundForeground = new Node('GroundForeground');
        ground.layer = this.node.layer;
        this.node.addChild(ground);
        ground.setSiblingIndex(this.node.getChildByName('SafeArea')!.getSiblingIndex());
        ground.addComponent(UITransform);
        const sprite = ground.addComponent(Sprite);
        sprite.spriteFrame = this.groundForegroundFrame;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.trim = false;
        ground.addComponent(UIOpacity);
    }

    private createClouds(): void {
        if (!this.cloudFrame) return;
        for (let i = 0; i < 3; i++) {
            const cloud = new Node(`BackdropCloud${i}`);
            cloud.layer = this.node.layer;
            this.node.addChild(cloud);
            cloud.setSiblingIndex(this.node.getChildByName('SafeArea')!.getSiblingIndex());
            cloud.addComponent(UITransform);
            const sprite = cloud.addComponent(Sprite);
            sprite.spriteFrame = this.cloudFrame;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.trim = false;
            cloud.addComponent(UIOpacity);
            this.clouds.push(cloud);
        }
    }

    update(dt: number): void {
        this.fit();
        if (!this.hidden) this.elapsed += Math.min(dt, .05);
        this.paintClouds();
        if (Math.abs(this.shownHeight - this.targetHeight) < .001) return;
        this.shownHeight += (this.targetHeight - this.shownHeight) * (1 - Math.exp(-6 * dt));
        if (Math.abs(this.shownHeight - this.targetHeight) < .001) this.shownHeight = this.targetHeight;
        this.paint();
    }

    private paintClouds(): void {
        if (!this.cloudFrame) return;
        const size = this.node.getComponent(UITransform)!.contentSize;
        const ratio = this.cloudFrame.originalSize.height / this.cloudFrame.originalSize.width;
        const fade = 1 - .65 * backdropOpacity(this.shownHeight, 130, 190);
        const positions = [[-.45, .13, .43, 29, .4], [.47, .02, .34, 37, 2.1], [-.43, -.16, .26, 43, 4.2]];
        this.clouds.forEach((cloud, i) => {
            const [x, y, width, period, phase] = positions[i];
            const t = this.elapsed * Math.PI * 2 / period + phase;
            const drift = Math.sin(t) * size.width * .055;
            const lift = Math.cos(t * .7) * 5;
            cloud.getComponent(UITransform)!.setContentSize(size.width * width, size.width * width * ratio);
            cloud.setPosition(size.width * x + drift, size.height * y + lift, 0);
            cloud.getComponent(UIOpacity)!.opacity = (i === 0 ? 170 : 135) * fade;
        });
    }

    private fit(): void {
        const size = this.node.getComponent(UITransform)!.contentSize;
        if (size.width === this.lastWidth && size.height === this.lastHeight) return;
        this.lastWidth = size.width; this.lastHeight = size.height;
        const safe = this.node.getChildByName('SafeArea');
        const content = safe?.getChildByName('Content_1230');
        if (content) {
            const safeHeight = safe!.getComponent(UITransform)!.height;
            const scale = Math.min(1, safeHeight / 1230);
            content.setScale(scale, scale, 1);
        }
        const world = safe?.getChildByName('World_1x');
        if (world) {
            const safeHeight = safe!.getComponent(UITransform)!.height;
            // Keep a fixed world composition; fit short screens without moving HUD.
            // Anchor the fit at ground contact rather than the middle of the screen.
            const scale = Math.min(1, Math.max(.6, (safeHeight - 240) / 1094));
            world.setScale(scale, scale, 1);
            world.setPosition(0, -safeHeight / 2 + 196 - scale * (-667 + 196), 0);
            // Short claw enters at the safe-area top, independent of ground fitting.
            world.getChildByName('Rig')?.setPosition(0, (safeHeight / 2 - world.position.y) / scale - 667, 0);
        }
        for (const layer of this.layers) {
            const frame = layer.getComponent(Sprite)!.spriteFrame!;
            const ratio = frame.originalSize.width / frame.originalSize.height;
            const height = Math.max(size.height, size.width / ratio);
            layer.getComponent(UITransform)!.setContentSize(height * ratio, height);
            // Bottom alignment retains the ground contact surface on short screens.
            layer.setPosition(0, (height - size.height) / 2, 0);
        }
        this.paint();
    }

    private paint(): void {
        const alphas = [1, ...BACKDROP_TRANSITIONS.map(([start, end]) =>
            backdropOpacity(this.shownHeight, start, end))];
        let base = 0;
        alphas.forEach((alpha, i) => { if (alpha === 1) base = i; });
        this.layers.forEach((layer, i) => {
            // Non-overlapping transitions need at most two full-screen draw layers.
            layer.active = i === base || (i > base && alphas[i] > 0);
            layer.getComponent(UIOpacity)!.opacity = Math.round(alphas[i] * 255);
            // Near ground shares the tower's displacement. Distant scenery moves more slowly.
            const start = [0, 0, 40, 130][i], parallax = [this.groundForeground ? .16 : 1, .16, .025, .008][i];
            const travel = Math.max(0, this.shownHeight - start) * this.pixelsPerMetre * parallax;
            const size = layer.getComponent(UITransform)!;
            layer.setPosition(0, (size.height - this.lastHeight) / 2 - travel, 0);
            const gap = Math.max(0, this.lastHeight - size.height + travel);
            const edge = this.skyEdges[i];
            edge.active = layer.active && gap > 0;
            edge.getComponent(UIOpacity)!.opacity = Math.round(alphas[i] * 255);
            const visibleGap = Math.min(this.lastHeight, gap);
            edge.getComponent(UITransform)!.setContentSize(size.width, visibleGap + 1);
            edge.setPosition(0, this.lastHeight / 2 - visibleGap / 2, 0);
        });
        if (this.groundForeground) {
            const ground = this.groundForeground;
            const size = this.layers[0].getComponent(UITransform)!;
            ground.getComponent(UITransform)!.setContentSize(size.contentSize);
            ground.setScale(this.worldZoom, this.worldZoom, 1);
            ground.setPosition(0, ((size.height - this.lastHeight) / 2 - this.shownHeight * this.pixelsPerMetre) * this.worldZoom, 0);
            ground.getComponent(UIOpacity)!.opacity = Math.round((1 - alphas[1]) * 255);
            ground.active = alphas[1] < 1;
        }
        this.paintClouds();
    }
}
