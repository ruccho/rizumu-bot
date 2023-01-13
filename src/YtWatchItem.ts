import RizumuItem from './RizumuItem';

export default class YtWatchItem implements RizumuItem {
    public watchId: string;
    public title: string;
    public channel: string;
    public lengthSeconds: number;

    constructor(watchId: string, title: string, channel: string, lengthSeconds: number) {
        //super('YT_WATCH');
        this.watchId = watchId;
        this.title = title;
        this.channel = channel;
        this.lengthSeconds = lengthSeconds;
    }

    get url(): string {
        return `https://www.youtube.com/watch?v=${this.watchId}`;
    }

    static fromItemObject(item: any) {
        console.log(item);
        if (item.type !== 'YT_WATCH' ||
            typeof item.watchId !== 'string' ||
            typeof item.title !== 'string' ||
            typeof item.channel !== 'string' ||
            (typeof item.lengthSeconds !== 'number' && typeof item.lengthSeconds !== 'undefined')) throw new Error("Invalid playlist item");
        return new YtWatchItem(item.watchId, item.title, item.channel, item.lengthSeconds);
    }

    toString() {
        return `${this.title} - ${this.channel} (${this.lengthSeconds} s)`;
    }

    /*
    static createFromPlaylistRendererItem(renderer)
    {
        const watchId = renderer['videoId'];
        const title = renderer['title']['runs'][0]['text'];
        const channel = renderer['shortBylineText']['runs'][0]['text'];
        const lengthSeconds = renderer['lengthSeconds'];
        return new YtWatchItem(watchId, title, channel, lengthSeconds);
    }
    */
}