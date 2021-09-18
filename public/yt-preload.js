
console.log('yt-preload');

const { ipcRenderer } = require('electron')
const path = require('path');
const fsPromises = require('fs/promises');

const audioContext = new AudioContext({
    sampleRate: 48000
});

let bypass;

ipcRenderer.on('initialize', async (e, instanceId) => {
    console.log(instanceId);
    console.log("ready");
    ipcRenderer.send(`st-ready-${instanceId}`, null);
});

ipcRenderer.on(`refresh`, async function (e, instanceId) {

    if (location.pathname === "/watch") {
        if (!bypass) await initializeBypass(instanceId);
        refreshWatch(instanceId);
    } else if (location.pathname === "/playlist") {
        refreshPlaylist(instanceId);
    }
});

ipcRenderer.on(`play-next`, function () {
    const nextButton = document.querySelector('a.ytp-next-button');
    nextButton?.click();
});

ipcRenderer.on(`play-again`, function () {
    const prevButton = document.querySelector('a.ytp-prev-button');
    prevButton?.click();
});

ipcRenderer.on(`play-prev`, function () {
    const prevButton = document.querySelector('a.ytp-prev-button');
    prevButton?.click();
    setTimeout(() => { prevButton?.click(); }, 100);
});

let adSkipObserver;
let popupObserver;
let videoObserver;
function refreshWatch(instanceId) {

    console.log('Refreshing...')

    const video = document.querySelector('.html5-main-video');

    if (video) {

        hookVideo(video);

        if (videoObserver) videoObserver.disconnect();
        videoObserver = new MutationObserver(records => {
            hookVideo(video);
        })

        videoObserver.observe(video, {
            attributes: true,
            attributeFilter: ['src']
        });

        video.addEventListener('ended', e => {
            ipcRenderer.send(`st-video-end-${instanceId}`, null);
        });
    }

    const adModule = document.querySelector('.video-ads.ytp-ad-module');
    if (adModule) {
        skipAds(adModule, video);

        if (adSkipObserver) adSkipObserver.disconnect();
        adSkipObserver = new MutationObserver(records => {
            skipAds(adModule, video);
        })

        adSkipObserver.observe(adModule, {
            childList: true
        });
        console.log('Ad skipping hooked!');
    }

    //自動再生をオフ
    const autonavButton = document.querySelector('.ytp-autonav-toggle-button');
    if (autonavButton) {
        if (autonavButton.getAttribute('aria-checked') === "true") {
            autonavButton.click();
        }
    }



    const popup = document.querySelector('ytd-popup-container');
    if (popup) {

        if (popupObserver) popupObserver.disconnect();
        popupObserver = new MutationObserver(records => {
            const dialogs = popup.querySelectorAll('tp-yt-paper-dialog');
            for (let i = 0; i < dialogs.length; i++) {
                let dialog = dialogs[i];
                if (dialog.style.display !== 'none') {
                    const b = dialog.querySelector('a');
                    if (b) {
                        b.click();
                        popupObserver.disconnect();
                        console.log('Confirm skipped!')
                    }
                }
            }
        })

        popupObserver.observe(popup, {
            attributes: true,
            subtree: true,
        });
        console.log('Confirm hooked!')
    }
}

function hookVideo(video) {
    if (!video) return;
    console.log("Video found.");
    if (!bypass) return;

    try {
        const source = audioContext.createMediaElementSource(video);
        source.connect(bypass);
        //bypass.connect(audioContext.destination);
        console.log("Video hooked!");
    } catch (error) {
        console.log("Failed to hook video");
    }
}

function skipAds(adModule, video) {
    const adPlayer = adModule.querySelector('.ytp-ad-player-overlay');

    if (adPlayer) {
        const skipButton = adPlayer.querySelector('.ytp-ad-skip-button');

        if (skipButton) {
            console.log("Ad skipped by clicking the button");
            skipButton.click();
            return;
        }

        if (video) {
            console.log("Ad skipped by seeking");
            video.currentTime = 300;
        }
    }
}

function refreshPlaylist(instanceId) {
    
    const container = document.querySelector('div#contents.ytd-playlist-video-list-renderer');
    if(!container)
    {
        console.log("Inaccessible playlist!");
        return;
    }

    fetchPlaylistKernel(container, 0, (complete, item) => {
        if(complete)
        {
            console.log("playlist fully fetched!")
            ipcRenderer.send(`st-playlist-item-${instanceId}`, null);
            clearTimeout(fetchPlaylistTimeoutId);
            return;
        }

        ipcRenderer.send(`st-playlist-item-${instanceId}`, item);

    });
}

let fetchPlaylistTimeoutId;

function fetchPlaylistKernel(container, position, callback) {
    const children = container.children;
    let fetched = 0;

    const origin = new URL(location.origin);
    let isLoading = false;

    for (let i = position; i < children.length; i++) {
        const child = children.item(i);
        const tagName = child.tagName.toLowerCase();
        if(tagName === 'ytd-continuation-item-renderer')
        {
            isLoading = true;
            continue;
        }
        if (tagName !== 'ytd-playlist-video-renderer') continue;
        const link = child.querySelector('a#video-title');

        if (!link) continue;

        const href = link.href;
        const title = link.getAttribute('title');
        const url = new URL(href, origin);
        const watchId = url.searchParams.get('v');

        fetched++;
        //console.log(`New Playlist item: ${title}, ${href}`);
        callback(false,
            {
                type: 'YT_WATCH',
                title: title,
                watchId: watchId
            });

    }

    console.log(`fetched: ${fetched}, isLoading: ${isLoading}`);

    if (fetched == 0 && !isLoading) {
        callback(true);
        return;
    }

    const doc = document.documentElement;
    const bottom = doc.scrollHeight - doc.clientHeight;
    window.scroll(0, bottom);
    fetchPlaylistTimeoutId = setTimeout(() => fetchPlaylistKernel(container, position + fetched, callback), 500);
}

async function initializeBypass(instanceId) {
    console.log("initializing bypass...");
    const processorPath = 'bypass-processor.js';
    const processorSource = await fsPromises.readFile(path.join(__dirname, processorPath));
    const processorBlob = new Blob([processorSource.toString()], { type: 'text/javascript' });
    const processorURL = URL.createObjectURL(processorBlob);

    console.log(processorURL);

    await audioContext.audioWorklet.addModule(processorURL);
    console.log("Bypass created");
    bypass = new BypassNode(audioContext);

    console.log("Send to: " + `audio-data-${instanceId}`)

    bypass.port.onmessage = e => {
        ipcRenderer.send(`audio-data-${instanceId}`, e.data);
    };
}

class BypassNode extends AudioWorkletNode {
    constructor(context) {
        super(context, 'bypass-processor');
    }
}