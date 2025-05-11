import { SlashCommandSubcommandBuilder, ChatInputCommandInteraction, CacheType, EmbedBuilder, Colors, Guild } from "discord.js";
import { GuildState } from "../State";
import { RizumuCommand } from "../CommandManager";

import config from '../Config';
import { getVoiceConnection } from "@discordjs/voice";

const silentMode = config.rizumu_silent;

const command: RizumuCommand = {
    setCommand(builder: SlashCommandSubcommandBuilder): void {
        builder
            .setName('leave')
            .setDescription('Leaves the voice channel.')
    },
    async execute(interaction: ChatInputCommandInteraction<CacheType>, guildState: GuildState, guild: Guild): Promise<void> {

        if (!silentMode) {
            const connection = getVoiceConnection(guild.id);
            if (connection) connection.destroy();
        }

        guildState.runtime.rizumu?.close();
        guildState.runtime.rizumu = undefined;

        const em = new EmbedBuilder()
            .setColor(Colors.Grey)
            .setDescription('Left.');

        await interaction.reply({ embeds: [em] });
    }

}

export default command;