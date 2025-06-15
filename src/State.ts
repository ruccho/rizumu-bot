import Rizumu from "./Rizumu";

import fs from "fs";

type State = {
    guilds: { [guildId: string]: GuildStateRaw }
};

const state = JSON.parse(fs.readFileSync('../state/state.json', 'utf-8')) as State;

type GuildStateRaw = { id: string, commandVersion: number };
export type GuildState = GuildStateRaw & {
    runtime: {
        rizumu?: Rizumu
    }
};

const runtimeState: {
    guilds: { [guildId: string]: GuildState | undefined }
} = { guilds: {} };

for (const [key, value] of Object.entries(state.guilds)) {
    runtimeState.guilds[key] = {
        ...value,
        runtime: {

        }
    };
}

export default runtimeState;