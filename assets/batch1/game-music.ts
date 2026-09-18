import { AudioClip, AudioSource, isValid, Node, warn } from 'cc';
import { hasUserInteraction, readSettings } from './local-platform';

const TRACKS = ['bgm_city', 'bgm_cloud', 'bgm_space'] as const;
const CROSSFADE_SECONDS = 1;
interface MusicVoice { source: AudioSource; region: number; ready: boolean; started: () => void }

/** Two prerecorded arrangements of one theme can overlap; no live stems or music queue. */
export class GameMusic {
    private readonly voices: MusicVoice[] = [];
    private active = -1;
    private fadingFrom = -1;
    private fade = 1;
    private gain = 0;
    private suspended = false;
    private loadingSeconds = 0;
    private readonly issues = new Set<string>();

    constructor(node: Node, private readonly clips: Map<string, AudioClip>) {
        for (let i = 0; i < 2; i++) {
            const child = new Node(`Music:${i}`); node.addChild(child);
            const source = child.addComponent(AudioSource);
            source.playOnAwake = false; source.loop = true; source.volume = 0;
            const started = () => this.started(i);
            child.on(AudioSource.EventType.STARTED, started);
            this.voices.push({ source, region: -1, ready: false, started });
        }
        for (const id of TRACKS) if (!clips.get(id)?.getDuration()) this.issue(`missing:${id}`);
    }

    /** View/camera height, never the record score. Midpoints match the visual transitions. */
    update(dt: number, viewHeight: number, incident = false, defeated = false, reacting = false, dangerous = false): void {
        if (!readSettings().music || !hasUserInteraction()) { this.stop(); return; }
        if (this.suspended) return;
        const region = viewHeight >= 160 ? 2 : viewHeight >= 55 ? 1 : 0;
        if (this.active < 0) this.start(region);
        if (this.active < 0) return; // Missing audio never blocks the run.
        if (this.fadingFrom < 0 && this.voices[this.active].region !== region) this.start(region);
        const targetGain = defeated ? 0 : incident || reacting ? .09 : dangerous ? .20 : .28;
        const gainSpeed = reacting && targetGain < this.gain ? 1.8 : .3;
        this.gain += Math.sign(targetGain - this.gain) * Math.min(Math.abs(targetGain - this.gain), dt * gainSpeed);
        // AudioPlayer.load is asynchronous. Keep the previous phrase audible until STARTED.
        if (!this.voices[this.active].ready) {
            this.loadingSeconds += dt;
            if (this.loadingSeconds >= 8) this.issue(`not-started:${TRACKS[this.voices[this.active].region]}`);
            if (this.fadingFrom >= 0) this.voices[this.fadingFrom].source.volume = this.gain;
            return;
        }
        this.fade = Math.min(1, this.fade + dt / CROSSFADE_SECONDS);
        this.voices[this.active].source.volume = this.gain * this.fade;
        if (this.fadingFrom >= 0) {
            const old = this.voices[this.fadingFrom].source;
            old.volume = this.gain * (1 - this.fade);
            if (this.fade === 1) { old.stop(); old.clip = null; this.fadingFrom = -1; }
        }
    }

    private start(region: number): void {
        const clip = this.clips.get(TRACKS[region]);
        if (!clip || clip.getDuration() <= 0) return;
        const previous = this.active;
        const next = previous < 0 ? 0 : 1 - previous;
        const voice = this.voices[next];
        // The three offline arrangements have equal lengths and the same bar/phrase grid.
        const time = previous < 0 ? 0 : this.voices[previous].source.currentTime % clip.getDuration();
        voice.source.stop(); voice.source.clip = clip; voice.source.volume = 0;
        voice.source.currentTime = time; voice.region = region; voice.ready = false;
        this.active = next; this.fadingFrom = previous; this.fade = previous < 0 ? 1 : 0; this.loadingSeconds = 0;
        voice.source.play();
    }

    private started(index: number): void {
        const voice = this.voices[index];
        if (index !== this.active || voice.ready) return;
        voice.ready = true;
        if (this.fadingFrom >= 0) voice.source.currentTime =
            this.voices[this.fadingFrom].source.currentTime % voice.source.duration;
        if (this.suspended || !readSettings().music) voice.source.pause();
    }

    private issue(message: string): void {
        if (this.issues.has(message)) return;
        this.issues.add(message); warn(`[GameMusic] ${message}`);
    }

    pause(value: boolean): void {
        if (this.suspended === value) return;
        this.suspended = value; this.applyPause();
    }

    private applyPause(): void {
        if (!readSettings().music || !hasUserInteraction()) { this.stop(); return; }
        for (const index of [this.active, this.fadingFrom]) {
            if (index < 0) continue;
            const source = this.voices[index].source;
            if (this.suspended) source.pause();
            else if (!source.playing) source.play();
        }
    }

    private stop(): void {
        if (this.active < 0) return;
        for (const voice of this.voices) {
            if (isValid(voice.source, true)) { voice.source.stop(); voice.source.clip = null; }
            voice.region = -1; voice.ready = false;
        }
        this.active = this.fadingFrom = -1; this.fade = 1; this.gain = 0;
    }

    snapshot(): object {
        return { region: this.active < 0 ? null : TRACKS[this.voices[this.active].region],
            fading: this.fadingFrom >= 0, fade: this.fade, gain: this.gain,
            paused: this.suspended, enabled: readSettings().music, issues: Array.from(this.issues),
            sources: this.voices.map(voice => ({ clip: voice.source.clip?.name ?? null,
                playing: voice.source.playing, time: voice.source.currentTime, volume: voice.source.volume })) };
    }

    dispose(): void {
        for (const voice of this.voices) voice.source.node?.off(AudioSource.EventType.STARTED, voice.started);
        this.stop();
    }
}
