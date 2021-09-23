
logRenderer('yt-host');

let params = new URLSearchParams(location.search);
const instance_id = params.get('instance_id');

logRenderer(instance_id);

var webview = document.getElementById('webview-main');

let isInitialized = false;

webview.addEventListener("did-finish-load", function () {

    if (!isInitialized) {
        //webview.openDevTools();
        webview.send("initialize", instance_id);
        isInitialized = true;
        return;
    }

    webview.send("refresh", instance_id);
    window.rizumu.send('st-url-changed', {
        url: webview.getURL()
    })
});

/*
const events = [
    "did-finish-load",
    "did-fail-load",
    "did-frame-finish-load",
    "did-start-loading",
    "did-stop-loading",
    "did-attach",
    "dom-ready",
    "page-title-updated",
    "will-navigate",
    "will-start-navigation",
    "did-navigate",
    "did-frame-navigate",
    "did-navigate-in-page",
    "media-start-playing",
    "media-paused"
]

for (let ev of events) {
    let ev_cap = ev;
    webview.addEventListener(ev, e => {
        console.log("EVENT: " + ev_cap);
        if (e) console.log(e);
    })
}
*/

window.rizumu.on('op-play-watch', (urlStr) => {
    logRenderer("op-play-watch: " + urlStr);
    const url = new URL(urlStr);
    const watchId = url.searchParams.get('v');

    const rebuiltUrl = `https://m.youtube.com/watch?app=m&v=${watchId}`;
    webview.loadURL(rebuiltUrl);
});

window.rizumu.on('op-fetch-list', (listId) => {
    logRenderer("op-fetch-list: " + listId);

    const rebuiltUrl = `https://m.youtube.com/playlist?app=m&list=${listId}`;
    webview.loadURL(rebuiltUrl);
});

webview.addEventListener('console-message', e => {
    logWebview(e.message, e.level);
})

function logRenderer(message) {
    console.log(`[RENDERER] ${message}`)
    window.rizumu.send('st-console-message', {message: `[RENDERER] ${message}`});
}

function logWebview(message, level) {
    window.rizumu.send('st-console-message', {message: `[WEBVIEW] ${message}`});
    if (level === void 0 || level === 0)
        console.log(`[WEBVIEW] ${message}`)
    else if (level === 1)
        console.info(`[WEBVIEW] ${message}`)
    else if (level === 1)
        console.warn(`[WEBVIEW] ${message}`)
    else if (level === 1)
        console.error(`[WEBVIEW] ${message}`)
}