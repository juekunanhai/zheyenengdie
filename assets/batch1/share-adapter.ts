export interface SharePayload {
    shareType: 'normal';
    runId: string;
    targetHeight: number;
    mode: 'normal';
    image?: string;
    poster?: string;
    routeToken?: string;
}

export type ShareStatus = 'shared' | 'cancelled' | 'unsupported' | 'failed';

export interface ShareResult {
    status: ShareStatus;
    reason?: string;
}

export interface ShareAdapter {
    share(payload: SharePayload): Promise<ShareResult>;
}

class UnavailableShareAdapter implements ShareAdapter {
    async share(): Promise<ShareResult> { return { status: 'unsupported', reason: 'platform_share_unavailable' }; }
}

class WeChatShareAdapter implements ShareAdapter {
    constructor(private readonly wx: { shareAppMessage(options: Record<string, string>): void }) {}

    async share(payload: SharePayload): Promise<ShareResult> {
        try {
            const height = Math.max(0, Number.isFinite(payload.targetHeight) ? payload.targetHeight : 0).toFixed(1);
            const query = `shareType=normal&runId=${encodeURIComponent(payload.runId)}&targetHeight=${encodeURIComponent(height)}`;
            const options: Record<string, string> = {
                title: `我在《这也能叠》叠到了 ${height}m，你能超过我吗？`,
                query,
            };
            if (payload.image || payload.poster) options.imageUrl = payload.image || payload.poster!;
            this.wx.shareAppMessage(options);
            return { status: 'shared' };
        } catch (error) {
            return { status: 'failed', reason: error instanceof Error ? error.message : 'share_call_failed' };
        }
    }
}

class WebShareAdapter implements ShareAdapter {
    constructor(private readonly navigator: {
        share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
    }) {}

    async share(payload: SharePayload): Promise<ShareResult> {
        if (typeof this.navigator.share !== 'function') return { status: 'unsupported', reason: 'web_share_unavailable' };
        const height = Math.max(0, Number.isFinite(payload.targetHeight) ? payload.targetHeight : 0).toFixed(1);
        try {
            await this.navigator.share({
                title: '这也能叠',
                text: `我在《这也能叠》叠到了 ${height}m，你能超过我吗？`,
                url: payload.routeToken || undefined,
            });
            return { status: 'shared' };
        } catch (error) {
            const reason = error instanceof Error ? error.name : 'share_call_failed';
            return { status: reason === 'AbortError' ? 'cancelled' : 'failed', reason };
        }
    }
}

/** Platform detection stays in this boundary; gameplay and common UI only see ShareAdapter. */
export function createShareAdapter(): ShareAdapter {
    const globals = globalThis as unknown as {
        wx?: { shareAppMessage?: (options: Record<string, string>) => void };
        navigator?: { share?: (data: { title?: string; text?: string; url?: string }) => Promise<void> };
    };
    if (globals.wx?.shareAppMessage) return new WeChatShareAdapter({ shareAppMessage: globals.wx.shareAppMessage });
    if (globals.navigator) return new WebShareAdapter(globals.navigator);
    return new UnavailableShareAdapter();
}

export function createRunSharePayload(input: {
    runId: string;
    height: number;
    poster?: string;
    routeToken?: string;
}): SharePayload {
    return {
        shareType: 'normal', mode: 'normal', runId: input.runId || 'run',
        targetHeight: Number.isFinite(input.height) ? Math.max(0, input.height) : 0,
        poster: input.poster, routeToken: input.routeToken,
    };
}
