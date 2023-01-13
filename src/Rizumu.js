const { AudioPlayerStatus, createAudioPlayer, NoSubscriberBehavior, createAudioResource, StreamType } = require('@discordjs/voice');
const { BrowserWindow, ipcMain } = require('electron')
const path = require('path');
const { Readable } = require('stream');
const uuid = require('uuid');
const fetchYtPlaylist = require('./YtPlaylistFetch');
const fetchYtWatchItem = require('./YtWatchFetch');
const YtWatchItem = require('./YtWatchItem');

class Rizumu {
    constructor(headless) {
        const instanceId = uuid.v4();

        this._instanceId = instanceId;
        this._headless = headless;

        const win = new BrowserWindow({
            width: 450,
            height: 400,
            show: !this._headless,
            webPreferences: {
                preload: path.join(__dirname, 'renderer', 'rizumu-preload.js'),
                webviewTag: true,
                offscreen: this._headless,
            }
        })

        win.webContents.setFrameRate(10)

        const url = 'file://' + path.join(__dirname + `/public/rizumu.html?instance_id=${instanceId}`);
        win.loadURL(url);

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

        this._onApi('st-ready', arg => {
            this._log("ready")
            this._isReady = true;
            for (let res of this._onReady) {
                res();
            }
            this._onReady.splice(0);
        });

        /*
        this._onApi('st-playlist-item', item => {
            if (item) {
                this._log(`Playlist item: ${item.title}`);
                let parsedItem;
                if (item.type === 'YT_WATCH') {
                    parsedItem = YtWatchItem.fromItemObject(item);
                }
                if(parsedItem)
                {
                    this.enqueueItem(parsedItem, true);
                }
                for (let res of this._onFetchItem) {
                    res(item);
                }
            } else {
                //completed
                this._log('The list fully fetched');
                for (let res of this._onFetchCompleted) {
                    res();
                }
                this._onFetchCompleted.splice(0);
            }
        });
        */

        this._onApi('st-video-end', () => {
            this._log(`st-video-end`);
            if (this._loopSingle && this._playingItem) {
                this._playItemAsync(this._playingItem);
            } else {
                this._playingItem = null;
                this._updatePlayingItem();
            }
        });

        this._onApi('st-url-changed', data => {
            this._log(`st-url-changed ${data.url}`);
            for (let res of this._onUrlChanged) {
                res(data.url);
            }
            this._onUrlChanged.splice(0);
        });

        this._window = win;
        this._isAlive = true;
        this._isReady = false;
        this._onReady = [];
        this._queue = [];
        this._isBusy = false;
        this._onFetchCompleted = [];
        this._onFetchItem = [];
        this._playingItem = null;
        this._onUrlChanged = [];
        this._loopSingle = false;
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

    setLoopSingle(loopSingle) {
        this._loopSingle = loopSingle;
    }

    _renewAudioResource() {
        const rawStream = this.getAudioStream();

        const resource = createAudioResource(rawStream, {
            inputType: StreamType.Raw,
            //inlineVolume: true
        });
        //resource.volume.setVolume(0.2);

        this._player.play(resource);
    }

    enqueueItem(item, autoplay) {
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

    isAlive() {
        return this._isAlive && !this._window.isDestroyed();
    }

    close() {
        if (this.isAlive()) {
            this._window.close();
            this._isAlive = false;
        }
    }

    readyAsync() {
        if (this._isReady) {
            return new Promise((res, rej) => {
                res();
            });
        } else {
            return new Promise((res, rej) => {
                this._onReady.push(res);
            });
        }
    }

    captureAsync() {
        return new Promise((res, rej) => {
            this._window.webContents.once('paint', (event, dirty, image) => {
                res(image.toPNG());
            });
        });
    }

    async playUrlAsync(url, progress) {
        if (this._isBusy) {
            throw new Error('別の処理が実行中です。');
        }
        this._isBusy = true;
        try {

            if (!url.hostname.endsWith('youtube.com')) {
                throw new Error('対応していないURLです。');
            }

            if (url.pathname === '/watch') {
                //watch url
                progress?.({ message: '動画を再生...' });
                await this._playWatchAsync(url, progress);
            } else if (url.pathname === '/playlist') {
                //playlist url
                await this._fetchListAsync(url, progress);
            } else {
                throw new Error('対応していないURLです。');
            }
        } finally {
            this._isBusy = false;
        }
    }

    async _updatePlayingItem() {
        if (this._playingItem) return;
        await this.moveQueueAsync(0);
    }

    async moveQueueAsync(position) {
        if (position >= 0) this._queue.splice(0, position);
        if (this._queue.length > 0) {
            await this._playItemAsync(this._queue[0]);
            this._queue.splice(0, 1);
        }
    }

    async _playItemAsync(item) {
        if (item instanceof YtWatchItem) {
            let urlStr = `https://www.youtube.com/watch?v=${item.watchId}`;
            this._log(`playing ${urlStr}`);
            this._playingItem = item;
            this._sendApi('op-play-watch', urlStr);
            urlStr = await this._waitForUrlAsync();
            const url = new URL(urlStr);
            if (url.pathname !== '/watch' ||
                url.searchParams.get('v') !== item.watchId)
                throw new Error('正しく再生されませんでした。');
        }
    }

    _waitForUrlAsync() {
        this._log(`_waitForUrlAsync(): waiting for next url`);
        return new Promise((res, rej) => {
            this._onUrlChanged.push((url) => {
                this._log(`_waitForUrlAsync(): resolved: ${url}`);
                res(url);
            });
        })
    }

    async _playWatchAsync(url, progress) {
        const watchId = url.searchParams.get('v');

        const item = await fetchYtWatchItem(watchId);

        this.enqueueItem(item, true);
    }

    async _fetchListAsync(url, progress) {
        /*
        const playing = this._playingItem;
        this._playingItem = null;
        progress?.({ message: '再生リストをフェッチ中...' });

        let count = 0;
        const onItem = item => {
            count++;
            if (count % 100 == 0) {
                progress?.({ message: `再生リストをフェッチ中: ${count} アイテム` });
            }
        }
        this._onFetchItem.push(onItem);

        const p = new Promise((res, rej) => {
            this._onFetchCompleted.push(async () => {
                try {
                    progress?.({ message: `フェッチ完了: ${count} アイテム 動画を再生...` });
                    if (playing) {
                        await this._playItemAsync(playing);
                    } else {
                        await this._updatePlayingItem();
                    }
                } catch (error) {
                    rej(error);
                } finally {
                    this._onFetchItem.splice(
                        this._onFetchItem.findIndex(v => v == onItem),
                        1
                    );
                }
                res();
            });
        });
        this._sendApi('op-fetch-list', url.href);
        return p;
        */

        const listId = url.searchParams.get('list');
        if (!listId) return;

        progress?.({ message: '再生リストをフェッチ中...' });
        let count = 0;
        await fetchYtPlaylist(listId, this._headless, (item) => {
            this.enqueueItem(item, true);

            count++;
            if (count % 100 == 0) {
                progress?.({ message: `再生リストをフェッチ中: ${count} アイテム` });
            }
        })
    }

    _sendApi(eventName, data) {
        const channel = `${eventName}-${this._instanceId}`;
        console.log(`[RIZUMU] sending on ${channel}`);
        this._window.webContents.send(channel, data);
    }

    _onApi(eventName, listener) {
        const channel = `${eventName}-${this._instanceId}`;
        console.log(`[RIZUMU] listening on ${channel}`);
        ipcMain.on(channel, (event, arg) => {
            listener(arg);
        });
    }

    _log(message) {
        console.log(`[${this._instanceId}] [RIZUMU] ${message}`)
    }
}

module.exports = Rizumu;