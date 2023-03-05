import { addBypassProcessorModule } from "../../RizumuPreloadLib";
import { ipcRenderer, contextBridge } from "electron";


console.log('yt-preload');

const audioContext = new AudioContext({
    sampleRate: 48000
});

let bypass: BypassNode | undefined = undefined;

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
    if (!bypass) await initializeBypass();
    refreshWatch();
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
            if (isNaN(video.duration)) {
                onEnded();
            } else if (video.duration == video.currentTime) {
                //ended
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