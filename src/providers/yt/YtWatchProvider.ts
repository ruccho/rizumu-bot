import Rizumu, { ProgressCallback } from "../../Rizumu";
import RizumuItem from "../../RizumuItem";
import { RizumuProvider } from "../RizumuProvider";
import fetchYtPlaylist from "./YtPlaylistFetch";
import config from "../../Config";
import fetch from 'node-fetch';
import path from "path";
import { ICancellationToken } from "../../CancellationToken";
import { PublicError } from "../../PublicError";

export class YtWatchItem implements RizumuItem {

    readonly type: 'YT_WATCH' = 'YT_WATCH';
    readonly watchId: string;
    readonly title: string;
    readonly channel: string;
    readonly lengthSec: number | undefined;

    get author(): string {
        return this.channel;
    }

    get url(): string {
        return `https://www.youtube.com/watch?v=${this.watchId}`;
    }

    constructor(watchId: string, title: string, channel: string, lengthSec?: number) {
        this.watchId = watchId;
        this.title = title;
        this.channel = channel;
        this.lengthSec = lengthSec;
    }

    private static assert(item: any): item is YtWatchItem {
        if (item.type !== 'YT_WATCH' ||
            typeof item.watchId !== 'string' ||
            typeof item.title !== 'string' ||
            typeof item.channel !== 'string' ||
            (typeof item.lengthSeconds !== 'number' && typeof item.lengthSeconds !== 'undefined')) return false;
        return true;
    }

    static assertAndInstantiate(item: any) {
        if(!this.assert(item)) return undefined;
        return new YtWatchItem(item.watchId, item.title, item.channel, item.lengthSec);
    }
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

        return new YtWatchItem(watchId, title, channel, lengthSeconds);
    } catch (error) {
        console.log(error);
        return null;
    }


}

async function fetchListAsync(url: URL, emitItem: (item: YtWatchItem) => void, progress?: ProgressCallback, ct?: ICancellationToken) {

    const listId = url.searchParams.get('list');
    if (!listId) return;

    progress?.({ message: '再生リストをフェッチ中...' });
    let count = 0;
    await fetchYtPlaylist(listId, config.rizumu_headless, config.rizumu_playlist_fetch_desktop, (item) => {
        emitItem(item);

        count++;
        if (count % 100 == 0) {
            progress?.({ message: `再生リストをフェッチ中: ${count} アイテム` });
        }
    }, ct)
}

export default class YtWatchProvider implements RizumuProvider {
    get itemClassDefinition() {
        return YtWatchItem;
    }

    match(url: URL): boolean {
        if (url.hostname.endsWith('youtube.com')) {
            return url.pathname === '/watch' || url.pathname === '/playlist';
        } else if (url.hostname.endsWith('youtu.be')) {
            return true;
        }
        return false;
    }

    async processAsync(url: URL, emitItem: (item: YtWatchItem) => void, progress?: ProgressCallback, ct?: ICancellationToken): Promise<void> {
        if (url.hostname.endsWith('youtube.com')) {
            if (url.pathname === '/watch') {
                const watchId = url.searchParams.get('v');
                if (!watchId) return;
                const fetched = await fetchYtWatchItem(watchId);
                if (ct?.isCancellationRequested) throw new PublicError("キャンセルされました。");
                if (fetched) emitItem(fetched);
            } else if (url.pathname === '/playlist') {
                await fetchListAsync(url, emitItem, progress, ct);
            }
        } else if (url.hostname.endsWith('youtu.be')) {
            const watchId = url.pathname.substring(1);
            const fetched = await fetchYtWatchItem(watchId);
            if (ct?.isCancellationRequested) throw new PublicError("キャンセルされました。");
            if (fetched) emitItem(fetched);
        }
    }

    async playItemAsync(rizumu: Rizumu, item: YtWatchItem): Promise<void> {
        const url = new URL(`https://m.youtube.com/watch?app=m&v=${item.watchId}`);
        await rizumu.playUrlAsync(url, path.join(__dirname, 'YtWatchPreload.js'));
    }


}