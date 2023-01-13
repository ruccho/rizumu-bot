const YtWatchItem = require('./YtWatchItem');

let fetch;
const fetchPromise = (async () => {
    fetch = (await import('node-fetch')).default;
})();

function getItem(contents, onItemCallback) {
    let continuationToken = null;
    for (let content of contents) {
        let continuationRenderer = content['continuationItemRenderer'];
        if (continuationRenderer) {
            continuationToken = continuationRenderer['continuationEndpoint']['continuationCommand']['token'];
            continue;
        }

        let renderer = content['playlistVideoRenderer'];
        if (!renderer) continue;

        onItemCallback(YtWatchItem.createFromPlaylistRendererItem(renderer));
    }

    return continuationToken;
}

class RizumuYtPlaylistFetch {

    constructor(playlistId) {
        this._playlistId = playlistId;
    }

    async execute(onItemCallback) {
        await fetchPromise;
        console.log(fetch);

        const playlistUrl = `https://www.youtube.com/playlist?list=${this._playlistId}`;
        const playlistResponse = await fetch(playlistUrl);

        if (!playlistResponse.ok) return;

        const source = await playlistResponse.text();

        const indexInitialData = source.indexOf('{', source.indexOf('ytInitialData'));
        const indexInitialDataClose = source.indexOf(';', indexInitialData);

        const initialDataStr = source.substr(indexInitialData, indexInitialDataClose - indexInitialData);
        const initialData = JSON.parse(initialDataStr);

        let contents = initialData['contents']['twoColumnBrowseResultsRenderer']['tabs'][0]['tabRenderer']['content']['sectionListRenderer']['contents'][0]['itemSectionRenderer']['contents'][0]['playlistVideoListRenderer']['contents'];

        let continuationToken = getItem(contents, onItemCallback);
        console.log(`new continuation: ${continuationToken}`);
        //        console.log(contents);//JSON.stringify(initialData));

        //get key
        const indexYtCfg = source.indexOf('{', source.indexOf('ytcfg.set({'));
        const indexYtCfgClose = source.indexOf(');', indexYtCfg);

        const ytCfgStr = source.substr(indexYtCfg, indexYtCfgClose - indexYtCfg);
        const ytCfg = JSON.parse(ytCfgStr);

        const innerTubeApiKey = ytCfg['INNERTUBE_API_KEY'];

        console.log(innerTubeApiKey);

        while (continuationToken) {
            const requestBody =
            {
                "context": {
                    "client": {
                        "hl": "ja",
                        "gl": "JP",
                        "clientName": "WEB",
                        "clientVersion": "2.20210921.10.00",
                        "utcOffsetMinutes": 540,
                        "timeZone": "Asia/Tokyo"
                    },
                    "request": {
                        "useSsl": true,
                    },
                },
                "continuation": continuationToken
            };
            
            const requestUrl = `https://www.youtube.com/youtubei/v1/browse?key=${innerTubeApiKey}`;

            this._log('Paging...');
            const browseResponse = await fetch(requestUrl, {
                method: 'POST',
                headers: {
                    'accept-language': 'ja',
                    'content-type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!browseResponse.ok) return;

            const browseResponseBody = await browseResponse.json();

            contents = browseResponseBody['onResponseReceivedActions'][0]['appendContinuationItemsAction']['continuationItems'];

            continuationToken = getItem(contents, onItemCallback);
            console.log(`new continuation: ${continuationToken}`);

        }


    }

    _log(message) {
        console.log(`[RIZUMU-YT-PLAYLIST-FETCH] ${message}`);
    }
}

module.exports = RizumuYtPlaylistFetch;