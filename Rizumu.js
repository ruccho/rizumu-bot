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
            show: false,
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
            this._isReady = true;
            for (let res of this._onReady) {
                res();
            }
        });


        this._window = win;
        this._isAlive = true;
        this._isReady = false;
        this._onReady = [];
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

    playUrl(url) {
        if (!url.hostname.endsWith('www.youtube.com')) {
            throw new Error('対応していないURLです。');
        }

        if (url.pathname === '/watch') {
            //watch url
            this._sendApi('op-play-watch', url.href);
        } else if (url.pathname === '/playlist') {
            //playlist url
            this._sendApi('op-play-list', url.href);
        } else {
            throw new Error('対応していないURLです。');
        }
    }

    playNext() {
        this._sendApi('op-play-next');
    }

    playAgain() {
        this._sendApi('op-play-again');
    }

    playPrev() {
        this._sendApi('op-play-prev');
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