import Rizumu, { ProgressCallback } from "../../Rizumu";
import RizumuItem from "../../RizumuItem";
import { RizumuProvider } from "../RizumuProvider";
import fetchYtPlaylist from "./YtPlaylistFetch";
import config from "../../Config";
import fetch from 'node-fetch';
import path from "path";
import { ICancellationToken } from "../../CancellationToken";
import { PublicError } from "../../PublicError";

export type YtWatchItem = RizumuItem & {
    type: 'YT_WATCH';
    watchId: string;
}

function createYtWatchItem(watchId: string, title: string, channel: string, lengthSec?: number): YtWatchItem {
    return {
        type: 'YT_WATCH',
        watchId: watchId,
        title: title,
        author: channel,
        lengthSec: lengthSec,
        url: `https://www.youtube.com/watch?v=${watchId}`,
        provider: YtWatchProvider
    }
}

function assetObject(item: unknown): item is YtWatchItem {
    return typeof item === 'object';
}


function assert(item: unknown): item is YtWatchItem {
    if (!assetObject(item)) return false;
    if (typeof (item as YtWatchItem).type !== 'string') return false;
    if ((item as YtWatchItem).type !== 'YT_WATCH') return false;
    if (typeof (item as YtWatchItem).watchId !== 'string') return false;
    if (typeof (item as YtWatchItem).title !== 'string') return false;
    if (typeof (item as YtWatchItem).author !== 'string') return false;
    if (typeof (item as YtWatchItem).url !== 'string') return false;
    if (typeof (item as YtWatchItem).lengthSec !== 'number' && (item as YtWatchItem).lengthSec !== undefined) return false;
    item['provider'] = YtWatchProvider; // Ensure provider is set
    return true;
}

export function assertAndInstantiate(item: unknown): YtWatchItem | undefined {
    if (!assert(item)) return undefined;
    return { ...item };
}

async function fetchYtWatchItem(watchId: string) {
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

        return createYtWatchItem(watchId, title, channel, lengthSeconds);
    } catch (error) {
        console.log(error);
        return null;
    }

}

async function fetchListAsync(url: URL, emitItem: (item: YtWatchItem) => void, progress?: ProgressCallback, ct?: ICancellationToken) {

    const listId = url.searchParams.get('list');
    if (!listId) return;

    progress?.({ message: 'Fetching a playlist...' });
    let count = 0;
    await fetchYtPlaylist(listId, config.rizumu_headless, config.rizumu_playlist_fetch_desktop, (item) => {
        emitItem(item);

        count++;
        if (count % 100 == 0) {
            progress?.({ message: `Fetching a playlist: ${count} items fetched` });
        }
    }, ct)
}

const YtWatchProvider: RizumuProvider = {
    match: (url: URL) => {
        if (url.hostname.endsWith('youtube.com')) {
            return url.pathname === '/watch' || url.pathname === '/playlist';
        } else if (url.hostname.endsWith('youtu.be')) {
            return true;
        }
        return false;
    },
    processAsync: async (url: URL, emitItem: (item: YtWatchItem) => void, progress?: ProgressCallback, ct?: ICancellationToken) => {
        if (url.hostname.endsWith('youtube.com')) {
            if (url.pathname === '/watch') {
                const watchId = url.searchParams.get('v');
                if (!watchId) return;
                const fetched = await fetchYtWatchItem(watchId);
                if (ct?.isCancellationRequested) throw new PublicError("Canceled.");
                if (fetched) emitItem(fetched);
            } else if (url.pathname === '/playlist') {
                await fetchListAsync(url, emitItem, progress, ct);
            }
        } else if (url.hostname.endsWith('youtu.be')) {
            const watchId = url.pathname.substring(1);
            const fetched = await fetchYtWatchItem(watchId);
            if (ct?.isCancellationRequested) throw new PublicError("Canceled.");
            if (fetched) emitItem(fetched);
        }
    },
    playItemAsync: async (rizumu: Rizumu, item: YtWatchItem) => {
        const url = new URL(`https://m.youtube.com/watch?app=m&v=${item.watchId}`);
        await rizumu.playUrlAsync(url, path.join(__dirname, 'YtWatchPreload.js'));
    }
}

export default YtWatchProvider;