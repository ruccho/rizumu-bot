import Rizumu from "./Rizumu";
import * as state from '../state/state.json';

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