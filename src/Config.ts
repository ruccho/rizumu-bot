type Config = {
    discord_token: string;
    discord_client_id: string;

    rizumu_command_prefix: string;
    rizumu_headless: boolean;
    rizumu_silent: boolean;
    rizumu_playlist_fetch_desktop: boolean;
}

import fs from 'fs';

const data = JSON.parse(fs.readFileSync('../state/config.json', 'utf-8'));

export default data as Config;