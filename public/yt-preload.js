
console.log('yt-preload');

const { ipcRenderer } = require('electron')
const path = require('path');
const fsPromises = require('fs/promises');

const audioContext = new AudioContext({
    sampleRate: 48000
});

let bypass;
//initializeBypass();

ipcRenderer.on('initialize', async (e, instanceId) => {
    console.log(instanceId);
    await initializeBypass(instanceId);
    console.log("ready");
    ipcRenderer.send(`st-ready-${instanceId}`, null);
    refresh();
});


ipcRenderer.on(`refresh`, function () {
    refresh();
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
function refresh() {

    if (location.pathname === '/playlist') {
        const playlist = document.querySelector('#contents.ytd-playlist-video-list-renderer');
        const first = playlist.querySelector('a.ytd-playlist-video-renderer');
        first.click();
        return;
    }

    
    const adModule = document.querySelector('.video-ads.ytp-ad-module');
    if (adModule) {

        if (adSkipObserver) adSkipObserver.disconnect();
        adSkipObserver = new MutationObserver(records => {
            adModule.querySelector('.ytp-ad-skip-button').click();
        })

        adSkipObserver.observe(adModule, {
            childList: true,
            subtree: true
        });
    }
    
    /*
    //Embed style
    const playButton = document.querySelector('.ytp-cued-thumbnail-overlay');
    if(playButton){
        const display = playButton.style['display'];
        if(!display || display !== 'none'){
            //playButton?.click();
        }
    }
    */

    var video = document.querySelector('.html5-main-video');

    if (!video) return;
    console.log("Video found.");
    if (!bypass) return;

    const source = audioContext.createMediaElementSource(video);
    source.connect(bypass);
    //bypass.connect(audioContext.destination);
    
    console.log("Video hooked!");
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