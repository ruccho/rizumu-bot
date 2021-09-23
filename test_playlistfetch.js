const RizumuYtPlaylistFetch = require('./RizumuYtPlaylistFetch');
const fetchPlaylist = require('./YtPlaylistFetch');

/*
const fetch = new RizumuYtPlaylistFetch('PLS9UKWJoni7v6kmilN185bQWQ2G_Vt8GH');

(async () => {
    await fetch.execute((item) => {
        console.log(item);
    });
})();
*/

(async () => {
    fetchPlaylist('PLS9UKWJoni7v6kmilN185bQWQ2G_Vt8GH', false, (item) => {
        console.log(item.toString());
    });
})();