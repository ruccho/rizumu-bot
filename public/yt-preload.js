
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

function waitForElement(container, selector, subtree, callback) {

    {
        const target = container.querySelector(selector);
        if (target) {
            callback(target);
            return;
        }
    }

    let observer;
    observer = new MutationObserver(records => {
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

let adSkipObserver;
let popupObserver;
let videoObserver;
let autoplayObserver;
let errorObserver;
function refreshWatch(instanceId) {

    console.log('Refreshing...');

    const playContainer = document.querySelector('.ytp-cued-thumbnail-overlay');
    if (playContainer) {
        playContainer.querySelector('button')?.click();
    }

    const video = document.querySelector('.html5-main-video');

    waitForElement(document.querySelector('ytm-app'), '.player-placeholder', true, (coverContainer) => {
        console.log("error observation!");
        if(checkForError(coverContainer))
        {
            ipcRenderer.send(`st-video-end-${instanceId}`, null);
        }

        if(errorObserver) errorObserver.disconnect();
        errorObserver = new MutationObserver(records => {
            if(checkForError(coverContainer))
            {
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
            if (isNaN(video.duration)) {
                console.log('Post-video ads skipped');
                onEnded();
            }
            //ipcRenderer.send(`st-video-end-${instanceId}`, null);
        });
    }

    //for desktop
    /*
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
        console.log('Ad skipping hooked.');
    }
    */

    //for mobile 
    waitForElement(document.querySelector('.html5-video-player'), '.video-ads.ytp-ad-module', false, (adModule) => {
        skipAds(adModule, video);

        if (adSkipObserver) adSkipObserver.disconnect();
        adSkipObserver = new MutationObserver(records => {
            skipAds(adModule, video);
        })

        adSkipObserver.observe(adModule, {
            childList: true,
            subtree: true,
        });
        console.log('Ad skipping hooked.');
    });

    //自動再生をオフ
    const autonavButton = document.querySelector('.ytm-autonav-toggle-button-container');
    if (autonavButton) {
        disableAutoplay();
    } else console.log('Autonav button not found.')

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

function checkForError(container)
{
    const errorMessage = container.querySelector('ytm-player-error-message-renderer');
    if(errorMessage) {
        console.log("error message appeared!");
        return true;
    }
    return false;
}

function hookVideo(video) {
    if (!video) return;
    if (!bypass) return;

    try {
        const source = audioContext.createMediaElementSource(video);
        source.connect(bypass);
        //bypass.connect(audioContext.destination);
        console.log("Bypass connected!");
    } catch (error) {
        console.log("Failed to connect bypass.");
    }
}

function skipAds(adModule, video) {
    const adPlayer = adModule.querySelector('.ytp-ad-player-overlay');

    if (adPlayer) {
        const skipButton = adPlayer.querySelector('.ytp-ad-skip-button');

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
    const autonavButton = document.querySelector('.ytm-autonav-toggle-button-container');
    const checked = autonavButton.getAttribute('aria-pressed');
    if (checked === "true") {
        //const button = autonavButton.closest('button');
        autonavButton.click();
        console.log("Autoplay disabled.");
        setTimeout(disableAutoplay, 500);
    }
}

function refreshPlaylist(instanceId) {

    console.log("Fetching playlist...");
    const container = document.querySelector('ytm-app');//div#contents.ytd-playlist-video-list-renderer');
    if (!container) {
        console.log("Inaccessible playlist!");
        ipcRenderer.send(`st-playlist-item-${instanceId}`, null);
        return;
    }

    //10秒経っても始まらなければ完了あつかい
    fetchPlaylistInitialTimeoutId = setTimeout(() => {
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

let fetchPlaylistInitialTimeoutId;
let fetchPlaylistTimeoutId;

function fetchPlaylistKernel(container, position, callback) {
    const innerContainer = container.querySelector('ytm-playlist-video-list-renderer');
    if (!innerContainer) {

        const alert = container.querySelector('ytm-alert-renderer');
        if (alert) {
            callback(true);
            return;
        }

        fetchPlaylistTimeoutId = setTimeout(() => fetchPlaylistKernel(container, position, callback), 500);
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
        const tagName = child.tagName.toLowerCase();
        if (tagName === 'ytm-continuation-item-renderer')//'ytd-continuation-item-renderer')
        {
            isLoading = true;
            continue;
        }
        if (tagName !== 'ytm-playlist-video-renderer') continue;//'ytd-playlist-video-renderer') continue;

        fetched++;


        try {

            const link = child.querySelector('a.compact-media-item-metadata-content')//'a#video-title');

            if (!link) continue;

            const href = link.href;
            const title = link.querySelector('.compact-media-item-headline').innerText;//link.getAttribute('title');
            const url = new URL(href, origin);
            const watchId = url.searchParams.get('v');
            const channel = link.querySelector('.compact-media-item-byline').innerText;

            callback(false,
                {
                    type: 'YT_WATCH',
                    title: title,
                    watchId: watchId,
                    channel: channel
                });
        } catch (error) {
            console.error(error);
            continue;
        }

    }

    console.log(`Items fetched from the playlist: ${fetched}, isLoading: ${isLoading}`);

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

    console.log(require.resolve('electron'));

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