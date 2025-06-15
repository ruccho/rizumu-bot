import { ipcRenderer } from "electron";

declare let window: Window & {
    rizumu: {
        instanceId: string;
    }
}

const instanceId = (new URL(location.href)).searchParams.get("rizumu_instance_id");

console.log(`YtPlaylistDesktopPreload for ${instanceId}`);

document.addEventListener("DOMContentLoaded", () => {
    refreshPlaylist();
})

/*
window.addEventListener("load", async (e) => {
    console.log("onload");
    refreshPlaylist();
});
*/

function waitForElement(container: Element, selector: string, subtree: boolean, callback: (coverContainer: Element) => void) {

    {
        const target = container.querySelector(selector);
        if (target) {
            callback(target);
            return;
        }
    }

    const observer: MutationObserver = new MutationObserver(() => {
        const target = container.querySelector(selector);
        if (target) {
            observer.disconnect();
            callback(target);
        }
    })

    observer.observe(container, {
        childList: true,
        subtree: subtree
    });
}

function refreshPlaylist() {

    console.log("Fetching playlist...");

    /*
    const app = document.querySelector('ytd-app');
    if (!app) {
        console.log("Inaccessible playlist!");
        ipcRenderer.send(`st-playlist-item-${instanceId}`, null);
        return;
    }
    */

    waitForElement(document.body, 'div#contents.ytd-playlist-video-list-renderer', true, container => {

        console.log("container obtained");
        fetchPlaylistKernel(container, 0, (complete, item) => {
            if (complete) {
                console.log("playlist fully fetched!")
                ipcRenderer.send(`st-playlist-item-${instanceId}`, null);
                if (fetchPlaylistTimeoutId) clearTimeout(fetchPlaylistTimeoutId);
                return;
            }

            ipcRenderer.send(`st-playlist-item-${instanceId}`, item);

        });
    })

    /*
    const container = document.querySelector('div#contents.ytd-playlist-video-list-renderer');
    if (!container) {
        console.log("Inaccessible playlist!");
        ipcRenderer.send(`st-playlist-item-${instanceId}`, null);
        return;
    }
    */

    fetchPlaylistInitialTimeoutId = window.setTimeout(() => {
        console.log("fetchPlaylistKernel timeout!")
        ipcRenderer.send(`st-playlist-item-${instanceId}`, null);
        if (fetchPlaylistTimeoutId) clearTimeout(fetchPlaylistTimeoutId);
    }, 10000);
}

let fetchPlaylistInitialTimeoutId: number | undefined = undefined;
let fetchPlaylistTimeoutId: number | undefined = undefined;

function fetchPlaylistKernel(container: Element, position: number, callback: (
    completed: boolean,
    item: {
        type: 'YT_WATCH';
        title: string
        author: string
        url: string
        lengthSec?: number,
        watchId: string;
    } | undefined) => void) {
    const innerContainer = container;

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
        if (tagName === 'ytd-continuation-item-renderer') {
            isLoading = true;
            continue;
        }
        if (tagName !== 'ytd-playlist-video-renderer') continue;

        fetched++;


        try {

            const link = child.querySelector<HTMLAnchorElement>('a#video-title');
            const channelLink = child.querySelector<HTMLAnchorElement>('ytd-video-meta-block a');
            const labelLength = child.querySelector<HTMLElement>('ytm-thumbnail-overlay-time-status-renderer span#text');

            if (!link) continue;

            const href = link.href;
            const title = link.getAttribute('title');
            const url = new URL(href, origin);
            const watchId = url.searchParams.get('v');
            const channel = channelLink?.innerText;

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
                    author: channel,
                    url: "https://www.youtube.com/watch?v=" + watchId,
                    lengthSec: lengthSeconds
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