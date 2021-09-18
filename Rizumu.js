const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path');
const { Stream, Readable } = require('stream');
const uuid = require('uuid')


class Rizumu {
    constructor() {
        const instanceId = uuid.v4();

        this._instanceId = instanceId;
        this._audioStream = new Readable({
            read() { }
        });

        const win = new BrowserWindow({
            width: 800,
            height: 600,
            //show: false,
            webPreferences: {
                preload: path.join(__dirname, 'rizumu-preload.js'),
                webviewTag: true
            }
        })

        var url = 'file://' + path.join(__dirname + `/public/default.html?instance_id=${instanceId}`);
        win.loadURL(url);

        console.log("[RIZUMU] audio-data listening on " + `audio-data-${instanceId}`);
        ipcMain.on(`audio-data-${instanceId}`, (event, arg) => {

            if (!arg) return;

            const samples = arg;

            let sum = 0;
            for (let i = 0; i < samples.length; i++) {
                let s = samples[i];
                sum += s;
                samples[i] = Math.round(s * 32767);
            }

            const samplesArray = Int16Array.from(samples);
            const samplesBuffer = Buffer.from(samplesArray.buffer);

            this._audioStream.push(samplesBuffer);
        });

        this._onApi('st-ready', arg => {
            console.log("[RIZUMU] ready")
            this._isReady = true;
            for (let res of this._onReady) {
                res();
            }
            this._onReady.splice(0);
        });

        this._onApi('st-playlist-item', item => {
            if (item) {
                console.log(`[RIZUMU] Playlist item: ${item.title}`);
                if (item.type === 'YT_WATCH') {
                    this._queue.push(item);
                }
                for (let res of this._onFetchItem) {
                    res(item);
                }
            } else {
                //completed
                console.log('[RIZUMU] The list fully fetched');
                for (let res of this._onFetchCompleted) {
                    res();
                }
                this._onFetchCompleted.splice(0);
            }
        });

        this._onApi('st-video-end', () => {
            this._playingItem = null;
            this._updatePlayingItem();
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
    }

    getAudioStream() {
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

    async playUrlAsync(url, progress) {
        if (this._isBusy) {
            throw new Error('別の処理が実行中です。');
        }
        this._isBusy = true;
        try {

            if (!url.hostname.endsWith('www.youtube.com')) {
                throw new Error('対応していないURLです。');
            }

            if (url.pathname === '/watch') {
                //watch url
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
        if (this._queue.length > 0) await this._playItemAsync(this._queue[0]);
        this._queue.splice(0, 1);
    }

    async _playItemAsync(item) {
        if (item.type === 'YT_WATCH') {
            this._playingItem = item;
            this._sendApi('op-play-watch', `https://www.youtube.com/watch?v=${item.watchId}`);
            //TODO: wait for video start
        }
    }

    async _enqueueItem(item) {
        this._queue.push(item);
    }

    async _playWatchAsync(url, progress) {
        this._playingItem = null;
        this._sendApi('op-play-watch', url.href);
    }

    _fetchListAsync(url, progress) {
        const playing = this._playingItem;
        this._playingItem = null;
        const p = new Promise((res, rej) => {
            this._onFetchCompleted.push(async () => {
                if (playing) {
                    await this._playItemAsync(playing);
                } else {
                    await this._updatePlayingItem();
                }
                res();
            });
        });
        this._sendApi('op-fetch-list', url.href);
        return p;
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
}

module.exports = Rizumu;