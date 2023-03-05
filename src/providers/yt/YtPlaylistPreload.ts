import { ipcRenderer, contextBridge } from "electron";

declare var window: Window & {
    rizumu: {
        instanceId: string;
    }
}

const instanceId = (new URL(location.href)).searchParams.get("rizumu_instance_id");

console.log(`YtPlaylistPreload for ${instanceId}`);

document.addEventListener("DOMContentLoaded", (e) =>{
    refreshPlaylist();
})

/*
window.addEventListener("load", async (e) => {
    console.log("onload");
    refreshPlaylist();
});
*/

function refreshPlaylist() {

    console.log("Fetching playlist...");
    const container = document.querySelector('ytm-app');//div#contents.ytd-playlist-video-list-renderer');
    if (!container) {
        console.log("Inaccessible playlist!");
        ipcRenderer.send(`st-playlist-item-${instanceId}`, null);
        return;
    }

    //10秒経っても始まらなければ完了あつかい
    fetchPlaylistInitialTimeoutId = window.setTimeout(() => {
        console.log("fetchPlaylistKernel timeout!")
        ipcRenderer.send(`st-playlist-item-${instanceId}`, null);
        if (fetchPlaylistTimeoutId) clearTimeout(fetchPlaylistTimeoutId);
    }, 10000);

    fetchPlaylistKernel(container, 0, (complete, item) => {
        if (complete) {
            console.log("playlist fully fetched!")
            ipcRenderer.send(`st-playlist-item-${instanceId}`, null);
            if (fetchPlaylistTimeoutId) clearTimeout(fetchPlaylistTimeoutId);
            return;
        }

        ipcRenderer.send(`st-playlist-item-${instanceId}`, item);

    });
}

let fetchPlaylistInitialTimeoutId: number | undefined = undefined;
let fetchPlaylistTimeoutId: number | undefined = undefined;

function fetchPlaylistKernel(container: Element, position: number, callback: (
    completed: boolean,
    item: {
        type: 'YT_WATCH',
        title: string,
        watchId: string,
        channel: string,
        lengthSeconds: number | undefined
    } | undefined) => void) {
    const innerContainer = container.querySelector('ytm-playlist-video-list-renderer');
    if (!innerContainer) {

        const alert = container.querySelector('ytm-alert-renderer');
        if (alert) {
            callback(true, undefined);
            return;
        }

        fetchPlaylistTimeoutId = window.setTimeout(() => fetchPlaylistKernel(container, position, callback), 500);
        return;
    }

    if (fetchPlaylistInitialTimeoutId) {
        clearTimeout(fetchPlaylistInitialTimeoutId);
        fetchPlaylistInitialTimeoutId = void 0;
    }

    const children = innerContainer.children;
    let fetched = 0;

    const origin = new URL(location.origin);
    let isLoading = false;

    for (let i = position; i < children.length; i++) {
        const child = children.item(i);
        if (!child) continue;

        const tagName = child.tagName.toLowerCase();
        if (tagName === 'ytm-continuation-item-renderer')//'ytd-continuation-item-renderer')
        {
            isLoading = true;
            continue;
        }
        if (tagName !== 'ytm-playlist-video-renderer') continue;//'ytd-playlist-video-renderer') continue;

        fetched++;


        try {

            const link = child.querySelector<HTMLAnchorElement>('a.compact-media-item-metadata-content')//'a#video-title');
            const labelLength = child.querySelector<HTMLElement>('ytm-thumbnail-overlay-time-status-renderer > span.icon-text');

            if (!link) continue;

            const href = link.href;
            const title = link.querySelector<HTMLElement>('.compact-media-item-headline')?.innerText;//link.getAttribute('title');
            const url = new URL(href, origin);
            const watchId = url.searchParams.get('v');
            const channel = link.querySelector<HTMLElement>('.compact-media-item-byline')?.innerText;

            let lengthSeconds: number | undefined = undefined;

            if (labelLength) {
                const lengthStr = labelLength.innerText;
                const segs = lengthStr.split(':').reverse();
                lengthSeconds = 0;
                if (segs.length > 0) lengthSeconds += parseInt(segs[0]);
                if (segs.length > 1) lengthSeconds += parseInt(segs[1]) * 60;
                if (segs.length > 2) lengthSeconds += parseInt(segs[2]) * 3600;
            }

            if (!title) continue;
            if (!watchId) continue;
            if (!channel) continue;

            callback(false,
                {
                    type: 'YT_WATCH',
                    title: title,
                    watchId: watchId,
                    channel: channel,
                    lengthSeconds: lengthSeconds
                });
        } catch (error) {
            console.error(error);
            continue;
        }

    }

    console.log(`Items fetched from the playlist: ${fetched}, isLoading: ${isLoading}`);

    if (fetched == 0 && !isLoading) {
        callback(true, undefined);
        return;
    }

    const doc = document.documentElement;
    const bottom = doc.scrollHeight - doc.clientHeight;
    window.scroll(0, bottom);
    fetchPlaylistTimeoutId = window.setTimeout(() => fetchPlaylistKernel(container, position + fetched, callback), 500);
}