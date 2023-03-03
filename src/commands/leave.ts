import { SlashCommandSubcommandBuilder, ChatInputCommandInteraction, CacheType, EmbedBuilder, Colors, VoiceBasedChannel, GuildMember, CommandInteraction, Guild } from "discord.js";
import { GuildState } from "../State";
import { followUpError, RizumuCommand } from "../CommandManager";

import config from '../Config';
import { entersState, getVoiceConnection, joinVoiceChannel, VoiceConnection, VoiceConnectionStatus } from "@discordjs/voice";
import Rizumu from "../Rizumu";
import YtWatchProvider from "../providers/yt/YtWatchProvider";

const silentMode = config.rizumu_silent;
const headlessMode = config.rizumu_headless;

export default class LeaveCommand implements RizumuCommand {
    setCommand(builder: SlashCommandSubcommandBuilder): void {
        builder
            .setName('leave')
            .setDescription('現在のボイスチャンネルを退出します。')
    }
    async execute(interaction: ChatInputCommandInteraction<CacheType>, guildState: GuildState, guild: Guild): Promise<void> {

        if (!silentMode) {
            const connection = getVoiceConnection(guild.id);
            if (connection) connection.destroy();
        }

        guildState.runtime.rizumu?.close();

        const em = new EmbedBuilder()
            .setColor(Colors.Grey)
            .setDescription('退出しました。');

        await interaction.reply({ embeds: [em] });
    }

}