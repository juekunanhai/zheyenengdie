import { _decorator, Component, game, Game, JsonAsset, Node, Sprite, SpriteFrame, Tween, tween, UIOpacity, UITransform } from 'cc';

const { ccclass, property } = _decorator;

interface HomeLayer {
    name: string;
    space?: 'hero' | 'stage';
    start: number;
    loopFrom?: number;
    rect: number[];
    frames: { time: number; frame: number }[];
}
interface HomeSequence {
    duration: number;
    layers: HomeLayer[];
    sky: { width: number; height: number; layers: { rect: number[]; opacity: number; speed: number }[] };
}

const BASE_HERO_WIDTH = 470;
const BASE_HERO_LEFT = 185;
const BASE_HERO_TOP = 1334 - 145 - BASE_HERO_WIDTH * 1507 / 1024;

/** R10.1 composition with the reviewed R2 local acting. No gameplay or camera state. */
@ccclass('HomePresentation')
export class HomePresentation extends Component {
    /** Exact frames referenced by the imported R2 sequence, in its files order. */
    @property([SpriteFrame]) characterFrames: SpriteFrame[] = [];
    @property(JsonAsset) homeSequence: JsonAsset | null = null;
    @property(SpriteFrame) cityForeground: SpriteFrame | null = null;
    private content!: Node;
    private safe!: Node;
    private backdrop!: Node;
    private clouds: Node[] = [];
    private buttons: Node[] = [];
    private sequence!: HomeSequence;
    private actors: Sprite[] = [];
    private city!: Sprite;
    private readonly rest = new Map<string, { node: Node; x: number; y: number; height: number }>();
    private readonly presses = new Map<Node, { value: number; down: boolean }>();
    private width = 0;
    private height = 0;
    private safeTop = 0;
    private safeBottom = 0;
    private elapsed = 0;
    // Existing tap-trigger offset affects ordinary actors only; elapsed is the sole clock.
    private trickAt = 0;
    private hidden = false;
    private readonly hide = () => { this.hidden = true; this.resetButtons(); };
    private readonly show = () => { this.hidden = false; };
    private readonly tapHero = () => {
        const phase = (this.elapsed - this.trickAt) % this.sequence.duration;
        // A tap may advance a waiting reach, but never restarts a reach or the sustained grip.
        if (this.enabledInHierarchy && !this.hidden && (phase < 1.7 || phase >= 3.5)) {
            this.trickAt = this.elapsed - 1.7;
            this.paintActing();
        }
    };

    onLoad(): void {
        this.safe = this.node.getChildByName('SafeArea')!;
        // Keep the existing path used by StackSceneActions.
        this.content = this.safe.getChildByName('Content_1230')!;
        this.backdrop = this.node.getChildByName('HomeBackdrop')!;
        this.sequence = this.homeSequence!.json as unknown as HomeSequence;
        this.clouds = [0, 1, 2].map(i => this.content.getChildByName(`R9Cloud${i}`)!);
        this.buttons = ['btn_start', 'btn_settings_icon'].map(name => this.content.getChildByName(name)!);
        for (const button of this.buttons) {
            this.presses.set(button, { value: 1, down: false });
            button.on(Node.EventType.TOUCH_START, () => this.press(button, .96), this);
            button.on(Node.EventType.TOUCH_END, () => this.press(button, 1), this);
            button.on(Node.EventType.TOUCH_CANCEL, () => this.press(button, 1), this);
        }
        this.content.getChildByName('R9Hero')!.on(Node.EventType.TOUCH_END, this.tapHero, this);
        this.createCharacters();
        this.createSky();
        this.fit();
    }

    onEnable(): void {
        this.elapsed = 0;
        this.trickAt = 0;
        this.hidden = false;
        game.on(Game.EVENT_HIDE, this.hide);
        game.on(Game.EVENT_SHOW, this.show);
        this.paintActing();
        this.paintClouds();
    }

    onDisable(): void {
        game.off(Game.EVENT_HIDE, this.hide);
        game.off(Game.EVENT_SHOW, this.show);
        this.resetButtons();
    }

