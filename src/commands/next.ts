import { SlashCommandSubcommandBuilder, ChatInputCommandInteraction, CacheType, EmbedBuilder, Colors, VoiceBasedChannel, GuildMember, CommandInteraction, Guild } from "discord.js";
import { GuildState } from "../State";
import { followUpError, RizumuCommand } from "../CommandManager";

import config from '../Config';
import { entersState, getVoiceConnection, joinVoiceChannel, VoiceConnection, VoiceConnectionStatus } from "@discordjs/voice";
import Rizumu from "../Rizumu";
import YtWatchProvider from "../providers/yt/YtWatchProvider";

const silentMode = config.rizumu_silent;
const headlessMode = config.rizumu_headless;

export default class NextCommand implements RizumuCommand {
    setCommand(builder: SlashCommandSubcommandBuilder): void {
        builder
            .setName('next')
            .setDescription('次の曲へ移ります。')
    }
    async execute(interaction: ChatInputCommandInteraction<CacheType>, guildState: GuildState, guild: Guild): Promise<void> {

        let em;

        if (!guildState.runtime.rizumu || !guildState.runtime.rizumu.isAlive()) {
            em = new EmbedBuilder()
                .setDescription(`なにも再生していません。`)
                .setColor(Colors.Grey);
            await interaction.reply({ embeds: [em] });
            return;
        }

        em = new EmbedBuilder()
            .setDescription(`⏭ Loading...`)
            .setColor(Colors.Grey);
        await interaction.reply({ embeds: [em] });
        await guildState.runtime.rizumu.moveQueueAsync(0);
        em = new EmbedBuilder()
            .setDescription(`⏭`)
            .setColor(Colors.Aqua);
        await interaction.editReply({ embeds: [em] });
    }

}