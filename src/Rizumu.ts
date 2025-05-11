import { AudioPlayerStatus, createAudioPlayer, NoSubscriberBehavior, createAudioResource, StreamType, AudioPlayer } from '@discordjs/voice';
import { ipcMain } from 'electron';
import { Readable } from 'stream';
import * as uuid from 'uuid';
import { BrowserContainer } from './BrowserContainer';
import { CancellationTokenSource } from './CancellationToken';
import ProviderManager, { createProviderManager, processUrlAsync } from './providers/ProviderManager';
import { RizumuProvider } from './providers/RizumuProvider';
import RizumuItem, { playItemAsync } from './RizumuItem';


export type ProgressCallback = (data: { message: string }) => void;

export type RizumuOptions = {
    headless: boolean;
    providers: RizumuProvider[];
};

class Rizumu {

    private _instanceId: string;

    public get instanceId() {
        return this._instanceId;
    }

    private _headless: boolean;

    private _queue: RizumuItem[] = [];
    private _isBusy: boolean = false;
    private _playingItem?: RizumuItem;
    private _onUrlChanged: Array<(url: string) => void> = [];
    private _loopSingle: boolean = false;
    private _audioStream?: Readable;

    private _player?: AudioPlayer;

    private readonly providers: ProviderManager;

    private browser: BrowserContainer;

    private closeCancellation: CancellationTokenSource = new CancellationTokenSource();
    private processCancellation: CancellationTokenSource = new CancellationTokenSource();

    constructor(options: RizumuOptions) {
        const instanceId = uuid.v4();

        this._instanceId = instanceId;
        this._headless = options.headless;

        this.providers = createProviderManager(options.providers);

        this.browser = new BrowserContainer(this._headless, this.instanceId, "BROWSER");

        ipcMain.on(`st-console-message-${instanceId}`, (e, arg) => {

            console.log(`[${instanceId}] ${arg.message}`);
        });

        this._log("audio-data listening on " + `audio-data-${instanceId}`);
        ipcMain.on(`audio-data-${instanceId}`, (event, arg) => {

            if (!arg) return;

            const arrayBuffer = arg;

            const samplesBuffer = Buffer.from(arrayBuffer);

            this._audioStream?.push(samplesBuffer);
        });

        this._onApi('st-video-end', () => {
            this._log(`st-video-end`);
            if (this._loopSingle && this._playingItem) {
                this._playItemAsync(this._playingItem);
            } else {
                this._playingItem = undefined;
                this._updatePlayingItem();
            }
        });

        this._onApi<{ url: string }>('st-url-changed', data => {
            this._log(`st-url-changed ${data.url}`);
            for (const res of this._onUrlChanged) {
                res(data.url);
            }
            this._onUrlChanged.splice(0);
        });
    }

    getAudioPlayer() {
        if (this._player) return this._player;

        const player = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Play,
                maxMissedFrames: 5000 / 20
            }
        });

        player.on('error', error => {
            this._log(error);
        });

        player.on(AudioPlayerStatus.Idle, () => {
            this._log('[MAIN] AudioPlayer: Idle');
            this._renewAudioResource();
        });

        player.on(AudioPlayerStatus.Buffering, () => {
            this._log('[MAIN] AudioPlayer: Buffering');
        });

        player.on(AudioPlayerStatus.Playing, () => {
            this._log('[MAIN] AudioPlayer: Playing');
        });

        player.on(AudioPlayerStatus.AutoPaused, () => {
            this._log('[MAIN] AudioPlayer: AutoPaused');
        });

        player.on(AudioPlayerStatus.Paused, () => {
            this._log('[MAIN] AudioPlayer: Paused');
        });

        this._player = player;
        this._renewAudioResource();

        return this._player;
    }

    getPlayingItem() {
        return this._playingItem;
    }

    getQueue() {
        return this._queue;
    }

    getLoopSingle() {
        return this._loopSingle;
    }

    setLoopSingle(loopSingle: boolean) {
        this._loopSingle = loopSingle;
    }

    private _renewAudioResource() {
        const rawStream = this.getAudioStream();

        const resource = createAudioResource(rawStream, {
            inputType: StreamType.Raw,
            //inlineVolume: true
        });
        //resource.volume.setVolume(0.2);

        this._player!.play(resource);
    }

    enqueueItem(item: RizumuItem, autoplay: boolean) {
        this._queue.push(item);
        if (autoplay)
            this._updatePlayingItem();
    }

    getAudioStream() {
        this._audioStream = new Readable({
            read() { }
        });
        return this._audioStream;
    }

    close() {
        this.browser.close();
        this.closeCancellation.cancel();
        this.closeCancellation.reset();
        this.processCancellation.cancel();
        this.processCancellation.reset();
    }

    captureAsync() {
        const ct = this.closeCancellation.token;
        return new Promise<Buffer>((res, rej) => {

            const c = this.browser.currentWebContents;
            if (c) {
                c.once('paint', (event, dirty, image) => {
                    if (ct.isCancellationRequested) rej();
                    else res(image.toPNG());
                });
            } else {
                rej();
            }
        });
    }

    async pushUrlAsync(url: URL, progress?: ProgressCallback) {
        if (this._isBusy) {
            throw new Error('Rizumu is busy.');
        }

        this.processCancellation.cancel();
        this.processCancellation.reset();

        this._isBusy = true;
        try {
            await processUrlAsync(this.providers, url, (item) => {
                this.enqueueItem(item, true);
            }, progress, this.processCancellation.token);
        } finally {
            this._isBusy = false;
        }
    }

    private async _updatePlayingItem() {
        if (this._playingItem) return;
        await this.moveQueueAsync(0);
    }

    async moveQueueAsync(position: number) {
        if (position >= 0) this._queue.splice(0, position);
        if (this._queue.length == 0) {
            //empty
            this._log("the queue has been emptied.");
            this.browser.close();
        } else {

            await this._playItemAsync(this._queue[0]);
            this._queue.splice(0, 1);
        }
    }

    async playUrlAsync(url: URL, preloadPath: string) {
        this._log(`playing ${url.toString()}`);

        this.browser.open(url.toString(), preloadPath);
    }

    private async _playItemAsync(item: RizumuItem) {
        this._playingItem = item;

        await playItemAsync(this, item);
    }

    private _onApi<T>(eventName: string, listener: (arg: T) => void) {
        const channel = `${eventName}-${this._instanceId}`;
        console.log(`[RIZUMU] listening on ${channel}`);
        ipcMain.on(channel, (event, arg) => {
            listener(arg);
        });
    }

    private _log(message: unknown) {
        console.log(`[${this._instanceId}] [RIZUMU] ${message}`)
    }
}

export default Rizumu;