    onDestroy(): void {
        game.off(Game.EVENT_HIDE, this.hide);
        game.off(Game.EVENT_SHOW, this.show);
        this.buttons.forEach(button => button.targetOff(this));
        this.content?.getChildByName('R9Hero')?.targetOff(this);
    }

    update(dt: number): void {
        this.fit();
        if (!this.hidden) this.elapsed += Math.min(dt, .05);
        this.paintClouds();
        this.paintMotion();
        if (!this.hidden) this.paintActing();
    }

    private press(button: Node, scale: number): void {
        const press = this.presses.get(button)!;
        press.down = scale < 1;
        Tween.stopAllByTarget(press);
        tween(press).to(.12, { value: scale }, { easing: 'quadOut' }).start();
    }

    private resetButtons(): void {
        for (const button of this.buttons) {
            const press = this.presses.get(button)!;
            Tween.stopAllByTarget(press);
            press.value = 1;
            press.down = false;
            button.setScale(1, 1, 1);
        }
    }

    private createCharacters(): void {
        const hero = this.content.getChildByName('R9Hero')!;
        const logo = this.content.getChildByName('logo_main')!;
        this.actors = this.sequence.layers.map((layer, index) => {
            const parent = layer.space === 'stage' ? this.content : hero;
            const sprite = this.characterSprite(parent, `HomeR2_${layer.name}_${index}`, null);
            // Stage patches sit above both slippers and below the logo/controls, as in the sample.
            if (parent === this.content) sprite.node.setSiblingIndex(logo.getSiblingIndex());
            sprite.node.active = false;
            return sprite;
        });
    }

    private characterSprite(parent: Node, name: string, frame: SpriteFrame | null): Sprite {
        const node = new Node(name);
        node.layer = parent.layer;
        node.parent = parent;
        const sprite = node.addComponent(Sprite);
        sprite.spriteFrame = frame;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.trim = false;
        return sprite;
    }

    private createSky(): void {
        const cloudFrame = this.clouds[0].getComponent(Sprite)!.spriteFrame;
        this.clouds.push(this.characterSprite(this.backdrop, 'R9Cloud3', cloudFrame).node);
        this.clouds.forEach((node, i) => {
            node.parent = this.backdrop;
            node.setSiblingIndex(i);
            node.setScale(1, 1, 1);
            node.setRotationFromEuler(0, 0, 0);
            const opacity = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
            opacity.opacity = Math.round(this.sequence.sky.layers[i].opacity * 255);
        });
        // The supplied foreground is the sample's documented alternative to its Canvas alpha mask.
        this.city = this.characterSprite(this.backdrop, 'HomeR2CityForeground', this.cityForeground);
    }

    private fitCharacters(heroLeft: number, heroTop: number, heroWidth: number): void {
        const hero = this.content.getChildByName('R9Hero')!.getComponent(UITransform)!;
        const contentHeight = this.content.getComponent(UITransform)!.height;
        const scale = heroWidth / BASE_HERO_WIDTH;
        this.actors.forEach((sprite, i) => {
            const layer = this.sequence.layers[i];
            const [left, top, width, height] = layer.rect;
            const ui = sprite.node.getComponent(UITransform)!;
            if (layer.space === 'stage') {
                ui.setContentSize(width * scale, height * scale);
                sprite.node.setPosition(heroLeft + (left + width / 2 - BASE_HERO_LEFT) * scale - 375,
                    contentHeight / 2 - heroTop - (top + height / 2 - BASE_HERO_TOP) * scale, 0);
            } else {
                ui.setContentSize(width * hero.width / 1024, height * hero.height / 1536);
                sprite.node.setPosition(((left + width / 2) / 1024 - .5) * hero.width,
                    (.5 - (top + height / 2) / 1536) * hero.height, 0);
            }
        });
    }

