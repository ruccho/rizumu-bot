import YtWatchItem from './YtWatchItem';
import fetch from 'node-fetch';

/*
let fetch;
const fetchPromise = (async () => {
    fetch = (await import('node-fetch')).default;
})();
*/

export default async function fetchYtWatchItem(watchId: string) {
    console.log(`fetchYtWatchItem(): fetching ${watchId}...`);

    const watchUrl = `https://www.youtube.com/watch?v=${watchId}`;
    const watchResponse = await fetch(watchUrl);
    console.log(`fetchYtWatchItem(): respond`);

    if (!watchResponse.ok) return null;

    try {

        const source = await watchResponse.text();

        const indexInitialData = source.indexOf('{', source.indexOf('var ytInitialPlayerResponse = {'));
        const indexInitialDataClose = source.indexOf('};', indexInitialData) + 1;

        const initialDataStr = source.substr(indexInitialData, indexInitialDataClose - indexInitialData);
        const initialData = JSON.parse(initialDataStr);

        const videoDetail = initialData['videoDetails'];

        const title = videoDetail['title'];
        const lengthSeconds = videoDetail['lengthSeconds'];
        const channel = videoDetail['author'];

        return new YtWatchItem(watchId, title, channel, lengthSeconds);
    } catch (error){
        console.log(error);
        return null;
    }


}

module.exports = fetchYtWatchItem;