const { BrowserWindow, ipcMain } = require("electron");
const YtWatchItem = require("./YtWatchItem");
const uuid = require('uuid');
const path = require('path');

function log(instanceId, message) {
    console.log(`[${instanceId}] [PLAYLIST] ${message}`);
}

function sendApi(window, instanceId, eventName, data) {
    const channel = `${eventName}-${instanceId}`;
    log(instanceId, `sending on ${channel}`);
    window.webContents.send(channel, data);
}

function onApi(instanceId, eventName, listener) {
    const channel = `${eventName}-${instanceId}`;
    log(instanceId, `listening on ${channel}`);
    ipcMain.on(channel, (event, arg) => {
        listener(arg);
    });
}

async function fetchYtPlaylist(listId, headless, onItem) {

    const instanceId = uuid.v4();

    const win = new BrowserWindow({
        width: 450,
        height: 400,
        show: !headless,
        webPreferences: {
            preload: path.join(__dirname, 'rizumu-preload.js'),
            webviewTag: true,
            offscreen: headless,
        }
    });

    const url = 'file://' + path.join(__dirname + `/public/rizumu.html?instance_id=${instanceId}`);
    win.loadURL(url);

    ipcMain.on(`st-console-message-${instanceId}`, (e, arg) => {
        log(instanceId, arg.message);
    });

    const readyPromise = new Promise((res, rej) => {
        onApi(instanceId, 'st-ready', arg => {
            res();
        });
    });

    await readyPromise;

    log(instanceId, 'ready');

    const completePromise = new Promise((res, rej) => {
        onApi(instanceId, 'st-playlist-item', item => {
            if (item) {
                //log(instanceId, `Playlist item: ${item.title}`);
                let parsedItem;
                if (item.type === 'YT_WATCH') {
                    parsedItem = YtWatchItem.fromItemObject(item);
                }

                onItem(parsedItem);
            } else {
                //completed
                log(instanceId, 'The list fully fetched');
                win.destroy();
                res();
            }
        });
    });

    sendApi(win, instanceId, 'op-fetch-list', listId);
    return completePromise;
}

module.exports = fetchYtPlaylist;