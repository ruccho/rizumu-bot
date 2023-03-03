import { BrowserWindow, ipcMain } from "electron";
import * as uuid from 'uuid';
import * as path from 'path';
import { YtWatchItem } from "./YtWatchProvider";
import { BrowserContainer } from "../../BrowserContainer";
import { PublicError } from "../../PublicError";

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

    const browser = new BrowserContainer(headless, instanceId, "PLAYLIST-BROWSER");
    log(instanceId, 'ready');

    const url = new URL(`https://m.youtube.com/playlist?app=m&list=${listId}`);
    url.searchParams.set("rizumu_instance_id", instanceId);
    browser.open(url.toString(), path.join(__dirname, 'YtPreload.js'));

    const fetchTimeoutMs = 30_000;

    const state: {
        timeoutId?: NodeJS.Timeout
    } = {
        timeoutId: undefined
    };
    try {

        const completePromise = new Promise<void>((res, rej) => {
            const fetchTimeout = () => {
                log(instanceId, "Playlist fetching timed out.");
                rej(new PublicError("プレイリストの取得がタイムアウトしました。"));
            };

            state.timeoutId = setTimeout(fetchTimeout, fetchTimeoutMs);

            onApi<{ type: string }>(instanceId, 'st-playlist-item', item => {

                clearTimeout(state.timeoutId);
                state.timeoutId = undefined;

                if (item) {
                    
                    state.timeoutId = setTimeout(fetchTimeout, fetchTimeoutMs);

                    const fined = YtWatchItem.assertAndInstantiate(item);
                    if (fined) onItem(fined);
                    else log(instanceId, `Unsupported item: ${item.type}`);
                } else {
                    log(instanceId, 'The list fully fetched');
                    res();
                }
            });
        });

        await completePromise;
    } finally {
        clearTimeout(state.timeoutId);
        browser.close();
    }
}