
console.log('yt-host');

let params = new URLSearchParams(location.search);
const instance_id = params.get('instance_id');

console.log(instance_id);

var webview = document.getElementById('webview-main');

webview.addEventListener("did-finish-load", function () {
    //webview.openDevTools();
    webview.send("initialize", instance_id);
});

webview.addEventListener('did-frame-finish-load', function (e) {
    console.log("[CHILD] did-frame-finish-load. isMainFrame: " + e.isMainFrame);
    if (e.isMainFrame) {
    }
    console.log("[CHILD] refreshing")
    webview.send("refresh");
});

/*
webview.addEventListener('console-message', function (e) {
    console.log('GUEST:', e.message)
});
*/

window.rizumu.on('op-play-watch', (urlStr) => {
    console.log("[CHILD] op-play-watch: " + urlStr);
    webview.loadURL(urlStr);
    /*
    const url = new URL(urlStr);
    const watchId = url.searchParams.get('v');
    if(!watchId) return;

    webview.loadURL(`https://www.youtube.com/embed/${watchId}`);
*/
});

window.rizumu.on('op-play-list', (url) => {
    console.log("[CHILD] op-play-list: " + url);
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

