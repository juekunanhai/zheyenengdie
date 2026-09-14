import { _decorator, Component, game, Game, Node, Sprite, Tween, tween, UITransform, Vec3 } from 'cc';

const { ccclass } = _decorator;

/** Approved R10.1 homepage illustration. No gameplay objects or camera-height state. */
@ccclass('HomePresentation')
export class HomePresentation extends Component {
    private content!: Node;
    private safe!: Node;
    private backdrop!: Node;
    private clouds: Node[] = [];
    private buttons: Node[] = [];
    private width = 0;
    private height = 0;
    private safeTop = 0;
    private safeBottom = 0;
    private elapsed = 0;
    private hidden = false;
    private readonly hide = () => { this.hidden = true; this.resetButtons(); };
    private readonly show = () => { this.hidden = false; };

    onLoad(): void {
        this.safe = this.node.getChildByName('SafeArea')!;
        // Keep the existing path used by StackSceneActions.
        this.content = this.safe.getChildByName('Content_1230')!;
        this.backdrop = this.node.getChildByName('HomeBackdrop')!;
        this.clouds = [0, 1, 2].map(i => this.content.getChildByName(`R9Cloud${i}`)!);
        this.buttons = ['btn_start', 'btn_settings_icon'].map(name => this.content.getChildByName(name)!);
        for (const button of this.buttons) {
            button.on(Node.EventType.TOUCH_START, () => this.press(button, .96));
            button.on(Node.EventType.TOUCH_END, () => this.press(button, 1));
            button.on(Node.EventType.TOUCH_CANCEL, () => this.press(button, 1));
        }
        this.fit();
    }

    onEnable(): void {
        game.on(Game.EVENT_HIDE, this.hide);
        game.on(Game.EVENT_SHOW, this.show);
    }

    onDisable(): void {
        game.off(Game.EVENT_HIDE, this.hide);
        game.off(Game.EVENT_SHOW, this.show);
        this.resetButtons();
    }

    update(dt: number): void {
        this.fit();
        if (!this.hidden) this.elapsed += Math.min(dt, .05);
        this.paintClouds();
    }

    private press(button: Node, scale: number): void {
        Tween.stopAllByTarget(button);
        tween(button).to(.12, { scale: new Vec3(scale, scale, 1) }, { easing: 'quadOut' }).start();
    }

    private resetButtons(): void {
        for (const button of this.buttons) {
            Tween.stopAllByTarget(button);
            button.setScale(1, 1, 1);
        }
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

        const heroWidth = 470 + extra * .35;
        const heroLeft = 185 - (heroWidth - 470) / 2;
        const heroTop = height - 145 - heroWidth * 1507 / 1024;
        const shoeLeft = heroLeft + heroWidth * 450 / 1024 - 129;
        this.place('R9Hero', heroLeft, heroTop, heroWidth, heroWidth * 1536 / 1024);
        this.place('R9SlipperBack', shoeLeft - 45, heroTop - 136, 144, 144 * 257 / 340);
        this.place('R9SlipperFront', shoeLeft, heroTop - 121, 194, 194 * 257 / 340);
        this.place('R9WoodBoard', 22, height * .49, 226, 310);
        // The ribbon is part of the approved logo image, so it scales with the title.
        const logoWidth = 560 + extra * .2;
        const logoHeight = logoWidth * 732 / 1381;
        const logoTop = heroTop - 136 - logoHeight - 12;
        this.place('logo_main', (750 - logoWidth) / 2, logoTop, logoWidth, logoHeight);
        this.place('HomeAirship', 9, logoTop + 102, 112, 112 * 96 / 168);
        this.place('HomeAirplane', 645, logoTop + 296, 99, 99 * 94 / 159);
        // Only controls move inward for a notch/home indicator; art still fills the screen.
        this.place('btn_settings_icon', 657, Math.max(25, top / scale + 25), 67, 67);
        const buttonHeight = 556 * 210 / 594;
        this.place('btn_start', 97, Math.min(height - 203, height - bottom / scale - buttonHeight - 6), 556, buttonHeight);
        this.paintClouds();
    }

    /** The approved HTML uses a top-left, 750-wide coordinate system. */
    private place(name: string, left: number, top: number, width: number, height: number): void {
        const node = this.content.getChildByName(name)!;
        const contentHeight = this.content.getComponent(UITransform)!.height;
        node.getComponent(UITransform)!.setContentSize(width, height);
        node.setPosition(left + width / 2 - 375, contentHeight / 2 - top - height / 2, 0);
    }

    private paintClouds(): void {
        const height = this.content.getComponent(UITransform)!.height;
        const extra = height - 1334;
        const positions = [[-170, 300 + extra * .12, 340, 25, 7, 140, 7],
            [610, 490 + extra * .2, 290, 28, 13, -140, -8],
            [-105, 732 + extra * .25, 185, 27, 17, 110, 6]];
        this.clouds.forEach((cloud, i) => {
            const [x, y, width, duration, offset, travel, lift] = positions[i];
            const phase = (this.elapsed + offset) / duration;
            const weight = (1 - Math.cos(Math.PI * phase)) / 2;
            const source = cloud.getComponent(Sprite)!.spriteFrame!.originalSize;
            this.place(cloud.name, x + travel * weight, y + lift * weight, width, width * source.height / source.width);
        });
    }
}
