import { BrowserWindow, ipcMain } from "electron";
import YtWatchItem from "./YtWatchItem";
import * as uuid from 'uuid';
import * as path from 'path';

function log(instanceId: string, message: string) {
    console.log(`[${instanceId}] [PLAYLIST] ${message}`);
}

function sendApi(window: BrowserWindow, instanceId: string, eventName: string, data: any) {
    const channel = `${eventName}-${instanceId}`;
    log(instanceId, `sending on ${channel}`);
    window.webContents.send(channel, data);
}

function onApi<T>(instanceId: string, eventName: string, listener: (data: T) => void) {
    const channel = `${eventName}-${instanceId}`;
    log(instanceId, `listening on ${channel}`);
    ipcMain.on(channel, (event, arg) => {
        listener(arg);
    });
}

export default async function fetchYtPlaylist(listId: string, headless: boolean, onItem: (item: YtWatchItem) => void) {

    const instanceId = uuid.v4();

    const win = new BrowserWindow({
        width: 450,
        height: 400,
        show: !headless,
        webPreferences: {
            preload: path.join(__dirname, '../src/renderer', 'rizumu-preload.js'),
            webviewTag: true,
            offscreen: headless,
        }
    });

    const url = 'file://' + path.join(__dirname, `../src/public/rizumu.html`) + `?instance_id=${instanceId}`;
    win.loadURL(url);

    ipcMain.on(`st-console-message-${instanceId}`, (e, arg) => {
        log(instanceId, arg.message);
    });

    const readyPromise = new Promise<void>((res, rej) => {
        onApi(instanceId, 'st-ready', () => {
            res();
        });
    });

    await readyPromise;

    log(instanceId, 'ready');

    const completePromise = new Promise<void>((res, rej) => {
        onApi<{ type: string }>(instanceId, 'st-playlist-item', item => {
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