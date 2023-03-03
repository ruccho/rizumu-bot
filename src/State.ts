import { Guild } from "discord.js";
import Rizumu from "./Rizumu";

type GuildStateRaw = { id: string, commandVersion: number };
export type GuildState = GuildStateRaw & {
    runtime: {
        rizumu?: Rizumu
    }
};

const state: {
    guilds: { [guildId: string]: GuildStateRaw }
} = require('../state/state.json');

const runtimeState: {
    guilds: { [guildId: string]: GuildState | undefined }
} = { guilds: {} };

for(const [key, value] of Object.entries(state.guilds))
{
    runtimeState.guilds[key] = {
        ...value,
        runtime: {

        }
    };
}

export default runtimeState;