    private paintActing(): void {
        const ordinaryTime = (this.elapsed - this.trickAt) % this.sequence.duration;
        this.actors.forEach((sprite, index) => {
            const layer = this.sequence.layers[index];
            let time = (layer.loopFrom === undefined ? ordinaryTime : this.elapsed) - layer.start;
            const end = layer.frames[layer.frames.length - 1].time;
            let frame = -1;
            if (time >= 0) {
                if (layer.loopFrom !== undefined && time >= end) {
                    time = layer.loopFrom + (time - layer.loopFrom) % (end - layer.loopFrom);
                }
                if (time <= end) {
                    for (const next of layer.frames) {
                        if (next.time > time) break;
                        frame = next.frame;
                    }
                }
            }
            sprite.node.active = frame >= 0;
            if (frame >= 0 && sprite.spriteFrame !== this.characterFrames[frame]) {
                sprite.spriteFrame = this.characterFrames[frame];
            }
        });
    }

    private fit(): void {
        const canvas = this.node.getComponent(UITransform)!;
        const safe = this.safe.getComponent(UITransform)!;
        const top = canvas.height / 2 - this.safe.position.y - safe.height / 2;
        const bottom = canvas.height / 2 + this.safe.position.y - safe.height / 2;
        if (canvas.width === this.width && canvas.height === this.height && top === this.safeTop && bottom === this.safeBottom) return;
        this.width = canvas.width; this.height = canvas.height;
        this.safeTop = top; this.safeBottom = bottom;
        // Fit the whole approved composition on wider screens while the backdrop still covers.
        const scale = Math.min(canvas.width / 750, canvas.height / 1334);
        const height = canvas.height / scale;
        const extra = height - 1334;
        this.content.getComponent(UITransform)!.setContentSize(750, height);
        this.content.setScale(scale, scale, 1);
        this.content.setPosition(-this.safe.position.x, -this.safe.position.y, 0);

        const source = this.backdrop.getComponent(Sprite)!.spriteFrame!.originalSize;
        const cover = Math.max(canvas.width / source.width, canvas.height / source.height);
        this.backdrop.getComponent(UITransform)!.setContentSize(source.width * cover, source.height * cover);
        this.backdrop.setPosition(0, (source.height * cover - canvas.height) / 2, 0);
        this.city.node.getComponent(UITransform)!.setContentSize(source.width * cover, source.height * cover);
        this.city.node.setPosition(0, 0, 0);

        const heroWidth = 470 + extra * .35;
        const heroLeft = 185 - (heroWidth - 470) / 2;
        const heroTop = height - 145 - heroWidth * 1507 / 1024;
        // Scale the interacting group together: fixed-size slippers would pull their roots
        // away from the duck's grip points on tall screens. The standard 750x1334 layout is unchanged.
        const actorScale = heroWidth / BASE_HERO_WIDTH;
        const shoeLeft = heroLeft + (BASE_HERO_WIDTH * 450 / 1024 - 129) * actorScale;
        this.place('R9Hero', heroLeft, heroTop, heroWidth, heroWidth * 1536 / 1024);
        this.place('R9SlipperBack', shoeLeft - 45 * actorScale, heroTop - 136 * actorScale,
            144 * actorScale, 144 * 257 / 340 * actorScale);
        this.place('R9SlipperFront', shoeLeft, heroTop - 121 * actorScale,
            194 * actorScale, 194 * 257 / 340 * actorScale);
        this.place('R9WoodBoard', 22, height * .49, 226, 310);
        // The ribbon is part of the approved logo image, so it scales with the title.
        const logoWidth = 560 + extra * .2;
        const logoHeight = logoWidth * 732 / 1381;
        const logoTop = heroTop - 136 * actorScale - logoHeight - 12;
        this.place('logo_main', (750 - logoWidth) / 2, logoTop, logoWidth, logoHeight);
        this.place('HomeAirship', 9, logoTop + 102, 112, 112 * 96 / 168);
        this.place('HomeAirplane', 645, logoTop + 296, 99, 99 * 94 / 159);
        // Only controls move inward for a notch/home indicator; art still fills the screen.
        this.place('btn_settings_icon', 657, Math.max(25, top / scale + 25), 67, 67);
        const buttonHeight = 556 * 210 / 594;
        this.place('btn_start', 97, Math.min(height - 203, height - bottom / scale - buttonHeight - 6), 556, buttonHeight);
        this.fitCharacters(heroLeft, heroTop, heroWidth);
        this.paintClouds();
    }

