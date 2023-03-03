import { BrowserWindow, ipcMain } from "electron";
import * as uuid from 'uuid';
import * as path from 'path';
import { YtWatchItem } from "./YtWatchProvider";

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
            preload: path.join(__dirname, 'YtPreload.js'),
            //webviewTag: true,
            offscreen: headless,
            sandbox: false
        }
    });

    log(instanceId, 'ready');

    const url = new URL(`https://m.youtube.com/playlist?app=m&list=${listId}`);
    url.searchParams.set("rizumu_instance_id", instanceId);
    win.loadURL(url.toString());

    const completePromise = new Promise<void>((res, rej) => {
        onApi<{ type: string }>(instanceId, 'st-playlist-item', item => {
            if (item) {
                const fined = YtWatchItem.assertAndInstantiate(item);
                if (fined) onItem(fined);
                else console.warn(`Unsupported item: ${item.type}`);
            } else {
                log(instanceId, 'The list fully fetched');
                win.destroy();
                res();
            }
        });
    });
    
    return completePromise;
}