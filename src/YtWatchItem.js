const RizumuItem = require("./RizumuItem");

class YtWatchItem extends RizumuItem
{
    constructor(watchId, title, channel, lengthSeconds)
    {
        super('YT_WATCH');
        this.watchId = watchId;
        this.title = title;
        this.channel = channel;
        this.lengthSeconds = lengthSeconds;
    }

    static fromItemObject(item)
    {
        if (item.type !== 'YT_WATCH') throw new Error();
        return new YtWatchItem(item.watchId, item.title, item.channel, item.lengthSecond);
    }

    getUrl()
    {
        return `https://www.youtube.com/watch?v=${this.watchId}`;
    }

    toString()
    {
        return `${this.title} - ${this.channel} (${this.lengthSeconds} s)`;
    }

    static createFromPlaylistRendererItem(renderer)
    {
        const watchId = renderer['videoId'];
        const title = renderer['title']['runs'][0]['text'];
        const channel = renderer['shortBylineText']['runs'][0]['text'];
        const lengthSeconds = renderer['lengthSeconds'];
        return new YtWatchItem(watchId, title, channel, lengthSeconds);
    }
}

module.exports = YtWatchItem;