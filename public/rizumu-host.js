
console.log('yt-host');

let params = new URLSearchParams(location.search);
const instance_id = params.get('instance_id');

console.log(instance_id);

var webview = document.getElementById('webview-main');

let isInitialized = false;

webview.addEventListener("did-finish-load", function () {
    
    if (!isInitialized) {
        webview.openDevTools();
        webview.send("initialize", instance_id);
        isInitialized = true;
        return;
    }

    webview.send("refresh", instance_id);
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
    console.log("[CHILD] op-play-watch: " + urlStr);
    webview.loadURL(urlStr);
});

window.rizumu.on('op-fetch-list', (url) => {
    console.log("[CHILD] op-fetch-list: " + url);
    webview.loadURL(url);
});

window.rizumu.on('op-play-next', () => {
    console.log("[CHILD] op-play-next");
    webview.send("play-next");
});

window.rizumu.on('op-play-again', () => {
    console.log("[CHILD] op-play-again");
    webview.send("play-again");
});

window.rizumu.on('op-play-prev', () => {
    console.log("[CHILD] op-play-prev");
    webview.send("play-prev");
});

