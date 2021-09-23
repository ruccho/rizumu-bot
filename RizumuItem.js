class RizumuItem
{
    constructor(type)
    {
        this.type = type;
    }

    getUrl()
    {
        return 'about:blank';
    }

    toString()
    {
        return 'Invalid Item';
    }
}

module.exports = RizumuItem;