import { addBypassProcessorModule } from "../../RizumuPreloadLib";
import { ipcRenderer, contextBridge } from "electron";


console.log('yt-preload');

const audioContext = new AudioContext({
    sampleRate: 48000
});

let bypass: BypassNode | undefined = undefined;

/*

ipcRenderer.on('initialize', async (e, data) => {
    console.log(data.instanceId);
    console.log("ready");
    ipcRenderer.send(`st-ready-${data.instanceId}`, null);
});

ipcRenderer.on(`refresh`, async function (e, data) {
    if (location.pathname === "/watch") {
        if (!bypass) await initializeBypass(data.instanceId);
        refreshWatch(data.instanceId);
    } else if (location.pathname === "/playlist") {
        refreshPlaylist(data.instanceId);
    }
});
*/

declare var window: Window & {
    rizumu: {
        instanceId: string;
    }
}

const instanceId = (new URL(location.href)).searchParams.get("rizumu_instance_id");

console.log(document);
console.log(instanceId);

window.addEventListener("load", async (e) => {
    console.log("onload");
    if (location.pathname === "/watch") {
        if (!bypass) await initializeBypass();
        refreshWatch();
    } else if (location.pathname === "/playlist") {
        refreshPlaylist();
    }
});

function waitForElement(container: Element, selector: string, subtree: boolean, callback: (coverContainer: Element) => void) {

    {
        const target = container.querySelector(selector);
        if (target) {
            callback(target);
            return;
        }
    }

    const observer: MutationObserver = new MutationObserver(records => {
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

let adSkipObserver: MutationObserver | undefined = undefined;
let popupObserver: MutationObserver | undefined = undefined;
let videoObserver: MutationObserver | undefined = undefined;
let autoplayObserver: MutationObserver | undefined = undefined;
let errorObserver: MutationObserver | undefined = undefined;

function refreshWatch() {

    console.log('Refreshing...');

    //console.log(document.querySelector('#player-container-id').innerHTML);

    const playContainer = document.querySelector('.ytp-cued-thumbnail-overlay');
    if (playContainer) {
        playContainer.querySelector('button')?.click();
    }

    const video = document.querySelector<HTMLVideoElement>('.html5-main-video');

    waitForElement(document.querySelector('ytm-app')!, '.player-placeholder', true, (coverContainer) => {
        console.log("YouTube error observation");
        if (checkForError(coverContainer)) {
            ipcRenderer.send(`st-video-end-${instanceId}`, null);
        }

        if (errorObserver) errorObserver.disconnect();
        errorObserver = new MutationObserver(records => {
            if (checkForError(coverContainer)) {
                ipcRenderer.send(`st-video-end-${instanceId}`, null);
            }
        });

        errorObserver.observe(coverContainer, {
            subtree: true,
            childList: true
        });
    });

    if (video) {

        hookVideo(video);

        if (videoObserver) videoObserver.disconnect();
        videoObserver = new MutationObserver(records => {
            console.log("video src mutation: " + video.src);
            hookVideo(video);
        })

        videoObserver.observe(video, {
            attributes: true,
            attributeFilter: ['src']
        });

        const onEnded = () => {
            console.log('Video ended.');
            ipcRenderer.send(`st-video-end-${instanceId}`, null);
        };

        video.addEventListener('ended', onEnded);

        video.addEventListener('pause', e => {
            console.log('Video paused.');
            console.log(`video duration: ${video.duration}, current: ${video.currentTime}, src: ${video.currentSrc}`);

            //when post-video ads skipped
            if (isNaN(video.duration) || video.duration == video.currentTime) {
                onEnded();
            } else {
                video.play();
            }
            //ipcRenderer.send(`st-video-end-${instanceId}`, null);
        });

        video.addEventListener("emptied", (e) => {
            console.log("emptied");
        })
    }

    //for mobile 
    waitForElement(document.querySelector('.html5-video-player')!, '.video-ads.ytp-ad-module', false, (adModule) => {
        skipAds(adModule, video!);

        if (adSkipObserver) adSkipObserver.disconnect();
        adSkipObserver = new MutationObserver(records => {
            skipAds(adModule, video!);
        })

        adSkipObserver.observe(adModule, {
            childList: true,
            subtree: true,
        });
        console.log('Ad skipping hooked.');
    });

    //自動再生をオフ
    waitForElement(document.querySelector('#player-control-container')!, '.ytm-autonav-toggle-button-container', true, (autonavButton) => {
        disableAutoplay();
    });

    const popup = document.querySelector('ytd-popup-container');
    if (popup) {

        if (popupObserver) popupObserver.disconnect();
        popupObserver = new MutationObserver(records => {

            const dialogs = popup.querySelectorAll<HTMLElement>('tp-yt-paper-dialog');
            for (let i = 0; i < dialogs.length; i++) {
                let dialog = dialogs[i];
                if (dialog.style.display !== 'none') {
                    const b = dialog.querySelector('a');
                    if (b) {
                        b.click();
                        popupObserver!.disconnect();
                        console.log('Confirmation skipped!');
                    }
                }
            }

        })

        popupObserver.observe(popup, {
            attributes: true,
            subtree: true,
        });
        console.log('Confirmation hooked.');
    }
}

function checkForError(container: Element) {
    const errorMessage = container.querySelector('ytm-player-error-message-renderer');
    if (errorMessage) {
        console.log("error message appeared!");
        return true;
    }
    return false;
}

function hookVideo(video: HTMLVideoElement) {
    if (!video) return;
    if (!bypass) return;

    try {
        const source = audioContext.createMediaElementSource(video);
        source.connect(bypass);
        //bypass.connect(audioContext.destination);
        console.log("Bypass connected!");
    } catch (error) {
        console.error(error);
    }
}

function skipAds(adModule: Element, video: HTMLVideoElement) {
    const adPlayer = adModule.querySelector('.ytp-ad-player-overlay');

    if (adPlayer) {
        const skipButton = adPlayer.querySelector<HTMLElement>('.ytp-ad-skip-button');

        if (skipButton) {
            console.log("Ad skipped by clicking the button.");
            skipButton.click();
            return;
        }

        if (video) {
            console.log("Ad skipped by seeking.");
            video.currentTime = 300;
        }
    }
}

function disableAutoplay() {
    const autonavButton = document.querySelector<HTMLElement>('.ytm-autonav-toggle-button-container');
    const checked = autonavButton!.getAttribute('aria-pressed');
    if (checked === "true") {
        //const button = autonavButton.closest('button');
        autonavButton!.click();
        console.log("Autoplay disabled.");
        setTimeout(disableAutoplay, 500);
    }
}

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

async function initializeBypass() {
    console.log("initializing bypass...");

    await addBypassProcessorModule(audioContext);
    console.log("Bypass created");
    bypass = new BypassNode(audioContext);

    console.log("Send to: " + `audio-data-${instanceId}`)

    bypass.port.onmessage = e => {
        ipcRenderer.send(`audio-data-${instanceId}`, e.data);
    };

}

class BypassNode extends AudioWorkletNode {
    constructor(context: BaseAudioContext) {
        super(context, 'bypass-processor');
    }
}