    /** The approved HTML uses a top-left, 750-wide coordinate system. */
    private place(name: string, left: number, top: number, width: number, height: number): void {
        const node = this.content.getChildByName(name)!;
        const contentHeight = this.content.getComponent(UITransform)!.height;
        node.getComponent(UITransform)!.setContentSize(width, height);
        node.setPosition(left + width / 2 - 375, contentHeight / 2 - top - height / 2, 0);
        if (!name.startsWith('R9Cloud')) {
            this.rest.set(name, { node, x: node.position.x, y: node.position.y, height });
        }
    }

    private paintMotion(): void {
        const t = this.elapsed;
        const weight = Math.min(1, t / .4);
        const wave = (period: number, phase = 0) => Math.sin(t * Math.PI * 2 / period + phase) * weight;
        // The illustrated stack, slippers, sign and logo stay planted. Only local acting changes.
        this.pose('HomeAirship', wave(8.5, .4) * 8, wave(5.8, .7) * 3, 1, 1, wave(5.8) * .35);
        this.pose('HomeAirplane', wave(7.2, 1.4) * 11, wave(4.6, .3) * 5, 1, 1, wave(7.2) * 1.8);
        const inviteTime = t % 6.2;
        const invite = inviteTime > 4.4 && inviteTime < 5.3
            ? Math.pow(Math.sin((inviteTime - 4.4) / .9 * Math.PI), 2) * .015 : 0;
        for (const button of this.buttons) {
            const press = this.presses.get(button)!;
            const lift = button.name === 'btn_start' && !press.down && !this.hidden ? invite : 0;
            const scale = press.value * (1 + lift);
            button.setScale(scale, scale, 1);
        }
    }

    /** Offset the center when scaling/rotating around an illustrated support or rope point. */
    private pose(name: string, dx: number, dy: number, sx: number, sy: number, angle: number, pivotY = .5): void {
        const rest = this.rest.get(name)!;
        const radius = rest.height * (.5 - pivotY);
        const radians = angle * Math.PI / 180;
        rest.node.setScale(sx, sy, 1);
        rest.node.setRotationFromEuler(0, 0, angle);
        rest.node.setPosition(rest.x + dx - Math.sin(radians) * radius * sy,
            rest.y + dy + (Math.cos(radians) * sy - 1) * radius, 0);
    }

    motionSnapshot(): unknown {
        return { elapsed: this.elapsed, hidden: this.hidden,
            acting: { phase: (this.elapsed - this.trickAt) % this.sequence.duration,
                layers: this.actors.map((sprite, index) => ({ name: this.sequence.layers[index].name,
                    active: sprite.node.active, frame: this.characterFrames.indexOf(sprite.spriteFrame!) })) },
            elements: Array.from(this.rest).map(([name, rest]) => ({
            name, restX: rest.x, restY: rest.y, x: rest.node.position.x, y: rest.node.position.y,
            scaleX: rest.node.scale.x, scaleY: rest.node.scale.y, angle: rest.node.eulerAngles.z,
        })) };
    }

    private paintClouds(): void {
        const sky = this.sequence.sky;
        const ui = this.backdrop.getComponent(UITransform)!;
        this.clouds.forEach((cloud, i) => {
            const layer = sky.layers[i];
            const [startX, y, width, height] = layer.rect;
            // A full cloud leaves the source image before wrapping; no y drift or background motion.
            const span = sky.width + width + 32;
            const x = (startX + width + 16 + this.elapsed * layer.speed) % span - width - 16;
            cloud.getComponent(UITransform)!.setContentSize(width * ui.width / sky.width, height * ui.height / sky.height);
            cloud.setPosition(((x + width / 2) / sky.width - .5) * ui.width,
                (.5 - (y + height / 2) / sky.height) * ui.height, 0);
        });
    }
}
